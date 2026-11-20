import { and, desc, eq, gte, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { IncidentRow, TicketRow } from "@/db/schema";
import { CATEGORY_META, type Category, type IncidentDTO } from "@/lib/domain";
import { toUrduNumerals } from "@/lib/format";
import { broadcast } from "./bus";
import { incidentDTO, refs, ticketDTO } from "./dto";
import { chatJson } from "./openai";
import { escalationFor, INCIDENT_THRESHOLD, INCIDENT_WINDOW_MS } from "./rules";

function templateSummary(category: Category, areaEn: string, areaUr: string, count: number) {
  const c = CATEGORY_META[category];
  return {
    en: `${count} reports of ${c.issueEn} problems in ${areaEn} within 2 hours - likely an area-wide fault.`,
    ur: `${areaUr} میں گزشتہ دو گھنٹوں میں ${c.issueUr} کی ${toUrduNumerals(count)} شکایات، علاقے بھر میں خرابی کا امکان ہے۔`,
  };
}

/**
 * Incident clustering: three or more unresolved tickets with the same category
 * in the same area within two hours become (or grow) one incident.
 */
export function clusterForTicket(ticket: TicketRow): IncidentDTO | null {
  if (ticket.areaId == null) return null;
  const d = db();
  const since = Date.now() - INCIDENT_WINDOW_MS;

  const cluster = d
    .select()
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.category, ticket.category),
        eq(schema.tickets.areaId, ticket.areaId),
        ne(schema.tickets.status, "resolved"),
        gte(schema.tickets.createdAt, since),
      ),
    )
    .all();

  if (cluster.length < INCIDENT_THRESHOLD) return null;

  const r = refs();
  const area = r.areas.get(ticket.areaId);
  const now = Date.now();

  let incident: IncidentRow | undefined = d
    .select()
    .from(schema.incidents)
    .where(
      and(
        eq(schema.incidents.category, ticket.category),
        eq(schema.incidents.areaId, ticket.areaId),
        eq(schema.incidents.status, "active"),
      ),
    )
    .get();

  const isNew = !incident;
  const alreadyLinked = incident
    ? d.select().from(schema.tickets).where(eq(schema.tickets.incidentId, incident.id)).all()
    : [];
  const ids = new Set([...alreadyLinked.map((t) => t.id), ...cluster.map((t) => t.id)]);
  const count = ids.size;
  const text = templateSummary(ticket.category, area?.nameEn ?? "the area", area?.nameUr ?? "علاقے", count);

  if (!incident) {
    incident = d
      .insert(schema.incidents)
      .values({
        category: ticket.category,
        areaId: ticket.areaId,
        ticketCount: count,
        summary: text.en,
        summaryUr: text.ur,
        escalationLevel: escalationFor(count),
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  } else {
    incident = d
      .update(schema.incidents)
      .set({
        ticketCount: count,
        summary: text.en,
        summaryUr: text.ur,
        escalationLevel: escalationFor(count),
        updatedAt: now,
      })
      .where(eq(schema.incidents.id, incident.id))
      .returning()
      .get();
  }

  // Link every ticket of the cluster and tell open screens about the ones that changed.
  for (const t of cluster) {
    if (t.incidentId !== incident.id) {
      const updated = d
        .update(schema.tickets)
        .set({ incidentId: incident.id })
        .where(eq(schema.tickets.id, t.id))
        .returning()
        .get();
      broadcast({ type: "ticket.updated", payload: ticketDTO(updated, r) });
    }
  }

  const dto = incidentDTO(incident, r);
  broadcast({ type: isNew ? "incident.created" : "incident.updated", payload: dto });

  // Better one-line summary from the LLM; the template above is already on screen.
  void improveSummary(incident.id);
  return dto;
}

async function improveSummary(incidentId: number): Promise<void> {
  const d = db();
  const incident = d.select().from(schema.incidents).where(eq(schema.incidents.id, incidentId)).get();
  if (!incident) return;
  const r = refs();
  const area = r.areas.get(incident.areaId);
  const linked = d.select().from(schema.tickets).where(eq(schema.tickets.incidentId, incidentId)).all();
  const result = await chatJson<{ en?: string; ur?: string }>(
    "You write incident summaries for a municipal command centre in Peshawar, Pakistan. " +
      'Reply as JSON: {"en": "...", "ur": "..."}. Each value is ONE short sentence (max 22 words): ' +
      "what is happening, where, how many reports, and the likely common cause if the complaints suggest one. " +
      "The Urdu must be natural Pakistani Urdu in Urdu script. Do not invent facts.",
    JSON.stringify({
      category: incident.category,
      area: area?.nameEn,
      area_ur: area?.nameUr,
      report_count: linked.length,
      window: "last 2 hours",
      complaints: linked.map((t) => t.descriptionEn),
    }),
  );
  if (!result?.en || !result?.ur) return;
  const updated = d
    .update(schema.incidents)
    .set({ summary: result.en.trim(), summaryUr: result.ur.trim() })
    .where(eq(schema.incidents.id, incidentId))
    .returning()
    .get();
  if (updated) broadcast({ type: "incident.updated", payload: incidentDTO(updated, r) });
}

/** When the last linked ticket is resolved the incident closes itself. */
export function closeIncidentIfDone(incidentId: number | null): void {
  if (incidentId == null) return;
  const d = db();
  const remaining = d
    .select({ id: schema.tickets.id })
    .from(schema.tickets)
    .where(and(eq(schema.tickets.incidentId, incidentId), ne(schema.tickets.status, "resolved")))
    .all();
  const incident = d.select().from(schema.incidents).where(eq(schema.incidents.id, incidentId)).get();
  if (!incident) return;
  const nextStatus = remaining.length === 0 ? "resolved" : "active";
  if (incident.status === nextStatus) return;
  const updated = d
    .update(schema.incidents)
    .set({ status: nextStatus, updatedAt: Date.now() })
    .where(eq(schema.incidents.id, incidentId))
    .returning()
    .get();
  broadcast({ type: "incident.updated", payload: incidentDTO(updated) });
}

export function listIncidents(): IncidentDTO[] {
  const r = refs();
  return db()
    .select()
    .from(schema.incidents)
    .orderBy(desc(schema.incidents.updatedAt))
    .all()
    .map((i) => incidentDTO(i, r));
}
