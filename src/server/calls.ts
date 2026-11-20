import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CallRow, TicketRow } from "@/db/schema";
import {
  CATEGORIES,
  isCategory,
  type CallDTO,
  type CallFields,
  type Category,
  type TranscriptLine,
} from "@/lib/domain";
import { digitsOnly } from "@/lib/format";
import { transcriptionCostUsd, usdToPkr } from "@/config/pricing";
import { isInPeshawar, listAreas, matchArea, nearestArea } from "./areas";
import { broadcast } from "./bus";
import { callDTO } from "./dto";
import { chatJson } from "./openai";
import { clampMood } from "./rules";
import { getStats } from "./stats";

const STALE_AFTER_MS = 20 * 60 * 1000;

export class CallError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getRow(id: string): CallRow | undefined {
  return db().select().from(schema.calls).where(eq(schema.calls.id, id)).get();
}

/** A phone that vanished mid-call (closed tab, lost signal) must not look "live" forever. */
function closeStaleCalls(): void {
  const cutoff = Date.now() - STALE_AFTER_MS;
  const stale = db()
    .select()
    .from(schema.calls)
    .where(and(isNull(schema.calls.endedAt), lt(schema.calls.startedAt, cutoff)))
    .all();
  for (const c of stale) endCall(c.id, {});
}

export function startCall(opts: { simulated?: boolean } = {}): CallDTO {
  closeStaleCalls();
  const now = Date.now();
  const row = db()
    .insert(schema.calls)
    .values({
      id: randomUUID(),
      startedAt: now,
      endedAt: null,
      seconds: 0,
      transcript: [],
      ticketId: null,
      costUsd: 0,
      costPkr: 0,
      fields: {},
      lat: null,
      lng: null,
      simulated: Boolean(opts.simulated),
    })
    .returning()
    .get();
  const dto = callDTO(row);
  broadcast({ type: "call.started", payload: dto });
  return dto;
}

export function getCall(id: string): CallDTO | null {
  const row = getRow(id);
  return row ? callDTO(row) : null;
}

/** Calls in progress, newest first (the Command Center shows the newest). */
export function activeCalls(): CallDTO[] {
  const cutoff = Date.now() - STALE_AFTER_MS;
  return db()
    .select()
    .from(schema.calls)
    .where(and(isNull(schema.calls.endedAt), gte(schema.calls.startedAt, cutoff)))
    .orderBy(desc(schema.calls.startedAt))
    .all()
    .map(callDTO);
}

export type CallEventInput =
  | { type: "transcript"; id?: string; role: "caller" | "agent"; text: string; final?: boolean; ts?: number }
  | { type: "fields"; fields: CallFields }
  | { type: "metrics"; seconds?: number; costUsd?: number }
  | { type: "gps"; lat: number; lng: number }
  | { type: "human_needed"; reason?: string };

export function addCallEvent(
  id: string,
  event: CallEventInput,
): { ok: true; nearestArea?: string | null; inServiceArea?: boolean } {
  const row = getRow(id);
  if (!row) throw new CallError("Call not found", 404);
  const d = db();

  switch (event.type) {
    case "transcript": {
      const text = String(event.text ?? "").trim();
      if (!text) return { ok: true };
      if (event.role !== "caller" && event.role !== "agent") throw new CallError("Unknown role");
      const final = event.final !== false;
      // The caller's words are transcribed a moment after the agent has already begun
      // answering, so the browser sends when each line started and we order by that.
      const now = Date.now();
      const sent = Number(event.ts);
      const ts = Number.isFinite(sent) && sent > row.startedAt - 5000 && sent <= now + 5000 ? sent : now;
      const line: TranscriptLine = {
        id: event.id || randomUUID(),
        role: event.role,
        text,
        ts,
        final,
      };
      if (final) {
        const transcript = [...row.transcript];
        const at = transcript.findIndex((l) => l.id === line.id);
        if (at >= 0) transcript[at] = { ...line, ts: transcript[at].ts };
        else transcript.push(line);
        transcript.sort((a, b) => a.ts - b.ts);
        d.update(schema.calls).set({ transcript }).where(eq(schema.calls.id, id)).run();
      }
      broadcast({ type: "call.transcript", payload: { callId: id, line } });
      if (final && event.role === "caller" && row.ticketId == null) scheduleExtraction(id);
      return { ok: true };
    }
    case "fields": {
      mergeFields(id, event.fields ?? {});
      return { ok: true };
    }
    case "metrics": {
      const seconds = Math.max(row.seconds, Math.round(Number(event.seconds) || 0));
      const costUsd = Math.max(row.costUsd, Number(event.costUsd) || 0);
      const costPkr = Number(usdToPkr(costUsd).toFixed(2));
      d.update(schema.calls).set({ seconds, costUsd, costPkr }).where(eq(schema.calls.id, id)).run();
      broadcast({ type: "call.metrics", payload: { callId: id, seconds, costUsd, costPkr } });
      return { ok: true };
    }
    case "gps": {
      const lat = Number(event.lat);
      const lng = Number(event.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new CallError("Invalid coordinates");
      d.update(schema.calls).set({ lat, lng }).where(eq(schema.calls.id, id)).run();
      const inServiceArea = isInPeshawar(lat, lng);
      return { ok: true, inServiceArea, nearestArea: inServiceArea ? (nearestArea(lat, lng)?.nameEn ?? null) : null };
    }
    case "human_needed": {
      const reason = String(event.reason ?? "Caller asked for a human officer").slice(0, 200);
      broadcast({
        type: "call.human_needed",
        payload: { callId: id, reason, phoneMasked: callDTO(row).phoneMasked },
      });
      return { ok: true };
    }
    default:
      throw new CallError("Unknown event type");
  }
}

export function endCall(
  id: string,
  body: { seconds?: number; costUsd?: number },
): CallDTO {
  const row = getRow(id);
  if (!row) throw new CallError("Call not found", 404);
  if (row.endedAt != null) return callDTO(row);
  const now = Date.now();
  const seconds = Math.max(
    row.seconds,
    Math.round(Number(body.seconds) || 0) || Math.round((now - row.startedAt) / 1000),
  );
  // Realtime usage as reported by the browser, plus caller-audio transcription.
  const costUsd =
    Math.max(row.costUsd, Number(body.costUsd) || 0) +
    (row.simulated ? 0 : transcriptionCostUsd(seconds * 0.5));
  const updated = db()
    .update(schema.calls)
    .set({ endedAt: now, seconds, costUsd, costPkr: Number(usdToPkr(costUsd).toFixed(2)) })
    .where(eq(schema.calls.id, id))
    .returning()
    .get();
  const dto = callDTO(updated);
  broadcast({ type: "call.ended", payload: { call: dto, stats: getStats() } });
  return dto;
}

function mergeFields(id: string, incoming: CallFields): void {
  const row = getRow(id);
  if (!row) return;
  const next: CallFields = { ...row.fields };
  if (incoming.name?.trim()) next.name = incoming.name.trim().slice(0, 80);
  if (incoming.phone && digitsOnly(incoming.phone).length >= 7) next.phone = digitsOnly(incoming.phone);
  if (incoming.area?.trim()) next.area = incoming.area.trim().slice(0, 80);
  if (isCategory(incoming.category)) next.category = incoming.category;
  if (incoming.description?.trim()) next.description = incoming.description.trim().slice(0, 240);
  if (incoming.mood != null) next.mood = clampMood(incoming.mood);
  if (JSON.stringify(next) === JSON.stringify(row.fields)) return;
  const updated = db().update(schema.calls).set({ fields: next }).where(eq(schema.calls.id, id)).returning().get();
  // Screens only ever see the masked phone.
  broadcast({ type: "call.fields", payload: { callId: id, fields: callDTO(updated).fields } });
}

/** Called when the agent registers the ticket: the card shows the final, confirmed details. */
export function syncCallFromTicket(callId: string, ticket: TicketRow, areaName: string): void {
  mergeFields(callId, {
    name: ticket.callerName,
    phone: ticket.phone,
    area: areaName,
    category: ticket.category,
    description: ticket.descriptionEn,
    mood: ticket.mood,
  });
}

// ---------- live "extracted details" ----------

const KEYWORDS: [Category, RegExp][] = [
  ["streetlight", /سٹریٹ لائٹ|اسٹریٹ لائٹ|street ?light|کھمبے کی لائٹ/i],
  ["sewerage", /گٹر|سیوریج|نالہ|نالی|مین ہول|sewer|sewage|drain|manhole|gutter/i],
  ["garbage", /کچر|کوڑ|گندگی|garbage|trash|waste|rubbish/i],
  ["road", /سڑک|گڑھ|روڈ ٹوٹ|pothole|road is|broken road/i],
  ["electricity", /بجلی|ٹرانسفارمر|تار |وولٹیج|لوڈ شیڈنگ|electric|transformer|power|voltage|wire/i],
  ["water", /پانی|ٹیوب ویل|پائپ|نلک|water|tube ?well|pipe|tap/i],
];

function heuristicFields(lines: TranscriptLine[]): CallFields {
  const caller = lines.filter((l) => l.role === "caller").map((l) => l.text);
  const all = caller.join(" \n ");
  const out: CallFields = {};

  const phone = digitsOnly(all.replace(/[\s-]/g, "")).match(/03\d{9}/)?.[0];
  if (phone) out.phone = phone;

  for (const text of [...caller].reverse()) {
    const area = matchArea(text, true);
    if (area) {
      out.area = area.nameEn;
      break;
    }
  }
  for (const [category, re] of KEYWORDS) {
    if (re.test(all)) {
      out.category = category;
      break;
    }
  }
  return out;
}

type ExtractState = { running: boolean; dirty: boolean };
const g = globalThis as unknown as { __faryadExtract?: Map<string, ExtractState> };
const extractState = (g.__faryadExtract ??= new Map());

function scheduleExtraction(callId: string): void {
  const row = getRow(callId);
  if (!row) return;
  // Instant pass: phone number, area and category straight from the words.
  mergeFields(callId, heuristicFields(row.transcript));

  const state = extractState.get(callId) ?? { running: false, dirty: false };
  extractState.set(callId, state);
  if (state.running) {
    state.dirty = true;
    return;
  }
  state.running = true;
  void (async () => {
    try {
      do {
        state.dirty = false;
        await llmExtract(callId);
      } while (state.dirty);
    } finally {
      state.running = false;
      if (getRow(callId)?.endedAt != null) extractState.delete(callId);
    }
  })();
}

async function llmExtract(callId: string): Promise<void> {
  const row = getRow(callId);
  if (!row || row.ticketId != null || row.transcript.length === 0) return;
  const areas = listAreas().map((a) => a.nameEn);
  const result = await chatJson<{
    name?: string;
    phone?: string;
    area?: string;
    category?: string;
    description?: string;
    mood?: number;
  }>(
    "You extract complaint details from a live Urdu/English helpline transcript for Peshawar municipal services. " +
      "Reply as JSON with keys: name, phone, area, category, description, mood. " +
      "Use an empty string for anything the CALLER has not clearly said yet; never guess. " +
      `area must be exactly one of: ${areas.join(", ")} (or empty). ` +
      `category must be one of: ${CATEGORIES.join(", ")} (or empty). ` +
      "phone is digits only. name is the caller's name in Latin letters. " +
      "description is one short plain-English sentence describing the problem. " +
      "mood is an integer 1-5 for how the caller sounds (1 very upset, 3 neutral, 5 calm).",
    row.transcript.map((l) => `${l.role === "caller" ? "Caller" : "Agent"}: ${l.text}`).join("\n"),
    6000,
  );
  if (!result) return;
  const latest = getRow(callId);
  if (!latest || latest.ticketId != null) return;
  mergeFields(callId, {
    name: result.name,
    phone: result.phone,
    area: result.area && areas.includes(result.area) ? result.area : undefined,
    category: isCategory(result.category) ? result.category : undefined,
    description: result.description,
    mood: result.mood,
  });
}
