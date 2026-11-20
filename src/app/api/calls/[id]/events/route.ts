import { addCallEvent, type CallEventInput } from "@/server/calls";
import { fail, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Live call events from the caller's browser: transcript lines, metrics, GPS, human-needed. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await readJson<CallEventInput | { events: CallEventInput[] }>(req);
    const events = "events" in body && Array.isArray(body.events) ? body.events : [body as CallEventInput];
    let result: ReturnType<typeof addCallEvent> = { ok: true };
    for (const event of events) result = { ...result, ...addCallEvent(id, event) };
    return json(result);
  } catch (err) {
    return fail(err);
  }
}
