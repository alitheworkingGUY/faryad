"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Inbox, LocateFixed } from "lucide-react";
import { CategoryTile } from "@/components/shared/category";
import { DeptChip, SlaChip, StatusBadge } from "@/components/shared/chips";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { SmartText } from "@/components/shared/transcript";
import { useNow } from "@/hooks/use-now";
import type { TicketDTO } from "@/lib/domain";
import { timeAgo } from "@/lib/format";
import { Bi, useLang } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function Row({ ticket, fresh, now }: { ticket: TicketDTO; fresh: boolean; now: number }) {
  const { t, isUr } = useLang();
  const openTicket = useUI((s) => s.openTicket);
  return (
    <motion.li
      layout="position"
      initial={fresh ? { opacity: 0, x: 40, scale: 0.98 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        onClick={() => openTicket(ticket.ticketNo)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors duration-200",
          fresh
            ? "border-live/50 bg-live/10"
            : "border-transparent hover:border-line hover:bg-panel-2",
        )}
      >
        <CategoryTile category={ticket.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-fg tnum">{ticket.ticketNo}</span>
            <span className="truncate text-sm text-dim">{t(ticket.areaEn, ticket.areaUr)}</span>
            {ticket.locationSource === "gps" && <LocateFixed className="size-3.5 shrink-0 text-live" aria-label="GPS" />}
            {fresh && (
              <span className="rounded-full bg-live px-1.5 text-[10px] leading-4 font-bold tracking-wide text-ink uppercase">
                New
              </span>
            )}
          </div>
          <SmartText
            text={isUr ? ticket.descriptionUr : ticket.descriptionEn}
            className="mt-0.5 truncate text-[13px] !leading-snug text-dim"
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <DeptChip code={ticket.departmentCode} />
            <SlaChip ticket={ticket} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-dim">
            <StatusBadge status={ticket.status} className="h-5 px-2 text-[11px]" />
            <span className="tnum">{timeAgo(ticket.createdAt, now)}</span>
          </div>
        </div>
      </button>
    </motion.li>
  );
}

export function TicketFeed() {
  const tickets = useLive((s) => s.tickets);
  const fresh = useLive((s) => s.fresh);
  const loaded = useLive((s) => s.loaded);
  const now = useNow(15_000);
  const list = tickets.slice(0, 40);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">
          <Bi en="Ticket feed" ur="تازہ شکایات" secondaryClassName="normal-case" />
        </h2>
        <span className="text-xs text-dim">
          <span className="font-semibold text-fg tnum">{tickets.length}</span> <Bi en="today" ur="آج" only />
        </span>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {!loaded ? (
          <LoadingState label="Loading tickets" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No complaints yet"
            titleUr="ابھی کوئی شکایت نہیں"
            hint="New complaints appear here the moment a call is registered."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {list.map((t) => (
                <Row
                  key={t.ticketNo}
                  ticket={t}
                  now={now}
                  fresh={Boolean(fresh[t.ticketNo] && now - fresh[t.ticketNo] < 20_000)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
