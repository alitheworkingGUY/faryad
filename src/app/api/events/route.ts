import { pollEvents } from "@/server/bus";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Long-poll twin of /api/stream. A normal request that is held open until the
 * next live event (at most 20 s), so it passes through proxies that buffer
 * Server-Sent Events, such as Cloudflare quick tunnels.
 *
 *   GET /api/events                      -> { epoch, seq, events: [] }   (where to start from)
 *   GET /api/events?since=<seq>&epoch=…  -> waits, then { epoch, seq, events, reset }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sinceRaw = url.searchParams.get("since");
    const since = sinceRaw == null ? null : Number(sinceRaw);
    const result = await pollEvents(since, url.searchParams.get("epoch"), 20_000, req.signal);
    return json(result);
  } catch (err) {
    return fail(err);
  }
}
