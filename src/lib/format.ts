// Formatting helpers shared by server and browser.

export const PK_TZ = "Asia/Karachi";

const URDU_DIGIT_WORDS = ["صفر", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو"];
const URDU_NUMERALS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** "FRD-1031" -> "ایف آر ڈی، ایک، صفر، تین، ایک" (read digit by digit). */
export function ticketNoSpokenUr(ticketNo: string): string {
  const digits = ticketNo.replace(/\D/g, "");
  const words = digits.split("").map((d) => URDU_DIGIT_WORDS[Number(d)]);
  return `ایف آر ڈی، ${words.join("، ")}`;
}

/** 1031 -> "۱۰۳۱" */
export function toUrduNumerals(value: number | string): string {
  return String(value).replace(/\d/g, (d) => URDU_NUMERALS[Number(d)]);
}

/** Normalises anything a caller might say ("1031", "frd 1031", "FRD-1031") to "FRD-1031". */
export function normalizeTicketNo(input: string): string | null {
  const urToAscii = input.replace(/[۰-۹]/g, (d) => String(URDU_NUMERALS.indexOf(d)));
  const digits = urToAscii.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 6) return null;
  return `FRD-${digits}`;
}

export function digitsOnly(phone: string): string {
  return phone.replace(/[۰-۹]/g, (d) => String(URDU_NUMERALS.indexOf(d))).replace(/\D/g, "");
}

/** Stored in full, shown as 03xx-xxx-1234. */
export function maskPhone(phone: string | null | undefined): string {
  const d = digitsOnly(phone ?? "");
  if (d.length < 4) return "03xx-xxx-xxxx";
  return `03xx-xxx-${d.slice(-4)}`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function timeAgoUr(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "ابھی";
  const m = Math.round(s / 60);
  if (m < 60) return `${toUrduNumerals(m)} منٹ پہلے`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${toUrduNumerals(h)} گھنٹے پہلے`;
  return `${toUrduNumerals(Math.floor(h / 24))} دن پہلے`;
}

/** 95 -> "1:35" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Duration in words: "2m 05s" */
export function durationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ts);
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PK_TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ts);
}

/** Midnight today in Pakistan, as epoch ms. Pakistan has no DST (UTC+5). */
export function startOfTodayPK(now = Date.now()): number {
  const offset = 5 * 60 * 60 * 1000;
  const local = now + offset;
  return local - (local % 86_400_000) - offset;
}

/** Hour of day (0-23) in Pakistan. */
export function hourPK(ts: number): number {
  return Math.floor(((ts + 5 * 3_600_000) % 86_400_000) / 3_600_000);
}

export type SlaState = "ok" | "warn" | "breach" | "done";

/** Remaining SLA as a state + label. Amber in the last 25% of the window. */
export function slaInfo(
  t: { slaDueAt: number; createdAt: number; status: string; resolvedAt: number | null },
  now = Date.now(),
): { state: SlaState; label: string; remainingMs: number } {
  if (t.status === "resolved") {
    const late = t.resolvedAt != null && t.resolvedAt > t.slaDueAt;
    return { state: late ? "breach" : "done", label: late ? "Resolved late" : "Resolved", remainingMs: 0 };
  }
  const remaining = t.slaDueAt - now;
  const total = Math.max(1, t.slaDueAt - t.createdAt);
  const abs = Math.abs(remaining);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const text = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  if (remaining <= 0) return { state: "breach", label: `Overdue ${text}`, remainingMs: remaining };
  if (remaining / total <= 0.25) return { state: "warn", label: `${text} left`, remainingMs: remaining };
  return { state: "ok", label: `${text} left`, remainingMs: remaining };
}

export function pkr(value: number, digits = 2): string {
  return `PKR ${value.toLocaleString("en-PK", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
