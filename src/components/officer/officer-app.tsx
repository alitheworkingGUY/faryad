"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronRight,
  ClipboardCheck,
  LocateFixed,
  MapPin,
  Navigation,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MiniMap } from "@/components/map";
import { CategoryTile } from "@/components/shared/category";
import { PriorityBadge, SlaChip, StatusBadge } from "@/components/shared/chips";
import { Logo } from "@/components/shared/logo";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Timeline } from "@/components/shared/timeline";
import { Textarea } from "@/components/ui/textarea";
import { OFFICER_NAMES } from "@/db/seed-data";
import { api } from "@/lib/api";
import {
  CATEGORY_META,
  type DepartmentDTO,
  type Status,
  type TicketDTO,
  type TicketEventDTO,
} from "@/lib/domain";
import { timeAgo } from "@/lib/format";
import { Ur } from "@/lib/i18n";
import { onLiveEvent, useLive, useLiveData } from "@/lib/store";
import { cn } from "@/lib/utils";

const DEPT_KEY = "faryad.officer.dept";

const DEPT_COLORS: Record<string, string> = { WSSP: "#38BDF8", TMA: "#FACC15", PESCO: "#F43F5E" };

type Filter = "active" | Status;
const FILTERS: { key: Filter; en: string; ur: string }[] = [
  { key: "active", en: "Active", ur: "جاری" },
  { key: "open", en: "New", ur: "نئی" },
  { key: "assigned", en: "Assigned", ur: "تفویض" },
  { key: "in_progress", en: "In progress", ur: "کام جاری" },
  { key: "resolved", en: "Resolved", ur: "حل شدہ" },
];

const NEXT: Record<Status, { status: Status; en: string; ur: string; icon: LucideIcon; toast: string } | null> = {
  open: { status: "assigned", en: "Assign to me", ur: "میں سنبھالتا ہوں", icon: UserCheck, toast: "Assigned to you" },
  assigned: { status: "in_progress", en: "Start work", ur: "کام شروع", icon: Wrench, toast: "Work started" },
  in_progress: { status: "resolved", en: "Mark resolved", ur: "حل ہو گیا", icon: Check, toast: "Resolved · citizen notified" },
  resolved: null,
};

function DepartmentPicker({
  departments,
  tickets,
  onPick,
}: {
  departments: DepartmentDTO[];
  tickets: TicketDTO[];
  onPick: (code: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-8">
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-fg">Choose your department</h1>
      <Ur as="p" className="mt-1 text-lg text-dim">
        اپنا محکمہ منتخب کریں
      </Ur>
      <div className="mt-6 flex flex-col gap-3">
        {departments.map((d) => {
          const mine = tickets.filter((t) => t.departmentCode === d.code && t.status !== "resolved");
          const color = DEPT_COLORS[d.code] ?? "#10B981";
          return (
            <button
              key={d.code}
              type="button"
              onClick={() => onPick(d.code)}
              className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 text-start transition-colors active:bg-panel-2"
            >
              <span
                className="grid size-14 shrink-0 place-items-center rounded-2xl border text-base font-bold tracking-wide"
                style={{ color, background: `${color}1F`, borderColor: `${color}55` }}
              >
                {d.code}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-fg">{d.name}</p>
                <Ur as="p" className="ur-tight truncate text-sm text-dim">
                  {d.nameUr}
                </Ur>
                <p className="mt-1 text-xs text-dim">
                  {d.categories.map((c) => CATEGORY_META[c].en).join(" · ")}
                </p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-semibold text-fg tnum">{mine.length}</p>
                <p className="text-[11px] text-dim">active</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-dim rtl:rotate-180" />
            </button>
          );
        })}
      </div>
      <p className="mt-auto pt-8 text-center text-xs text-dim">Field officer app · updates reach the Command Center instantly</p>
    </div>
  );
}

function TicketCard({ ticket, onOpen }: { ticket: TicketDTO; onOpen: () => void }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-2xl border border-line bg-panel p-4 text-start transition-colors active:bg-panel-2"
      >
        <div className="flex items-start gap-3">
          <CategoryTile category={ticket.category} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-fg tnum">{ticket.ticketNo}</span>
              <PriorityBadge priority={ticket.priority} className="h-5 px-2 text-[11px]" />
              {ticket.locationSource === "gps" && <LocateFixed className="size-4 text-live" aria-label="Exact GPS" />}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-dim">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{ticket.areaEn}</span>
              <span>·</span>
              <span className="shrink-0">{timeAgo(ticket.createdAt)}</span>
            </p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-dim" />
        </div>
        <Ur as="p" className="mt-3 line-clamp-2 text-[17px] text-fg">
          {ticket.descriptionUr}
        </Ur>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <SlaChip ticket={ticket} />
        </div>
      </button>
    </motion.li>
  );
}

function TicketView({
  ticket,
  officer,
  onBack,
}: {
  ticket: TicketDTO;
  officer: string;
  onBack: () => void;
}) {
  const [events, setEvents] = useState<TicketEventDTO[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const next = NEXT[ticket.status];
  const meta = CATEGORY_META[ticket.category];

  const loadEvents = useCallback(async () => {
    try {
      const res = await api<{ events: TicketEventDTO[] }>(`/api/tickets/${encodeURIComponent(ticket.ticketNo)}`);
      setEvents(res.events);
    } catch {
      setEvents([]);
    }
  }, [ticket.ticketNo]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, ticket.updatedAt, ticket.voiceNoteUrl]);

  async function advance() {
    if (!next || busy) return;
    const before = ticket;
    const now = Date.now();
    // Optimistic: the screen moves on at once, and rolls back if the server refuses.
    useLive.getState().upsertTicket({
      ...ticket,
      status: next.status,
      assignee: ticket.assignee ?? officer,
      updatedAt: now,
      resolvedAt: next.status === "resolved" ? now : ticket.resolvedAt,
      resolutionNote: next.status === "resolved" ? note.trim() || null : ticket.resolutionNote,
    });
    setBusy(true);
    try {
      const res = await api<{ ticket: TicketDTO }>(`/api/tickets/${encodeURIComponent(ticket.ticketNo)}`, {
        method: "PATCH",
        body: {
          status: next.status,
          actor: officer,
          assignee: officer,
          resolutionNote: next.status === "resolved" ? note : undefined,
        },
      });
      useLive.getState().upsertTicket(res.ticket);
      toast.success(`${ticket.ticketNo} · ${next.toast}`);
      if (navigator.vibrate) navigator.vibrate(40);
      setNote("");
    } catch (err) {
      useLive.getState().upsertTicket(before);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="grid size-11 place-items-center rounded-full border border-line bg-panel text-fg active:bg-panel-2"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-fg tnum">{ticket.ticketNo}</p>
          <p className="truncate text-xs text-dim">
            <span style={{ color: meta.color }}>{meta.en}</span> · {ticket.areaEn}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <SlaChip ticket={ticket} />
          {ticket.incidentId != null && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 text-xs font-medium text-danger">
              <span className="blink size-1.5 rounded-full bg-danger" /> Part of incident #{ticket.incidentId}
            </span>
          )}
        </div>

        <Ur as="p" className="mt-4 text-xl text-fg">
          {ticket.descriptionUr}
        </Ur>
        <p className="mt-1 text-sm text-dim">{ticket.descriptionEn}</p>

        <div className="relative mt-4 h-48 overflow-hidden rounded-2xl border border-line">
          <MiniMap lat={ticket.lat} lng={ticket.lng} category={ticket.category} zoom={15} />
          <span className="pointer-events-none absolute start-3 top-3 flex items-center gap-1.5 rounded-full border border-line bg-ink/85 px-2.5 py-1 text-xs text-dim backdrop-blur">
            {ticket.locationSource === "gps" ? (
              <>
                <LocateFixed className="size-3.5 text-live" /> Exact GPS from caller
              </>
            ) : ticket.locationSource === "manual" ? (
              <>
                <MapPin className="size-3.5 text-cat-water" /> Marked by command centre
              </>
            ) : (
              <>
                <MapPin className="size-3.5" /> Approximate · {ticket.areaEn}
              </>
            )}
          </span>
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${ticket.lat},${ticket.lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel text-sm font-medium text-fg active:bg-panel-2"
        >
          <Navigation className="size-4 text-live" /> Get directions
        </a>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-panel p-4">
          <div>
            <p className="text-xs text-dim">Caller</p>
            <p className="mt-0.5 truncate text-sm font-medium text-fg">{ticket.callerName}</p>
          </div>
          <div>
            <p className="text-xs text-dim">Phone</p>
            <p className="mt-0.5 text-sm font-medium text-fg tnum">{ticket.phoneMasked}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-dim">Assigned to</p>
            <p className="mt-0.5 truncate text-sm font-medium text-fg">{ticket.assignee ?? "Nobody yet"}</p>
          </div>
        </div>

        {ticket.status === "resolved" && (
          <div className="mt-4 rounded-2xl border border-live/40 bg-live/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-live">
              <AudioLines className="size-4" /> Citizen notified with an Urdu voice note
            </p>
            {ticket.resolutionNote && <p className="mt-1.5 text-sm text-fg">{ticket.resolutionNote}</p>}
            {ticket.voiceNoteUrl && <audio controls preload="none" src={ticket.voiceNoteUrl} className="mt-3 h-10 w-full" />}
          </div>
        )}

        <h2 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-dim uppercase">Timeline</h2>
        {events ? <Timeline events={events} /> : <LoadingState className="min-h-24" />}
      </div>

      {next && (
        <div className="border-t border-line bg-ink/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          {ticket.status === "in_progress" && (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was done? (optional)"
              className="mb-2.5 min-h-12 border-line bg-panel text-base"
            />
          )}
          <button
            type="button"
            onClick={advance}
            disabled={busy}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-semibold transition-transform active:scale-[0.98] disabled:opacity-70",
              next.status === "resolved" ? "bg-live text-ink" : "bg-fg text-ink",
            )}
          >
            <next.icon className="size-5" />
            {next.en}
            <span className="ur ur-tight text-lg font-normal opacity-80">{next.ur}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function OfficerApp() {
  const { loaded, error, retry } = useLiveData();
  const tickets = useLive((s) => s.tickets);
  const departments = useLive((s) => s.departments);
  const connected = useLive((s) => s.connected);
  const [dept, setDept] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [openNo, setOpenNo] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDept(window.localStorage.getItem(DEPT_KEY));
    } catch {
      // no saved department
    }
  }, []);

  function pick(code: string | null) {
    setDept(code);
    setOpenNo(null);
    try {
      if (code) window.localStorage.setItem(DEPT_KEY, code);
      else window.localStorage.removeItem(DEPT_KEY);
    } catch {
      // ignore
    }
  }

  const officer = dept ? (OFFICER_NAMES[dept]?.[0] ?? `Officer (${dept})`) : "Officer";

  // A new complaint for this department buzzes the phone.
  useEffect(() => {
    if (!dept) return;
    return onLiveEvent((event) => {
      if (event.type === "ticket.created" && event.payload.departmentCode === dept) {
        toast.info(`New complaint ${event.payload.ticketNo} · ${event.payload.areaEn}`, {
          description: event.payload.descriptionEn,
          duration: 7000,
        });
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      }
    });
  }, [dept]);

  const mine = useMemo(() => tickets.filter((t) => t.departmentCode === dept), [tickets, dept]);
  const list = useMemo(() => {
    const filtered = mine.filter((t) => (filter === "active" ? t.status !== "resolved" : t.status === filter));
    // Most urgent deadline first; resolved tickets by most recent.
    return filtered.sort((a, b) =>
      a.status === "resolved" && b.status === "resolved"
        ? (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)
        : a.slaDueAt - b.slaDueAt,
    );
  }, [mine, filter]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { active: 0, open: 0, assigned: 0, in_progress: 0, resolved: 0 };
    for (const t of mine) {
      c[t.status]++;
      if (t.status !== "resolved") c.active++;
    }
    return c;
  }, [mine]);
  const open = openNo ? tickets.find((t) => t.ticketNo === openNo) : undefined;
  const color = dept ? (DEPT_COLORS[dept] ?? "#10B981") : "#10B981";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-ink" dir="ltr">
      {!open && (
        <header className="flex items-center justify-between px-5 pt-5">
          <Logo size="sm" />
          {dept ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold"
              style={{ color, borderColor: `${color}55`, background: `${color}1A` }}
            >
              <span className={cn("size-2 rounded-full", connected ? "bg-live" : "bg-danger")} />
              {dept}
              <span className="text-xs font-normal text-dim">switch</span>
            </button>
          ) : (
            <span className="text-xs text-dim">Officer app</span>
          )}
        </header>
      )}

      {error && !loaded ? (
        <ErrorState message={error} onRetry={retry} />
      ) : !loaded ? (
        <LoadingState label="Loading complaints" />
      ) : !dept ? (
        <DepartmentPicker departments={departments} tickets={tickets} onPick={pick} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <TicketView key={open.ticketNo} ticket={open} officer={officer} onBack={() => setOpenNo(null)} />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="px-5 pt-5">
                <p className="text-xs text-dim">Signed in as</p>
                <p className="truncate text-lg font-semibold text-fg">{officer}</p>
              </div>
              <div className="scroll-thin mt-4 flex shrink-0 gap-2 overflow-x-auto px-5 pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={cn(
                      "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                      filter === f.key ? "border-live/50 bg-live/15 text-live" : "border-line bg-panel text-dim",
                    )}
                  >
                    {f.en}
                    <span className="text-xs tnum opacity-80">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8">
                {list.length === 0 ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="Nothing here"
                    titleUr="کوئی شکایت نہیں"
                    hint="New complaints for your department appear here as soon as they are registered."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {list.map((t) => (
                        <TicketCard key={t.ticketNo} ticket={t} onOpen={() => setOpenNo(t.ticketNo)} />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
