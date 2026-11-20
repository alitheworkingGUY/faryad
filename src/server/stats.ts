import { gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { CATEGORIES, type Category, type StatsDTO } from "@/lib/domain";
import { hourPK, startOfTodayPK } from "@/lib/format";
import { refs } from "./dto";

export function getStats(): StatsDTO {
  const since = startOfTodayPK();
  const calls = db().select().from(schema.calls).where(gte(schema.calls.startedAt, since)).all();
  const done = calls.filter((c) => c.endedAt != null && c.seconds > 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    callsToday: calls.length,
    avgHandlingSeconds: Math.round(avg(done.map((c) => c.seconds))),
    avgCostPkr: Number(avg(done.map((c) => c.costPkr)).toFixed(2)),
  };
}

export type AnalyticsSummary = {
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

export function getAnalytics(): AnalyticsSummary {
  const now = Date.now();
  const since = startOfTodayPK(now);
  const d = db();
  const r = refs();
  const tickets = d.select().from(schema.tickets).where(gte(schema.tickets.createdAt, since)).all();
  const calls = d.select().from(schema.calls).where(gte(schema.calls.startedAt, since)).all();
  const incidents = d.select().from(schema.incidents).all();
  const stats = getStats();

  const breached = (t: (typeof tickets)[number]) =>
    t.status === "resolved" ? (t.resolvedAt ?? 0) > t.slaDueAt : now > t.slaDueAt;

  const resolved = tickets.filter((t) => t.status === "resolved");
  const resolutionMinutes = resolved
    .filter((t) => t.resolvedAt != null)
    .map((t) => ((t.resolvedAt as number) - t.createdAt) / 60_000);

  const currentHour = hourPK(now);
  const firstHour = Math.max(0, Math.min(currentHour - 11, ...calls.map((c) => hourPK(c.startedAt))));
  const callsPerHour = [];
  for (let h = firstHour; h <= currentHour; h++) {
    callsPerHour.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      calls: calls.filter((c) => hourPK(c.startedAt) === h).length,
      tickets: tickets.filter((t) => hourPK(t.createdAt) === h).length,
    });
  }

  const areaCounts = new Map<number, number>();
  for (const t of tickets) {
    if (t.areaId != null) areaCounts.set(t.areaId, (areaCounts.get(t.areaId) ?? 0) + 1);
  }

  return {
    generatedAt: now,
    totals: {
      callsToday: stats.callsToday,
      ticketsToday: tickets.length,
      open: tickets.filter((t) => t.status !== "resolved").length,
      resolvedToday: resolved.length,
      resolvedPct: tickets.length ? Math.round((resolved.length / tickets.length) * 100) : 0,
      avgHandlingSeconds: stats.avgHandlingSeconds,
      avgResolutionMinutes: resolutionMinutes.length
        ? Math.round(resolutionMinutes.reduce((a, b) => a + b, 0) / resolutionMinutes.length)
        : 0,
      slaBreaches: tickets.filter(breached).length,
      avgCostPkr: stats.avgCostPkr,
      totalCostPkr: Number(calls.reduce((a, c) => a + c.costPkr, 0).toFixed(2)),
      activeIncidents: incidents.filter((i) => i.status === "active").length,
      gpsShare: tickets.filter((t) => t.locationSource === "gps").length,
    },
    callsPerHour,
    byCategory: CATEGORIES.map((category) => ({
      category,
      count: tickets.filter((t) => t.category === category).length,
    })),
    byArea: [...areaCounts.entries()]
      .map(([id, count]) => ({
        area: r.areas.get(id)?.nameEn ?? "Unknown",
        areaUr: r.areas.get(id)?.nameUr ?? "",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    byDepartment: [...r.depts.values()].map((dept) => {
      const mine = tickets.filter((t) => t.departmentId === dept.id);
      return {
        code: dept.code,
        total: mine.length,
        open: mine.filter((t) => t.status !== "resolved").length,
        resolved: mine.filter((t) => t.status === "resolved").length,
        breached: mine.filter(breached).length,
      };
    }),
    byStatus: ["open", "assigned", "in_progress", "resolved"].map((status) => ({
      status,
      count: tickets.filter((t) => t.status === status).length,
    })),
  };
}
