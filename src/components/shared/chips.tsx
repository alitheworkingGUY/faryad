"use client";

import { Check, Clock, TriangleAlert } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import {
  PRIORITY_META,
  STATUS_META,
  type Priority,
  type Status,
  type TicketDTO,
} from "@/lib/domain";
import { slaInfo } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap tnum";

function tint(color: string): React.CSSProperties {
  return { color, background: `${color}1A`, borderColor: `${color}4D` };
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useLang();
  const m = STATUS_META[status];
  return (
    <span className={cn(base, className)} style={tint(m.color)}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {t(m.en, m.ur)}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { t } = useLang();
  const m = PRIORITY_META[priority];
  return (
    <span className={cn(base, className)} style={tint(m.color)}>
      {t(m.en, m.ur)}
    </span>
  );
}

export function DeptChip({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-md border border-line bg-panel-2 px-2 text-[11px] font-semibold tracking-wide text-fg",
        className,
      )}
    >
      {code}
    </span>
  );
}

const SLA_COLORS = { ok: "#10B981", warn: "#F59E0B", breach: "#EF4444", done: "#94A3B8" } as const;

/** SLA countdown: green -> amber (last quarter of the window) -> red (overdue). */
export function SlaChip({
  ticket,
  className,
}: {
  ticket: Pick<TicketDTO, "slaDueAt" | "createdAt" | "status" | "resolvedAt">;
  className?: string;
}) {
  const now = useNow(30_000);
  const info = slaInfo(ticket, now);
  const Icon = info.state === "done" ? Check : info.state === "breach" ? TriangleAlert : Clock;
  return (
    <span className={cn(base, className)} style={tint(SLA_COLORS[info.state])}>
      <Icon className="size-3" aria-hidden="true" />
      {info.label}
    </span>
  );
}
