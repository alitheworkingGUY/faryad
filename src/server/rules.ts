import type { Category, Priority } from "@/lib/domain";

/** Priority from the kind of problem and how upset the caller sounded (1 = very upset, 5 = calm). */
export function priorityFor(category: Category, mood: number): Priority {
  const base: Record<Category, number> = {
    electricity: 2,
    water: 1,
    sewerage: 1,
    garbage: 1,
    road: 0,
    streetlight: 0,
  };
  const bump = mood <= 1 ? 2 : mood === 2 ? 1 : 0;
  const score = Math.min(3, base[category] + bump);
  return (["low", "normal", "high", "urgent"] as const)[score];
}

export function slaHoursFor(
  dept: { slaHours: number; slaByCategory: Partial<Record<Category, number>> } | undefined,
  category: Category,
): number {
  return dept?.slaByCategory?.[category] ?? dept?.slaHours ?? 24;
}

export function clampMood(mood: unknown): number {
  const n = Math.round(Number(mood));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

/** escalation_level = min(3, floor(count / 3)) */
export function escalationFor(count: number): number {
  return Math.min(3, Math.floor(count / 3));
}

export const INCIDENT_WINDOW_MS = 2 * 60 * 60 * 1000;
export const INCIDENT_THRESHOLD = 3;
