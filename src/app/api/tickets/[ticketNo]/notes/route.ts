import { fail, json, readJson } from "@/server/http";
import { addNote } from "@/server/tickets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ticketNo: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { ticketNo } = await ctx.params;
    const body = await readJson<{ text?: string; actor?: string }>(req);
    const events = addNote(decodeURIComponent(ticketNo), body.text ?? "", body.actor);
    return json({ events }, 201);
  } catch (err) {
    return fail(err);
  }
}
