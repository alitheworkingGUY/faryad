"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { useNow } from "@/hooks/use-now";
import { clock, PK_TZ, startOfTodayPK } from "@/lib/format";
import { Bi } from "@/lib/i18n";
import { useLive } from "@/lib/store";
import { cn } from "@/lib/utils";

function Counter({
  en,
  ur,
  value,
  format,
  tone = "default",
}: {
  en: string;
  ur: string;
  value: number;
  format?: (n: number) => string;
  tone?: "default" | "live" | "danger" | "warn";
}) {
  const color =
    tone === "live" ? "text-live" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="flex min-w-[132px] flex-col justify-center rounded-xl border border-line bg-panel px-4 py-2.5">
      <AnimatedNumber
        value={value}
        format={format}
        className={cn("text-[34px] leading-none font-semibold tracking-tight tnum", color)}
      />
      <span className="mt-1.5 text-xs font-medium text-dim">
        <Bi en={en} ur={ur} secondaryClassName="text-[11px]" />
      </span>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: PK_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--:--";
  const date = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone: PK_TZ, weekday: "short", day: "2-digit", month: "short" }).format(now)
    : "";
  return (
    <div className="text-end leading-none" dir="ltr">
      <div className="text-[30px] font-semibold tracking-tight text-fg tnum">{time}</div>
      <div className="mt-1.5 text-xs text-dim">{date} · PKT</div>
    </div>
  );
}

function AgentStatus() {
  const connected = useLive((s) => s.connected);
  const aiReady = useLive((s) => s.aiReady);
  const loaded = useLive((s) => s.loaded);
  const state = !connected ? "offline" : aiReady || !loaded ? "online" : "nokey";
  const color = state === "online" ? "#10B981" : state === "nokey" ? "#F59E0B" : "#EF4444";
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
      style={{ borderColor: `${color}55`, background: `${color}14` }}
    >
      <span className="relative grid size-3.5 place-items-center">
        {state === "online" && <span className="pulse-ring absolute size-3.5 rounded-full" style={{ background: color }} />}
        <span className="relative size-2.5 rounded-full" style={{ background: color }} />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold" style={{ color }}>
          {state === "online" ? (
            <Bi en="AI Agent Online" ur="اے آئی ایجنٹ آن لائن" only />
          ) : state === "nokey" ? (
            <Bi en="AI key not set" ur="اے آئی کلید موجود نہیں" only />
          ) : (
            <Bi en="Reconnecting…" ur="دوبارہ رابطہ ہو رہا ہے" only />
          )}
        </div>
        <div className="text-[11px] text-dim">
          <Bi en="24/7 Urdu helpline" ur="چوبیس گھنٹے اردو ہیلپ لائن" only />
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const tickets = useLive((s) => s.tickets);
  const stats = useLive((s) => s.stats);
  const now = useNow(20_000);

  const counts = useMemo(() => {
    const today = startOfTodayPK(now);
    return {
      open: tickets.filter((t) => t.status !== "resolved").length,
      resolvedToday: tickets.filter((t) => t.status === "resolved" && (t.resolvedAt ?? 0) >= today).length,
      breaches: tickets.filter((t) => t.status !== "resolved" && t.slaDueAt < now).length,
    };
  }, [tickets, now]);

  return (
    <header className="flex h-[96px] shrink-0 items-center gap-5 px-4">
      <div className="min-w-0 shrink-0 pe-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[26px] leading-none font-semibold tracking-tight text-fg">Faryad</span>
          <span dir="rtl" lang="ur" className="ur ur-tight text-xl leading-none text-live">
            فریاد
          </span>
        </div>
        <div className="mt-2 text-sm text-dim">
          <Bi en="Peshawar Command Center" ur="پشاور کمانڈ سینٹر" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-stretch justify-center gap-3">
        <Counter en="Calls today" ur="آج کی کالز" value={stats.callsToday} />
        <Counter en="Open" ur="زیرِ کارروائی" value={counts.open} tone="warn" />
        <Counter en="Resolved today" ur="آج حل شدہ" value={counts.resolvedToday} tone="live" />
        <Counter en="Avg handling" ur="اوسط دورانیہ" value={stats.avgHandlingSeconds} format={clock} />
        <Counter
          en="SLA breaches"
          ur="مدت سے تجاوز"
          value={counts.breaches}
          tone={counts.breaches > 0 ? "danger" : "default"}
        />
      </div>

      <AgentStatus />
      <LiveClock />
    </header>
  );
}
