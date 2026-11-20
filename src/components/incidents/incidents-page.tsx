"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Siren, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { CityMap, type MapFocus } from "@/components/map";
import { AppShell, PageHeader } from "@/components/shared/app-shell";
import { CategoryTile } from "@/components/shared/category";
import { SlaChip, StatusBadge } from "@/components/shared/chips";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { useNow } from "@/hooks/use-now";
import { CATEGORY_META, type IncidentDTO } from "@/lib/domain";
import { formatTime, timeAgo } from "@/lib/format";
import { Bi, Ur, useLang } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const LEVELS = [
  { en: "Watch", ur: "نگرانی", color: "#F59E0B" },
  { en: "Level 1", ur: "درجہ ۱", color: "#F97316" },
  { en: "Level 2", ur: "درجہ ۲", color: "#EF4444" },
  { en: "Level 3 · Critical", ur: "درجہ ۳ · سنگین", color: "#DC2626" },
];

function EscalationBadge({ level }: { level: number }) {
  const { t } = useLang();
  const l = LEVELS[Math.min(3, Math.max(0, level))];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold"
      style={{ color: l.color, borderColor: `${l.color}66`, background: `${l.color}1F` }}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-1 rounded-sm" style={{ background: i < level ? l.color : `${l.color}33` }} />
        ))}
      </span>
      {t(l.en, l.ur)}
    </span>
  );
}

function IncidentCard({
  incident,
  selected,
  onSelect,
}: {
  incident: IncidentDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLang();
  const now = useNow(30_000);
  const tickets = useLive((s) => s.tickets);
  const openTicket = useUI((s) => s.openTicket);
  const meta = CATEGORY_META[incident.category];
  const linked = useMemo(
    () => tickets.filter((x) => x.incidentId === incident.id).sort((a, b) => b.createdAt - a.createdAt),
    [tickets, incident.id],
  );
  const active = incident.status === "active";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-2xl border bg-panel transition-colors duration-200",
        selected ? "border-danger/60 shadow-[0_0_0_1px_rgb(239_68_68/0.25)]" : "border-line hover:border-[#2a3757]",
        !active && "opacity-70",
      )}
    >
      <button type="button" onClick={onSelect} aria-expanded={selected} className="w-full p-5 text-start">
        <div className="flex items-start gap-4">
          <div className="relative">
            <CategoryTile category={incident.category} size="lg" />
            {active && <span className="blink absolute -top-1 -end-1 size-3 rounded-full border-2 border-panel bg-danger" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-fg">
                <span style={{ color: meta.color }}>{t(meta.en, meta.ur)}</span> · {t(incident.areaEn, incident.areaUr)}
              </h3>
              <EscalationBadge level={incident.escalationLevel} />
              {!active && (
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-live/40 bg-live/10 px-2.5 text-xs font-medium text-live">
                  <ShieldCheck className="size-3.5" /> Closed
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-dim tnum">
              Incident #{incident.id} · first report {formatTime(incident.firstReportAt)} · latest{" "}
              {timeAgo(incident.latestReportAt, now)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-4xl leading-none font-semibold text-danger tnum">{incident.ticketCount}</p>
            <p className="mt-1 text-[11px] text-dim">
              <Bi en="reports" ur="شکایات" only />
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-ink/50 p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-dim uppercase">
            <Sparkles className="size-3.5 text-live" /> AI summary
          </p>
          <p className="mt-1.5 text-[15px] text-fg">{incident.summary}</p>
          <Ur as="p" className="mt-1 text-base text-dim">
            {incident.summaryUr}
          </Ur>
        </div>
      </button>

      {selected && (
        <div className="border-t border-line px-5 pt-3 pb-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-dim uppercase">
            <Bi en="Linked tickets" ur="منسلک شکایات" only />
          </p>
          {linked.length === 0 ? (
            <p className="py-2 text-sm text-dim">No linked tickets.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {linked.map((x) => (
                <li key={x.ticketNo}>
                  <button
                    type="button"
                    onClick={() => openTicket(x.ticketNo)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-start transition-colors hover:border-line hover:bg-panel-2"
                  >
                    <span className="w-20 shrink-0 text-sm font-semibold text-fg tnum">{x.ticketNo}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-dim">{x.descriptionEn}</span>
                    <StatusBadge status={x.status} className="h-5 px-2 text-[11px]" />
                    <SlaChip ticket={x} className="h-5 px-2 text-[11px]" />
                    <span className="w-16 shrink-0 text-end text-xs text-dim tnum">{timeAgo(x.createdAt, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.article>
  );
}

function Body() {
  const router = useRouter();
  const params = useSearchParams();
  const incidents = useLive((s) => s.incidents);
  const tickets = useLive((s) => s.tickets);
  const fresh = useLive((s) => s.fresh);
  const loaded = useLive((s) => s.loaded);
  const error = useLive((s) => s.error);
  const openTicket = useUI((s) => s.openTicket);
  const drawer = useUI((s) => s.drawerTicketNo);

  const sorted = useMemo(
    () =>
      [...incidents].sort(
        (a, b) => Number(b.status === "active") - Number(a.status === "active") || b.updatedAt - a.updatedAt,
      ),
    [incidents],
  );
  const focusId = Number(params.get("focus")) || sorted[0]?.id || null;
  const selected = sorted.find((i) => i.id === focusId) ?? null;

  const focus: MapFocus | null = selected
    ? { lat: selected.lat, lng: selected.lng, zoom: 13.6, key: selected.id }
    : null;
  // The map shows the selected incident's tickets in full colour; everything else stays off it.
  const mapTickets = useMemo(
    () => (selected ? tickets.filter((x) => x.incidentId === selected.id) : tickets.filter((x) => x.incidentId != null)),
    [tickets, selected],
  );
  const active = sorted.filter((i) => i.status === "active").length;

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader
        en="Incidents"
        ur="واقعات"
        hint="Three or more similar complaints from one area within two hours are grouped into an incident and escalated."
      >
        <span className="flex items-center gap-2 rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger">
          <span className={cn("size-2 rounded-full bg-danger", active > 0 && "blink")} />
          <span className="tnum">{active}</span> active
        </span>
      </PageHeader>

      {error && !loaded ? (
        <ErrorState message={error} onRetry={() => useLive.getState().load()} />
      ) : !loaded ? (
        <LoadingState label="Loading incidents" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Siren}
          title="No incidents right now"
          titleUr="اس وقت کوئی واقعہ نہیں"
          hint="When three or more similar complaints arrive from the same area within two hours, Faryad groups them here and raises the alarm."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 px-8 py-5">
          <div className="scroll-thin flex min-h-0 flex-col gap-4 overflow-y-auto pe-1">
            {sorted.map((i) => (
              <IncidentCard
                key={i.id}
                incident={i}
                selected={i.id === selected?.id}
                onSelect={() => router.replace(`/incidents?focus=${i.id}`, { scroll: false })}
              />
            ))}
          </div>
          <div className="relative min-h-0 overflow-hidden rounded-2xl border border-line bg-panel">
            <CityMap
              tickets={mapTickets}
              incidents={selected ? [selected] : sorted}
              fresh={fresh}
              focus={focus}
              selectedTicketNo={drawer}
              onTicketClick={openTicket}
              onIncidentClick={(i) => router.replace(`/incidents?focus=${i.id}`, { scroll: false })}
            />
            {selected && (
              <div className="pointer-events-none absolute start-4 top-4 rounded-lg border border-line bg-ink/85 px-3 py-2 text-xs text-dim backdrop-blur">
                <span className="font-semibold text-fg">{selected.areaEn}</span> · {selected.ticketCount} linked reports
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IncidentsPage() {
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
