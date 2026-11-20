import { endCall, getCall } from "@/server/calls";
import { fail, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const call = getCall(id);
    if (!call) return json({ error: "Call not found" }, 404);
    return json({ call });
  } catch (err) {
    return fail(err);
  }
}

/** Ends the call. Also accepts POST so `navigator.sendBeacon` can close it when the tab goes away. */
async function end(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await readJson<{ seconds?: number; costUsd?: number }>(req);
    return json({ call: endCall(id, body) });
  } catch (err) {
    return fail(err);
  }
}

export const PATCH = end;
export const POST = end;
