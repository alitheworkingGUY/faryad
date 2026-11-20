"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, PageHeader } from "@/components/shared/app-shell";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Panel } from "@/components/shared/controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { api } from "@/lib/api";
import { CATEGORY_META, type Category } from "@/lib/domain";
import { clock, formatTime } from "@/lib/format";
import { Bi } from "@/lib/i18n";
import { onLiveEvent } from "@/lib/store";
import { cn } from "@/lib/utils";

type Summary = {
  generatedAt: number;
  totals: {
    callsToday: number;
    ticketsToday: number;
    open: number;
    resolvedToday: number;
    resolvedPct: number;
    avgHandlingSeconds: number;
    avgResolutionMinutes: number;
    slaBreaches: number;
    avgCostPkr: number;
    totalCostPkr: number;
    activeIncidents: number;
    gpsShare: number;
  };
  callsPerHour: { hour: number; label: string; calls: number; tickets: number }[];
  byCategory: { category: Category; count: number }[];
  byArea: { area: string; areaUr: string; count: number }[];
  byDepartment: { code: string; total: number; open: number; resolved: number; breached: number }[];
  byStatus: { status: string; count: number }[];
};

const AXIS = { fill: "#94A3B8", fontSize: 12 };
const GRID = "#1F2A44";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-ink/95 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="mb-1 font-medium text-fg">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-dim">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill ?? "#10B981" }} />
          {p.name}: <span className="font-semibold text-fg tnum">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function Kpi({
  en,
  ur,
  value,
  format,
  suffix,
  tone = "default",
  note,
}: {
  en: string;
  ur: string;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  tone?: "default" | "live" | "warn" | "danger";
  note?: string;
}) {
  const color =
    tone === "live" ? "text-live" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
      <p className="text-xs font-medium text-dim">
        <Bi en={en} ur={ur} secondaryClassName="text-[11px]" />
      </p>
      <p className={cn("mt-2 text-4xl leading-none font-semibold tracking-tight tnum", color)}>
        <AnimatedNumber value={value} format={format} />
        {suffix && <span className="ms-1 text-lg font-medium text-dim">{suffix}</span>}
      </p>
      {note && <p className="mt-2 text-xs text-dim">{note}</p>}
    </div>
  );
}

function Body() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api<Summary>("/api/analytics/summary"));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    // Any ticket or call activity refreshes the numbers (batched, at most once a second).
    const off = onLiveEvent((e) => {
      if (e.type === "call.transcript" || e.type === "call.fields" || e.type === "call.metrics") return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 800);
    });
    const poll = setInterval(load, 60_000);
    return () => {
      off();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (error && !data) return <ErrorState message={error} onRetry={load} className="h-dvh" />;
  if (!data) return <LoadingState label="Loading analytics" className="h-dvh" />;

  const t = data.totals;
  const categories = data.byCategory.filter((c) => c.count > 0);
  const empty = t.ticketsToday === 0 && t.callsToday === 0;

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader en="Analytics" ur="تجزیات" hint="Today's helpline performance, updated live.">
        <span className="text-xs text-dim">
          Updated <span className="tnum">{formatTime(data.generatedAt)}</span> PKT
        </span>
      </PageHeader>

      {empty ? (
        <EmptyState
          title="No activity yet today"
          titleUr="آج ابھی کوئی سرگرمی نہیں"
          hint="Charts fill in as calls come in. Reset the demo data in Settings to load the sample day."
        />
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="grid grid-cols-6 gap-4">
            <Kpi en="Calls today" ur="آج کی کالز" value={t.callsToday} />
            <Kpi en="Tickets today" ur="آج کی شکایات" value={t.ticketsToday} note={`${t.open} still open`} />
            <Kpi en="Resolved" ur="حل شدہ" value={t.resolvedPct} suffix="%" tone="live" note={`${t.resolvedToday} tickets`} />
            <Kpi en="Avg handling time" ur="اوسط دورانیہ" value={t.avgHandlingSeconds} format={clock} note="per call" />
            <Kpi
              en="SLA breaches"
              ur="مدت سے تجاوز"
              value={t.slaBreaches}
              tone={t.slaBreaches > 0 ? "danger" : "default"}
              note={`${t.activeIncidents} active incident${t.activeIncidents === 1 ? "" : "s"}`}
            />
            <Kpi
              en="Avg cost per call"
              ur="فی کال لاگت"
              value={t.avgCostPkr}
              format={(n) => `PKR ${n.toFixed(1)}`}
              note={`PKR ${t.totalCostPkr.toFixed(0)} today`}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <Panel title="Calls per hour" titleUr="فی گھنٹہ کالز" className="col-span-2 h-[340px]" bodyClassName="p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.callsPerHour} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="calls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="1" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tix" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#38BDF8" stopOpacity={0.3} />
                      <stop offset="1" stopColor="#38BDF8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#2a3757" }} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    name="Calls"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#calls)"
                    animationDuration={400}
                  />
                  <Area
                    type="monotone"
                    dataKey="tickets"
                    name="Tickets"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fill="url(#tix)"
                    animationDuration={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="By category" titleUr="قسم کے لحاظ سے" className="h-[340px]" bodyClassName="p-4">
              <div className="flex h-full items-center gap-2">
                <div className="relative h-full min-w-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="count"
                        nameKey="category"
                        innerRadius="58%"
                        outerRadius="88%"
                        paddingAngle={2}
                        stroke="#111A2E"
                        strokeWidth={3}
                        animationDuration={400}
                      >
                        {categories.map((c) => (
                          <Cell key={c.category} fill={CATEGORY_META[c.category].color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-3xl leading-none font-semibold text-fg tnum">{t.ticketsToday}</p>
                      <p className="mt-1 text-[11px] text-dim">tickets</p>
                    </div>
                  </div>
                </div>
                <ul className="flex w-40 shrink-0 flex-col gap-2">
                  {data.byCategory.map((c) => (
                    <li key={c.category} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full" style={{ background: CATEGORY_META[c.category].color }} />
                      <span className="flex-1 text-dim">{CATEGORY_META[c.category].en}</span>
                      <span className="font-semibold text-fg tnum">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel title="Busiest areas" titleUr="مصروف ترین علاقے" className="col-span-2 h-[340px]" bodyClassName="p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byArea} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
                  <YAxis type="category" dataKey="area" tick={AXIS} tickLine={false} axisLine={false} width={150} interval={0} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "#16213A" }} />
                  <Bar dataKey="count" name="Tickets" fill="#10B981" radius={[0, 6, 6, 0]} barSize={16} animationDuration={400} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="By department" titleUr="محکمہ وار" className="h-[340px]">
              <ul className="flex h-full flex-col justify-center gap-5">
                {data.byDepartment.map((d) => {
                  const pct = d.total ? Math.round((d.resolved / d.total) * 100) : 0;
                  return (
                    <li key={d.code}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-semibold text-fg">{d.code}</span>
                        <span className="text-xs text-dim">
                          <span className="font-semibold text-fg tnum">{d.resolved}</span> of{" "}
                          <span className="tnum">{d.total}</span> resolved
                          {d.breached > 0 && <span className="ms-2 text-danger">· {d.breached} late</span>}
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" dir="ltr">
                        <div
                          className="h-full rounded-full bg-live transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
                <li className="border-t border-line pt-4 text-xs text-dim">
                  Average time to resolve:{" "}
                  <span className="font-semibold text-fg tnum">{t.avgResolutionMinutes} min</span> ·{" "}
                  <span className="font-semibold text-fg tnum">{t.gpsShare}</span> tickets with exact GPS
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
