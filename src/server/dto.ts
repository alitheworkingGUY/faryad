import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AreaRow, CallRow, DepartmentRow, IncidentRow, TicketRow } from "@/db/schema";
import type { CallDTO, DepartmentDTO, IncidentDTO, TicketDTO } from "@/lib/domain";
import { maskPhone } from "@/lib/format";
import { PESHAWAR_CENTER } from "./areas";
import { slaHoursFor } from "./rules";

export type Refs = { areas: Map<number, AreaRow>; depts: Map<number, DepartmentRow> };

export function refs(): Refs {
  const areas = new Map(db().select().from(schema.areas).all().map((a) => [a.id, a]));
  const depts = new Map(db().select().from(schema.departments).all().map((d) => [d.id, d]));
  return { areas, depts };
}

export function departmentDTO(d: DepartmentRow): DepartmentDTO {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    nameUr: d.nameUr,
    categories: d.categories,
    slaHours: d.slaHours,
    slaByCategory: d.slaByCategory,
  };
}

export function ticketDTO(t: TicketRow, r: Refs = refs()): TicketDTO {
  const area = t.areaId != null ? r.areas.get(t.areaId) : undefined;
  const dept = t.departmentId != null ? r.depts.get(t.departmentId) : undefined;
  return {
    id: t.id,
    ticketNo: t.ticketNo,
    callerName: t.callerName,
    phoneMasked: maskPhone(t.phone),
    category: t.category,
    areaId: t.areaId,
    areaEn: area?.nameEn ?? t.addressNote ?? "Peshawar",
    areaUr: area?.nameUr ?? t.addressNote ?? "پشاور",
    lat: t.lat,
    lng: t.lng,
    locationSource: t.locationSource,
    addressNote: t.addressNote,
    descriptionUr: t.descriptionUr,
    descriptionEn: t.descriptionEn,
    status: t.status,
    priority: t.priority,
    departmentId: t.departmentId,
    departmentCode: dept?.code ?? "-",
    departmentName: dept?.name ?? "Unassigned",
    incidentId: t.incidentId,
    mood: t.mood,
    slaHours: slaHoursFor(dept, t.category),
    slaDueAt: t.slaDueAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    resolutionNote: t.resolutionNote,
    voiceNoteUrl: t.voiceNoteUrl,
    callId: t.callId,
    assignee: t.assignee,
  };
}

export function incidentDTO(i: IncidentRow, r: Refs = refs()): IncidentDTO {
  const area = r.areas.get(i.areaId);
  const linked = db()
    .select({ ticketNo: schema.tickets.ticketNo, createdAt: schema.tickets.createdAt })
    .from(schema.tickets)
    .where(eq(schema.tickets.incidentId, i.id))
    .orderBy(asc(schema.tickets.createdAt))
    .all();
  return {
    id: i.id,
    category: i.category,
    areaId: i.areaId,
    areaEn: area?.nameEn ?? "Peshawar",
    areaUr: area?.nameUr ?? "پشاور",
    lat: area?.lat ?? PESHAWAR_CENTER.lat,
    lng: area?.lng ?? PESHAWAR_CENTER.lng,
    ticketCount: i.ticketCount,
    summary: i.summary,
    summaryUr: i.summaryUr,
    escalationLevel: i.escalationLevel,
    status: i.status,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    firstReportAt: linked[0]?.createdAt ?? i.createdAt,
    latestReportAt: linked[linked.length - 1]?.createdAt ?? i.updatedAt,
    ticketNos: linked.map((l) => l.ticketNo),
  };
}

export function callDTO(c: CallRow): CallDTO {
  let ticketNo: string | null = null;
  if (c.ticketId != null) {
    ticketNo =
      db()
        .select({ ticketNo: schema.tickets.ticketNo })
        .from(schema.tickets)
        .where(eq(schema.tickets.id, c.ticketId))
        .get()?.ticketNo ?? null;
  }
  return {
    id: c.id,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    seconds: c.seconds,
    transcript: c.transcript,
    ticketId: c.ticketId,
    ticketNo,
    costUsd: c.costUsd,
    costPkr: c.costPkr,
    fields: { ...c.fields, phone: c.fields.phone ? maskPhone(c.fields.phone) : undefined },
    phoneMasked: c.fields.phone ? maskPhone(c.fields.phone) : null,
    hasGps: c.lat != null && c.lng != null,
    simulated: c.simulated,
  };
}
