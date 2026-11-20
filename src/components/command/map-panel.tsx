"use client";

import { CheckCheck, Flame, Maximize, Minimize } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CityMap } from "@/components/map";
import { CATEGORY_ICONS } from "@/components/shared/category";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/domain";
import { Bi, useLang } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

export type MapLayers = {
  hidden: Category[];
  heatmap: boolean;
  showResolved: boolean;
  fullscreen: boolean;
};

function Toggle({
  active,
  onClick,
  children,
  shortcut,
  color = "#10B981",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium backdrop-blur transition-colors duration-200",
        active ? "text-fg" : "border-line bg-ink/80 text-dim hover:text-fg",
      )}
      style={active ? { borderColor: `${color}80`, background: `${color}26` } : undefined}
    >
      {children}
      {shortcut && (
        <kbd className="rounded border border-line bg-ink/70 px-1.5 text-[10px] leading-4 font-semibold text-dim">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function MapPanel({
  layers,
  onChange,
  onToggleFullscreen,
}: {
  layers: MapLayers;
  onChange: (next: Partial<MapLayers>) => void;
  onToggleFullscreen: () => void;
}) {
  const router = useRouter();
  const { t } = useLang();
  const tickets = useLive((s) => s.tickets);
  const incidents = useLive((s) => s.incidents);
  const fresh = useLive((s) => s.fresh);
  const loaded = useLive((s) => s.loaded);
  const openTicket = useUI((s) => s.openTicket);
  const selected = useUI((s) => s.drawerTicketNo);

  const visible = useMemo(
    () =>
      tickets.filter(
        (x) => !layers.hidden.includes(x.category) && (layers.showResolved || x.status !== "resolved"),
      ),
    [tickets, layers.hidden, layers.showResolved],
  );

  const counts = useMemo(() => {
    const out = {} as Record<Category, number>;
    for (const c of CATEGORIES) out[c] = 0;
    for (const x of tickets) if (layers.showResolved || x.status !== "resolved") out[x.category]++;
    return out;
  }, [tickets, layers.showResolved]);

  const activeIncidents = incidents.filter(
    (i) => i.status === "active" && !layers.hidden.includes(i.category),
  );

  return (
    <section className="relative min-h-0 overflow-hidden rounded-2xl border border-line bg-panel">
      <CityMap
        tickets={visible}
        incidents={activeIncidents}
        fresh={fresh}
        heatmap={layers.heatmap}
        selectedTicketNo={selected}
        onTicketClick={openTicket}
        onIncidentClick={(i) => router.push(`/incidents?focus=${i.id}`)}
      />

      {/* Category filters */}
      <div className="absolute start-4 top-4 flex max-w-[calc(100%-19rem)] flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const Icon = CATEGORY_ICONS[c];
          const on = !layers.hidden.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange({ hidden: on ? [...layers.hidden, c] : layers.hidden.filter((x) => x !== c) })
              }
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium backdrop-blur transition-all duration-200",
                on ? "bg-ink/85 text-fg" : "border-line bg-ink/60 text-dim/70 line-through decoration-dim/40",
              )}
              style={on ? { borderColor: `${meta.color}66` } : undefined}
            >
              <Icon className="size-4" style={{ color: on ? meta.color : undefined }} />
              {t(meta.en, meta.ur)}
              <span className="text-xs text-dim tnum">{counts[c]}</span>
            </button>
          );
        })}
      </div>

      {/* Layer toggles */}
      <div className="absolute end-4 top-4 flex gap-2">
        <Toggle active={layers.heatmap} onClick={() => onChange({ heatmap: !layers.heatmap })} shortcut="M" color="#F59E0B">
          <Flame className="size-4" /> <Bi en="Heatmap" ur="ہیٹ میپ" only />
        </Toggle>
        <Toggle active={layers.showResolved} onClick={() => onChange({ showResolved: !layers.showResolved })}>
          <CheckCheck className="size-4" /> <Bi en="Resolved" ur="حل شدہ" only />
        </Toggle>
        <Toggle active={layers.fullscreen} onClick={onToggleFullscreen} shortcut="F">
          {layers.fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </Toggle>
      </div>

      {/* Footer legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-lg border border-line bg-ink/85 px-3 py-2 text-xs text-dim backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-live" />
          <span className="font-semibold text-fg tnum">{loaded ? visible.length : "—"}</span>
          <Bi en="complaints on map" ur="شکایات نقشے پر" only />
        </span>
        {activeIncidents.length > 0 && (
          <span className="flex items-center gap-1.5 border-s border-line ps-3 text-danger">
            <span className="blink size-2 rounded-full bg-danger" />
            <span className="font-semibold tnum">{activeIncidents.length}</span>
            <Bi en={activeIncidents.length === 1 ? "active incident" : "active incidents"} ur="فعال واقعات" only />
          </span>
        )}
      </div>
    </section>
  );
}
