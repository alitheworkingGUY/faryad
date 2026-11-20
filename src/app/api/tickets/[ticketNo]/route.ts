import { fail, json, readJson } from "@/server/http";
import { getTicketDetail, updateTicket, type UpdateTicketInput } from "@/server/tickets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ticketNo: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { ticketNo } = await ctx.params;
    const detail = getTicketDetail(decodeURIComponent(ticketNo));
    if (!detail) return json({ error: "Ticket not found" }, 404);
    return json(detail);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { ticketNo } = await ctx.params;
    const body = await readJson<UpdateTicketInput>(req);
    const ticket = updateTicket(decodeURIComponent(ticketNo), body);
    return json({ ticket });
  } catch (err) {
    return fail(err);
  }
}
