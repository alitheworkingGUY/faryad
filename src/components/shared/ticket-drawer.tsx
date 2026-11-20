"use client";

import {
  AudioLines,
  Check,
  Crosshair,
  LocateFixed,
  MapPin,
  Play,
  RotateCcw,
  Send,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MiniMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import {
  CATEGORY_META,
  MOOD_META,
  type CallDTO,
  type Status,
  type TicketDTO,
  type TicketEventDTO,
} from "@/lib/domain";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Bi, Ur, useLang } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { CategoryTile } from "./category";
import { DeptChip, PriorityBadge, SlaChip, StatusBadge } from "./chips";
import { ErrorState, LoadingState } from "./states";
import { Timeline } from "./timeline";
import { TranscriptBubbles } from "./transcript";

type Detail = { ticket: TicketDTO; events: TicketEventDTO[]; call: CallDTO | null };

const NEXT_ACTION: Record<Status, { status: Status; en: string; ur: string; icon: typeof Check } | null> = {
  open: { status: "assigned", en: "Assign", ur: "تفویض کریں", icon: UserCheck },
  assigned: { status: "in_progress", en: "Start work", ur: "کام شروع کریں", icon: Wrench },
  in_progress: { status: "resolved", en: "Resolve", ur: "حل کریں", icon: Check },
  resolved: null,
};

function Field({ label, labelUr, children }: { label: string; labelUr: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-dim">
        <Bi en={label} ur={labelUr} only />
      </p>
      <div className="mt-0.5 truncate text-sm font-medium text-fg">{children}</div>
    </div>
  );
}

export function TicketDetailBody({ ticketNo, actor = "Command Center" }: { ticketNo: string; actor?: string }) {
  const { t } = useLang();
  const live = useLive((s) => s.tickets.find((x) => x.ticketNo === ticketNo));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDetail(await api<Detail>(`/api/tickets/${encodeURIComponent(ticketNo)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [ticketNo]);

  // Reload when the ticket changes anywhere (officer app, another desk, the voice note arriving).
  useEffect(() => {
    void load();
  }, [load, live?.updatedAt, live?.voiceNoteUrl, live?.status]);

  if (error && !detail) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <LoadingState label="Loading ticket" />;

  const ticket = live ?? detail.ticket;
  const meta = CATEGORY_META[ticket.category];
  const next = NEXT_ACTION[ticket.status];
  const mood = MOOD_META[ticket.mood] ?? MOOD_META[3];

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const res = await api<{ ticket: TicketDTO }>(`/api/tickets/${encodeURIComponent(ticketNo)}`, {
        method: "PATCH",
        body: { ...body, actor },
      });
      useLive.getState().upsertTicket(res.ticket);
      toast.success(success);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api(`/api/tickets/${encodeURIComponent(ticketNo)}/notes`, { body: { text: note, actor } });
      setNote("");
      toast.success(t("Note added", "نوٹ شامل ہو گیا"));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-line px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <CategoryTile category={ticket.category} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-2xl font-semibold tracking-tight text-fg tnum">{ticket.ticketNo}</SheetTitle>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <SheetDescription className="mt-1 text-sm text-dim">
              <span style={{ color: meta.color }} className="font-medium">
                {t(meta.en, meta.ur)}
              </span>{" "}
              · {t(ticket.areaEn, ticket.areaUr)} · {timeAgo(ticket.createdAt)}
            </SheetDescription>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DeptChip code={ticket.departmentCode} />
          <SlaChip ticket={ticket} />
          {ticket.incidentId != null && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 text-xs font-medium text-danger">
              <span className="blink size-1.5 rounded-full bg-danger" /> Incident #{ticket.incidentId}
            </span>
          )}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Complaint */}
        <section>
          <Ur as="p" className="text-lg text-fg">
            {ticket.descriptionUr}
          </Ur>
          <p className="mt-1 text-sm text-dim">{ticket.descriptionEn}</p>
        </section>

        {/* Map + mark place */}
        <section className="mt-5">
          <div className="relative h-52 overflow-hidden rounded-xl border border-line">
            <MiniMap
              lat={ticket.lat}
              lng={ticket.lng}
              category={ticket.category}
              picking={picking}
              picked={picked}
              onPick={setPicked}
            />
            <div className="pointer-events-none absolute start-3 top-3 flex items-center gap-1.5 rounded-full border border-line bg-ink/85 px-2.5 py-1 text-xs text-dim backdrop-blur">
              {ticket.locationSource === "gps" ? (
                <>
                  <LocateFixed className="size-3.5 text-live" /> <Bi en="Exact GPS" ur="جی پی ایس" only />
                </>
              ) : ticket.locationSource === "manual" ? (
                <>
                  <Crosshair className="size-3.5 text-cat-water" /> <Bi en="Marked by officer" ur="افسر نے نشان لگایا" only />
                </>
              ) : (
                <>
                  <MapPin className="size-3.5" /> <Bi en="Approximate (area)" ur="اندازاً (علاقہ)" only />
                </>
              )}
            </div>
            {picking && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <span className="rounded-full border border-live/40 bg-ink/90 px-3 py-1 text-xs text-live backdrop-blur">
                  <Bi en="Click the exact spot on the map" ur="نقشے پر درست جگہ پر کلک کریں" only />
                </span>
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {!picking ? (
              <Button variant="outline" size="lg" onClick={() => setPicking(true)}>
                <Crosshair /> <Bi en="Mark place" ur="جگہ کی نشاندہی" only />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  disabled={!picked || busy}
                  onClick={async () => {
                    if (!picked) return;
                    await patch({ lat: picked.lat, lng: picked.lng }, t("Location updated", "مقام تبدیل ہو گیا"));
                    setPicking(false);
                    setPicked(null);
                  }}
                >
                  <Check /> <Bi en="Save place" ur="محفوظ کریں" only />
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setPicking(false);
                    setPicked(null);
                  }}
                >
                  <X /> <Bi en="Cancel" ur="منسوخ" only />
                </Button>
              </>
            )}
            <span className="ms-auto text-xs text-dim tnum">
              {ticket.lat.toFixed(5)}, {ticket.lng.toFixed(5)}
            </span>
          </div>
        </section>

        {/* Facts */}
        <section className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 rounded-xl border border-line bg-panel-2/50 p-4">
          <Field label="Caller" labelUr="کالر">
            {ticket.callerName}
          </Field>
          <Field label="Phone" labelUr="فون">
            <span className="tnum">{ticket.phoneMasked}</span>
          </Field>
          <Field label="Mood" labelUr="موڈ">
            <span style={{ color: mood.color }}>{t(mood.en, mood.ur)}</span>
          </Field>
          <Field label="Department" labelUr="محکمہ">
            {ticket.departmentCode}
          </Field>
          <Field label="Assigned to" labelUr="ذمہ دار">
            {ticket.assignee ?? "—"}
          </Field>
          <Field label="Registered" labelUr="اندراج">
            <span className="tnum">{formatDateTime(ticket.createdAt)}</span>
          </Field>
        </section>

        {/* Voice note */}
        {ticket.status === "resolved" && (
          <section className="mt-5 rounded-xl border border-live/30 bg-live/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-live">
              <AudioLines className="size-4" />
              <Bi en="Urdu voice note sent to citizen" ur="شہری کو صوتی پیغام بھیج دیا گیا" />
            </p>
            {ticket.resolutionNote && <p className="mt-1.5 text-sm text-fg">{ticket.resolutionNote}</p>}
            {ticket.voiceNoteUrl ? (
              <audio controls preload="none" src={ticket.voiceNoteUrl} className="mt-3 h-9 w-full" />
            ) : (
              <p className="mt-1.5 text-xs text-dim">No audio file for this ticket.</p>
            )}
          </section>
        )}

        {/* Actions */}
        <section className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-wide text-dim uppercase">
            <Bi en="Actions" ur="کارروائی" only />
          </p>
          {ticket.status === "in_progress" && (
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder={t("Resolution note (optional)", "حل کی تفصیل (اختیاری)")}
              className="mb-2.5 min-h-16 border-line bg-ink"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {next && (
              <Button
                size="lg"
                disabled={busy}
                onClick={() =>
                  patch(
                    { status: next.status, resolutionNote: next.status === "resolved" ? resolveNote : undefined },
                    `${ticket.ticketNo}: ${next.en}`,
                  )
                }
              >
                <next.icon /> <Bi en={next.en} ur={next.ur} only />
              </Button>
            )}
            {ticket.status !== "open" && (
              <Button
                variant="outline"
                size="lg"
                disabled={busy}
                onClick={() => patch({ status: "open" }, `${ticket.ticketNo}: reopened`)}
              >
                <RotateCcw /> <Bi en="Reopen" ur="دوبارہ کھولیں" only />
              </Button>
            )}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Add a note for the team", "ٹیم کے لیے نوٹ لکھیں")}
              className="min-h-10 border-line bg-ink"
            />
            <Button variant="secondary" size="lg" disabled={busy || !note.trim()} onClick={addNote}>
              <Send /> <Bi en="Add" ur="شامل کریں" only />
            </Button>
          </div>
        </section>

        {/* Timeline + transcript */}
        <Tabs defaultValue="timeline" className="mt-6">
          <TabsList>
            <TabsTrigger value="timeline">
              <Bi en="Timeline" ur="ٹائم لائن" only />
            </TabsTrigger>
            <TabsTrigger value="transcript">
              <Bi en="Call transcript" ur="کال کا متن" only />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="pt-4">
            <Timeline events={detail.events} />
          </TabsContent>
          <TabsContent value="transcript" className="pt-4">
            {detail.call ? (
              <>
                <p className="mb-3 flex items-center gap-2 text-xs text-dim">
                  <Play className="size-3" /> {detail.call.seconds}s call · PKR {detail.call.costPkr.toFixed(2)}
                </p>
                <TranscriptBubbles lines={detail.call.transcript} autoScroll={false} />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-dim">This ticket was not created from a voice call.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Right-hand drawer used by the Command Center, Tickets and Incidents screens. */
export function TicketDrawer() {
  const ticketNo = useUI((s) => s.drawerTicketNo);
  const close = useUI((s) => s.closeTicket);
  return (
    <Sheet open={ticketNo != null} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="gap-0 border-line bg-panel p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
      >
        {ticketNo && <TicketDetailBody key={ticketNo} ticketNo={ticketNo} />}
      </SheetContent>
    </Sheet>
  );
}
