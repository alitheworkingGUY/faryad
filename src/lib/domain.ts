// Shared domain vocabulary (safe to import from both server and browser code).

export const CATEGORIES = [
  "water",
  "sewerage",
  "garbage",
  "streetlight",
  "road",
  "electricity",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["open", "assigned", "in_progress", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type LocationSource = "area" | "gps" | "manual";

export const CATEGORY_META: Record<
  Category,
  { en: string; ur: string; color: string; issueEn: string; issueUr: string }
> = {
  water: {
    en: "Water",
    ur: "پانی",
    color: "#38BDF8",
    issueEn: "water supply",
    issueUr: "پانی کی فراہمی",
  },
  sewerage: {
    en: "Sewerage",
    ur: "نکاسی آب",
    color: "#A78BFA",
    issueEn: "sewerage",
    issueUr: "نکاسی آب",
  },
  garbage: {
    en: "Garbage",
    ur: "کچرا",
    color: "#F97316",
    issueEn: "garbage collection",
    issueUr: "کچرے کی صفائی",
  },
  streetlight: {
    en: "Streetlight",
    ur: "سٹریٹ لائٹ",
    color: "#FACC15",
    issueEn: "streetlights",
    issueUr: "سٹریٹ لائٹس",
  },
  road: {
    en: "Road",
    ur: "سڑک",
    color: "#94A3B8",
    issueEn: "road damage",
    issueUr: "سڑک کی خرابی",
  },
  electricity: {
    en: "Electricity",
    ur: "بجلی",
    color: "#F43F5E",
    issueEn: "electricity",
    issueUr: "بجلی",
  },
};

export const STATUS_META: Record<Status, { en: string; ur: string; color: string }> = {
  open: { en: "Open", ur: "نئی", color: "#F59E0B" },
  assigned: { en: "Assigned", ur: "تفویض شدہ", color: "#38BDF8" },
  in_progress: { en: "In progress", ur: "کام جاری", color: "#A78BFA" },
  resolved: { en: "Resolved", ur: "حل شدہ", color: "#10B981" },
};

export const PRIORITY_META: Record<Priority, { en: string; ur: string; color: string }> = {
  low: { en: "Low", ur: "کم", color: "#94A3B8" },
  normal: { en: "Normal", ur: "عام", color: "#38BDF8" },
  high: { en: "High", ur: "اہم", color: "#F59E0B" },
  urgent: { en: "Urgent", ur: "فوری", color: "#EF4444" },
};

export const MOOD_META: Record<number, { en: string; ur: string; color: string }> = {
  1: { en: "Very upset", ur: "بہت ناراض", color: "#EF4444" },
  2: { en: "Upset", ur: "ناراض", color: "#F97316" },
  3: { en: "Neutral", ur: "معمول", color: "#F59E0B" },
  4: { en: "Calm", ur: "پُرسکون", color: "#84CC16" },
  5: { en: "Satisfied", ur: "مطمئن", color: "#10B981" },
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

// ---------- DTOs sent over the API / SSE ----------

export type AreaDTO = {
  id: number;
  nameEn: string;
  nameUr: string;
  lat: number;
  lng: number;
};

export type DepartmentDTO = {
  id: number;
  code: string;
  name: string;
  nameUr: string;
  categories: Category[];
  slaHours: number;
  slaByCategory: Partial<Record<Category, number>>;
};

export type TicketDTO = {
  id: number;
  ticketNo: string;
  callerName: string;
  phoneMasked: string;
  category: Category;
  areaId: number | null;
  areaEn: string;
  areaUr: string;
  lat: number;
  lng: number;
  locationSource: LocationSource;
  addressNote: string | null;
  descriptionUr: string;
  descriptionEn: string;
  status: Status;
  priority: Priority;
  departmentId: number | null;
  departmentCode: string;
  departmentName: string;
  incidentId: number | null;
  mood: number;
  slaHours: number;
  slaDueAt: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  resolutionNote: string | null;
  voiceNoteUrl: string | null;
  callId: string | null;
  assignee: string | null;
};

export type TicketEventDTO = {
  id: number;
  ticketId: number;
  type: "created" | "assigned" | "status_changed" | "note" | "voice_note_sent";
  text: string;
  actor: string;
  createdAt: number;
};

export type TranscriptLine = {
  /** Stable id for a line that is still being spoken, so screens can update it in place. */
  id?: string;
  role: "caller" | "agent";
  text: string;
  ts: number;
  /** false while the line is still streaming */
  final?: boolean;
};

export type CallFields = {
  name?: string;
  phone?: string;
  area?: string;
  category?: Category;
  description?: string;
  mood?: number;
};

export type CallDTO = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  seconds: number;
  transcript: TranscriptLine[];
  ticketId: number | null;
  ticketNo: string | null;
  costUsd: number;
  costPkr: number;
  fields: CallFields;
  phoneMasked: string | null;
  hasGps: boolean;
  simulated: boolean;
};

export type IncidentDTO = {
  id: number;
  category: Category;
  areaId: number;
  areaEn: string;
  areaUr: string;
  lat: number;
  lng: number;
  ticketCount: number;
  summary: string;
  summaryUr: string;
  escalationLevel: number;
  status: "active" | "resolved";
  createdAt: number;
  updatedAt: number;
  firstReportAt: number;
  latestReportAt: number;
  ticketNos: string[];
};

export type StatsDTO = {
  callsToday: number;
  avgHandlingSeconds: number;
  avgCostPkr: number;
};

export type LiveEvent =
  | { type: "call.started"; payload: CallDTO }
  | { type: "call.transcript"; payload: { callId: string; line: TranscriptLine } }
  | { type: "call.fields"; payload: { callId: string; fields: CallFields } }
  | {
      type: "call.metrics";
      payload: { callId: string; seconds: number; costUsd: number; costPkr: number };
    }
  | { type: "call.ended"; payload: { call: CallDTO; stats: StatsDTO } }
  | {
      type: "call.human_needed";
      payload: { callId: string; reason: string; phoneMasked: string | null };
    }
  | { type: "ticket.created"; payload: TicketDTO }
  | { type: "ticket.updated"; payload: TicketDTO }
  | { type: "incident.created"; payload: IncidentDTO }
  | { type: "incident.updated"; payload: IncidentDTO }
  | { type: "citizen.notify"; payload: { ticketNo: string; audioUrl: string | null } }
  | { type: "settings.updated"; payload: { publicBaseUrl: string | null } }
  | { type: "demo.reset"; payload: Record<string, never> };

export type LiveEventType = LiveEvent["type"];
