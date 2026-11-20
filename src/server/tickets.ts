import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { asc, desc, eq, like, or, sql } from "drizzle-orm";
import { db, getStore, schema } from "@/db";
import type { TicketRow } from "@/db/schema";
import {
  CATEGORY_META,
  isCategory,
  isStatus,
  PRIORITIES,
  STATUS_META,
  type CallDTO,
  type Category,
  type Priority,
  type Status,
  type TicketDTO,
  type TicketEventDTO,
} from "@/lib/domain";
import { digitsOnly, normalizeTicketNo, ticketNoSpokenUr, timeAgo } from "@/lib/format";
import { isInPeshawar, matchArea, nearestArea, PESHAWAR_CENTER } from "./areas";
import { broadcast } from "./bus";
import { syncCallFromTicket } from "./calls";
import { callDTO, refs, ticketDTO } from "./dto";
import { clusterForTicket, closeIncidentIfDone } from "./incidents";
import { hasOpenAIKey, synthesizeSpeech } from "./openai";
import { clampMood, priorityFor, slaHoursFor } from "./rules";

export class TicketError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CreateTicketInput = {
  callerName?: string;
  phone?: string;
  area?: string;
  areaId?: number;
  category?: string;
  descriptionUr?: string;
  descriptionEn?: string;
  mood?: number;
  callId?: string | null;
  lat?: number;
  lng?: number;
  addressNote?: string;
};

function addEvent(
  ticketId: number,
  type: TicketEventDTO["type"],
  text: string,
  actor: string,
  createdAt = Date.now(),
) {
  db().insert(schema.ticketEvents).values({ ticketId, type, text, actor, createdAt }).run();
}

export function createTicket(input: CreateTicketInput): {
  ticket: TicketDTO;
  slaHours: number;
  incidentCreated: boolean;
} {
  if (!isCategory(input.category)) {
    throw new TicketError(
      `category must be one of: ${Object.keys(CATEGORY_META).join(", ")}`,
    );
  }
  const category: Category = input.category;
  const d = db();
  const r = refs();
  const now = Date.now();

  // GPS shared on the call beats everything else for the pin position.
  let gps: { lat: number; lng: number } | null = null;
  if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    gps = { lat: Number(input.lat), lng: Number(input.lng) };
  } else if (input.callId) {
    const call = d.select().from(schema.calls).where(eq(schema.calls.id, input.callId)).get();
    if (call?.lat != null && call?.lng != null) gps = { lat: call.lat, lng: call.lng };
  }
  let addressNote = input.addressNote?.trim() || null;
  if (gps && !isInPeshawar(gps.lat, gps.lng)) {
    addressNote = addressNote ?? "GPS shared, but outside the Peshawar service area";
    gps = null;
  }

  let area = input.areaId != null ? r.areas.get(Number(input.areaId)) : undefined;
  if (!area) area = matchArea(input.area) ?? undefined;
  if (!area && gps) area = nearestArea(gps.lat, gps.lng) ?? undefined;
  if (!area && input.area?.trim()) addressNote = addressNote ?? input.area.trim();

  let lat: number;
  let lng: number;
  let locationSource: TicketRow["locationSource"];
  if (gps) {
    lat = gps.lat;
    lng = gps.lng;
    locationSource = "gps";
  } else {
    const centre = area ?? PESHAWAR_CENTER;
    // A few hundred metres of spread so pins in one area do not sit on top of each other.
    lat = centre.lat + (Math.random() - 0.5) * 0.009;
    lng = centre.lng + (Math.random() - 0.5) * 0.011;
    locationSource = "area";
  }

  const dept = [...r.depts.values()].find((x) => x.categories.includes(category));
  const slaHours = slaHoursFor(dept, category);
  const mood = clampMood(input.mood);
  const descriptionUr = input.descriptionUr?.trim() || input.descriptionEn?.trim() || "";
  const descriptionEn = input.descriptionEn?.trim() || input.descriptionUr?.trim() || "";
  if (!descriptionUr && !descriptionEn) throw new TicketError("A description is required");

  // Number allocation + insert in one transaction so two calls can never share a number.
  const row = getStore().sqlite.transaction(() => {
    const last = d
      .select({ n: sql<number>`COALESCE(MAX(CAST(SUBSTR(${schema.tickets.ticketNo}, 5) AS INTEGER)), 1000)` })
      .from(schema.tickets)
      .get();
    const ticketNo = `FRD-${(last?.n ?? 1000) + 1}`;
    return d
      .insert(schema.tickets)
      .values({
        ticketNo,
        callerName: input.callerName?.trim() || "Citizen",
        phone: digitsOnly(input.phone ?? ""),
        category,
        areaId: area?.id ?? null,
        lat,
        lng,
        locationSource,
        addressNote,
        descriptionUr,
        descriptionEn,
        status: "open",
        priority: priorityFor(category, mood),
        departmentId: dept?.id ?? null,
        incidentId: null,
        mood,
        slaDueAt: now + slaHours * 3_600_000,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        resolutionNote: null,
        voiceNoteUrl: null,
        callId: input.callId ?? null,
        assignee: null,
      })
      .returning()
      .get();
  })();

  addEvent(
    row.id,
    "created",
    `Complaint registered${input.callId ? " from a voice call" : ""} and routed to ${dept?.code ?? "the department"} (SLA ${slaHours}h).` +
      (locationSource === "gps" ? " Exact GPS location shared by the caller." : ""),
    "Faryad AI",
    now,
  );

  if (input.callId) {
    d.update(schema.calls).set({ ticketId: row.id }).where(eq(schema.calls.id, input.callId)).run();
    syncCallFromTicket(input.callId, row, area?.nameEn ?? addressNote ?? "Peshawar");
  }

  const ticket = ticketDTO(row, r);
  broadcast({ type: "ticket.created", payload: ticket });
  // Start the Urdu voice note now, so it is ready long before the ticket is resolved.
  void prepareVoiceNote(row);

  const incident = clusterForTicket(row);
  const fresh = incident ? getRow(row.ticketNo) : row;
  return {
    ticket: fresh ? ticketDTO(fresh, r) : ticket,
    slaHours,
    incidentCreated: Boolean(incident),
  };
}

function getRow(ticketNo: string): TicketRow | undefined {
  return db().select().from(schema.tickets).where(eq(schema.tickets.ticketNo, ticketNo)).get();
}

export function listTickets(): TicketDTO[] {
  const r = refs();
  return db()
    .select()
    .from(schema.tickets)
    .orderBy(desc(schema.tickets.createdAt))
    .limit(1000)
    .all()
    .map((t) => ticketDTO(t, r));
}

export function getTicketDetail(ticketNoRaw: string): {
  ticket: TicketDTO;
  events: TicketEventDTO[];
  call: CallDTO | null;
} | null {
  const ticketNo = normalizeTicketNo(ticketNoRaw);
  const row = ticketNo ? getRow(ticketNo) : undefined;
  if (!row) return null;
  const events = db()
    .select()
    .from(schema.ticketEvents)
    .where(eq(schema.ticketEvents.ticketId, row.id))
    .orderBy(asc(schema.ticketEvents.createdAt), asc(schema.ticketEvents.id))
    .all();
  const callRow = row.callId
    ? db().select().from(schema.calls).where(eq(schema.calls.id, row.callId)).get()
    : undefined;
  return { ticket: ticketDTO(row), events, call: callRow ? callDTO(callRow) : null };
}

export type UpdateTicketInput = {
  status?: string;
  assignee?: string | null;
  resolutionNote?: string | null;
  priority?: string;
  lat?: number;
  lng?: number;
  actor?: string;
};

export function updateTicket(ticketNoRaw: string, patch: UpdateTicketInput): TicketDTO {
  const ticketNo = normalizeTicketNo(ticketNoRaw);
  const current = ticketNo ? getRow(ticketNo) : undefined;
  if (!current) throw new TicketError("Ticket not found", 404);

  const d = db();
  const now = Date.now();
  const actor = patch.actor?.trim() || "Command Center";
  const set: Partial<TicketRow> = { updatedAt: now };
  const events: { type: TicketEventDTO["type"]; text: string }[] = [];

  if (patch.status !== undefined) {
    if (!isStatus(patch.status)) throw new TicketError("Unknown status");
    const next: Status = patch.status;
    if (next !== current.status) {
      set.status = next;
      if (next === "assigned") {
        const who = patch.assignee?.trim() || actor;
        set.assignee = who;
        events.push({ type: "assigned", text: `Assigned to ${who}.` });
      } else if (next === "in_progress") {
        if (!current.assignee) set.assignee = patch.assignee?.trim() || actor;
        events.push({ type: "status_changed", text: "Work started on site." });
      } else if (next === "resolved") {
        const note = patch.resolutionNote?.trim() || null;
        set.resolvedAt = now;
        set.resolutionNote = note;
        if (!current.assignee) set.assignee = patch.assignee?.trim() || actor;
        events.push({ type: "status_changed", text: note ? `Resolved. ${note}` : "Resolved." });
      } else {
        set.resolvedAt = null;
        events.push({ type: "status_changed", text: "Reopened." });
      }
    }
  } else if (patch.assignee !== undefined && patch.assignee !== current.assignee) {
    set.assignee = patch.assignee?.trim() || null;
    events.push({ type: "assigned", text: `Assigned to ${set.assignee ?? "nobody"}.` });
  }

  if (patch.priority !== undefined && patch.priority !== current.priority) {
    if (!(PRIORITIES as readonly string[]).includes(patch.priority)) {
      throw new TicketError("Unknown priority");
    }
    set.priority = patch.priority as Priority;
    events.push({ type: "note", text: `Priority changed to ${patch.priority}.` });
  }

  if (patch.lat !== undefined || patch.lng !== undefined) {
    const lat = Number(patch.lat);
    const lng = Number(patch.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new TicketError("lat and lng must be valid coordinates");
    }
    set.lat = lat;
    set.lng = lng;
    set.locationSource = "manual";
    events.push({ type: "note", text: "Exact place marked on the map." });
  }

  const row = d.update(schema.tickets).set(set).where(eq(schema.tickets.id, current.id)).returning().get();
  events.forEach((e, i) => addEvent(row.id, e.type, e.text, actor, now + i));

  const dto = ticketDTO(row);
  broadcast({ type: "ticket.updated", payload: dto });

  if (set.status === "resolved") {
    closeIncidentIfDone(row.incidentId);
    void sendVoiceNote(row);
  } else if (set.status) {
    closeIncidentIfDone(row.incidentId);
    // Seeded tickets have no note yet: prepare it as soon as an officer picks the ticket up.
    if (set.status !== "open") void prepareVoiceNote(row);
  }
  return dto;
}

export function addNote(ticketNoRaw: string, text: string, actor?: string): TicketEventDTO[] {
  const ticketNo = normalizeTicketNo(ticketNoRaw);
  const row = ticketNo ? getRow(ticketNo) : undefined;
  if (!row) throw new TicketError("Ticket not found", 404);
  const body = text?.trim();
  if (!body) throw new TicketError("Note text is required");
  const now = Date.now();
  addEvent(row.id, "note", body, actor?.trim() || "Command Center", now);
  const updated = db()
    .update(schema.tickets)
    .set({ updatedAt: now })
    .where(eq(schema.tickets.id, row.id))
    .returning()
    .get();
  broadcast({ type: "ticket.updated", payload: ticketDTO(updated) });
  return db()
    .select()
    .from(schema.ticketEvents)
    .where(eq(schema.ticketEvents.ticketId, row.id))
    .orderBy(asc(schema.ticketEvents.createdAt), asc(schema.ticketEvents.id))
    .all();
}

export function voiceNoteText(name: string, ticketNo: string): string {
  return `محترم ${name}، آپ کی شکایت نمبر ${ticketNoSpokenUr(ticketNo)} حل کر دی گئی ہے۔ فریاد ہیلپ لائن استعمال کرنے کا شکریہ۔`;
}

const voiceJobs: Map<string, Promise<string | null>> = ((
  globalThis as unknown as { __faryadVoiceJobs?: Map<string, Promise<string | null>> }
).__faryadVoiceJobs ??= new Map());

/**
 * Makes sure the ticket's Urdu voice note exists on disk and returns its URL (null if
 * text-to-speech is unavailable). Speech synthesis takes several seconds, so this is
 * started in the background when a ticket is created or picked up; by the time the
 * officer resolves it the file is ready and the citizen hears it straight away.
 */
export function prepareVoiceNote(ticket: Pick<TicketRow, "ticketNo" | "callerName">): Promise<string | null> {
  if (!hasOpenAIKey()) return Promise.resolve(null);
  // The file name depends on the caller's name, so a reset that reuses a ticket number
  // can never play someone else's note.
  const tag = createHash("sha1").update(ticket.callerName).digest("hex").slice(0, 8);
  const file = `${ticket.ticketNo}-${tag}.mp3`;
  const url = `/api/audio/${file}`;
  if (fs.existsSync(path.join(process.cwd(), "public", "audio", file))) return Promise.resolve(url);

  const running = voiceJobs.get(file);
  if (running) return running;
  const job = (async () => {
    // A weak connection can lose the request; keep trying quietly in the background.
    const waits = [0, 3000, 8000, 15_000];
    for (let i = 0; i < waits.length; i++) {
      if (waits[i]) await new Promise((r) => setTimeout(r, waits[i]));
      try {
        await synthesizeSpeech(voiceNoteText(ticket.callerName, ticket.ticketNo), file);
        return url;
      } catch (err) {
        console.warn(
          `[faryad] voice note for ${ticket.ticketNo}: try ${i + 1} of ${waits.length} failed:`,
          (err as Error).message,
        );
      }
    }
    return null;
  })().finally(() => voiceJobs.delete(file));
  voiceJobs.set(file, job);
  return job;
}

/**
 * Urdu voice note for the citizen. The citizen is told the ticket is resolved
 * either way; the audio is attached when text-to-speech succeeds.
 */
async function sendVoiceNote(ticket: TicketRow): Promise<void> {
  const attach = (audioUrl: string) => {
    const row = db()
      .update(schema.tickets)
      .set({ voiceNoteUrl: audioUrl })
      .where(eq(schema.tickets.id, ticket.id))
      .returning()
      .get();
    addEvent(ticket.id, "voice_note_sent", "Urdu voice note sent to the citizen.", "Faryad AI");
    if (row) broadcast({ type: "ticket.updated", payload: ticketDTO(row) });
    broadcast({ type: "citizen.notify", payload: { ticketNo: ticket.ticketNo, audioUrl } });
  };

  // Usually already on disk (prepared when the ticket was created or picked up).
  const job = prepareVoiceNote(ticket);
  const ready = await Promise.race([job, new Promise<undefined>((r) => setTimeout(() => r(undefined), 2500))]);
  if (ready) {
    attach(ready);
    return;
  }

  // Not ready yet: tell the citizen now, and send the audio the moment it exists.
  broadcast({ type: "citizen.notify", payload: { ticketNo: ticket.ticketNo, audioUrl: null } });
  const late = ready === undefined ? await job : null;
  if (late) {
    // The ticket may have been reopened while we waited.
    const current = db().select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
    if (current?.status === "resolved") attach(late);
  } else {
    addEvent(
      ticket.id,
      "note",
      "Citizen notified on screen. The voice note could not be generated.",
      "Faryad AI",
    );
  }
}

/** Plain-language status for the voice agent (get_ticket_status tool). */
export function statusForCaller(query: { ticketNo?: string | null; phone?: string | null }) {
  const d = db();
  let row: TicketRow | undefined;
  const ticketNo = query.ticketNo ? normalizeTicketNo(query.ticketNo) : null;
  if (ticketNo) row = getRow(ticketNo);
  if (!row && query.phone) {
    const digits = digitsOnly(query.phone);
    if (digits.length >= 7) {
      row = d
        .select()
        .from(schema.tickets)
        .where(or(eq(schema.tickets.phone, digits), like(schema.tickets.phone, `%${digits.slice(-10)}`)))
        .orderBy(desc(schema.tickets.createdAt))
        .get();
    }
  }
  if (!row) {
    return {
      found: false as const,
      message_en: "No complaint was found for that number. Ask the caller to repeat the complaint number.",
      message_ur: "اس نمبر پر کوئی شکایت نہیں ملی۔ براہِ کرم شکایت نمبر دوبارہ بتائیں۔",
    };
  }
  const t = ticketDTO(row);
  const lastEvent = d
    .select()
    .from(schema.ticketEvents)
    .where(eq(schema.ticketEvents.ticketId, row.id))
    .orderBy(desc(schema.ticketEvents.createdAt), desc(schema.ticketEvents.id))
    .get();
  const simple: Record<Status, { en: string; ur: string }> = {
    open: {
      en: `registered and waiting to be assigned to a ${t.departmentCode} team`,
      ur: `درج ہو چکی ہے اور ${t.departmentCode} کی ٹیم کو دی جا رہی ہے`,
    },
    assigned: {
      en: `assigned to a ${t.departmentCode} team`,
      ur: `${t.departmentCode} کی ٹیم کو دے دی گئی ہے`,
    },
    in_progress: {
      en: `being worked on by the ${t.departmentCode} team right now`,
      ur: `پر ${t.departmentCode} کی ٹیم کام کر رہی ہے`,
    },
    resolved: { en: "resolved", ur: "حل کر دی گئی ہے" },
  };
  return {
    found: true as const,
    ticket_no: t.ticketNo,
    ticket_no_spoken_ur: ticketNoSpokenUr(t.ticketNo),
    status: t.status,
    status_label_ur: STATUS_META[t.status].ur,
    category: t.category,
    area: t.areaEn,
    department: t.departmentCode,
    registered: timeAgo(t.createdAt),
    last_update: lastEvent ? `${lastEvent.text} (${timeAgo(lastEvent.createdAt)})` : timeAgo(t.updatedAt),
    expected_within_hours: t.status === "resolved" ? 0 : Math.max(0, Math.ceil((t.slaDueAt - Date.now()) / 3_600_000)),
    in_simple_terms_en: `Complaint ${t.ticketNo} about ${CATEGORY_META[t.category].issueEn} in ${t.areaEn} is ${simple[t.status].en}.`,
    in_simple_terms_ur: `${t.areaUr} میں ${CATEGORY_META[t.category].issueUr} کی شکایت ${simple[t.status].ur}۔`,
  };
}
