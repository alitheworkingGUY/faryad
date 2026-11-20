"use client";

import { AudioLines, CirclePlus, MessageSquare, RefreshCw, UserCheck, type LucideIcon } from "lucide-react";
import type { TicketEventDTO } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

const ICONS: Record<TicketEventDTO["type"], { icon: LucideIcon; color: string }> = {
  created: { icon: CirclePlus, color: "#10B981" },
  assigned: { icon: UserCheck, color: "#38BDF8" },
  status_changed: { icon: RefreshCw, color: "#A78BFA" },
  note: { icon: MessageSquare, color: "#94A3B8" },
  voice_note_sent: { icon: AudioLines, color: "#10B981" },
};

export function Timeline({ events }: { events: TicketEventDTO[] }) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-dim">No activity yet.</p>;
  }
  return (
    <ol className="relative flex flex-col gap-4 ps-1">
      <span className="absolute start-[15px] top-2 bottom-2 w-px bg-line" aria-hidden="true" />
      {events.map((e) => {
        const { icon: Icon, color } = ICONS[e.type] ?? ICONS.note;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className="z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-panel"
              style={{ borderColor: `${color}66`, color }}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-fg">{e.text}</p>
              <p className="mt-0.5 text-xs text-dim">
                {e.actor} · <span className="tnum">{formatDateTime(e.createdAt)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
