import { fail, json, readJson } from "@/server/http";
import { createTicket, listTickets } from "@/server/tickets";
import { ticketNoSpokenUr } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ tickets: listTickets() });
  } catch (err) {
    return fail(err);
  }
}

/** Accepts both camelCase (our screens) and snake_case (the voice agent's tool call). */
export async function POST(req: Request) {
  try {
    const b = await readJson<Record<string, unknown>>(req);
    const str = (...keys: string[]) => {
      for (const k of keys) if (typeof b[k] === "string") return b[k] as string;
      return undefined;
    };
    const num = (...keys: string[]) => {
      for (const k of keys) {
        const v = b[k];
        if (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
      }
      return undefined;
    };
    const { ticket, slaHours, incidentCreated } = createTicket({
      callerName: str("callerName", "caller_name"),
      phone: str("phone"),
      area: str("area"),
      areaId: num("areaId", "area_id"),
      category: str("category"),
      descriptionUr: str("descriptionUr", "description_ur"),
      descriptionEn: str("descriptionEn", "description_en"),
      mood: num("mood"),
      callId: str("callId", "call_id") ?? null,
      lat: num("lat"),
      lng: num("lng"),
      addressNote: str("addressNote", "address_note"),
    });
    return json(
      {
        ticket,
        // The shape the voice agent's create_ticket tool reads back to the caller.
        ticket_no: ticket.ticketNo,
        ticket_no_spoken_ur: ticketNoSpokenUr(ticket.ticketNo),
        department: ticket.departmentCode,
        department_name: ticket.departmentName,
        sla_hours: slaHours,
        area: ticket.areaEn,
        location_source: ticket.locationSource,
        incident_created: incidentCreated,
      },
      201,
    );
  } catch (err) {
    return fail(err);
  }
}
