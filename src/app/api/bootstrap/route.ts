import { areaDTO, listAreas } from "@/server/areas";
import { activeCalls } from "@/server/calls";
import { departmentDTO, refs } from "@/server/dto";
import { fail, json } from "@/server/http";
import { listIncidents } from "@/server/incidents";
import { hasOpenAIKey } from "@/server/openai";
import { getStats } from "@/server/stats";
import { listTickets } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Everything a screen needs on first paint, in one request. */
export async function GET() {
  try {
    return json({
      tickets: listTickets(),
      incidents: listIncidents(),
      areas: listAreas().map(areaDTO),
      departments: [...refs().depts.values()].map(departmentDTO),
      stats: getStats(),
      activeCalls: activeCalls(),
      publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || null,
      aiReady: hasOpenAIKey(),
      serverTime: Date.now(),
    });
  } catch (err) {
    return fail(err);
  }
}
