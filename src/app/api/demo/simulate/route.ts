import { fail, json, readJson } from "@/server/http";
import { listScenarios, simulateCall } from "@/server/simulate";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ scenarios: listScenarios() });
}

/** Plays a scripted call through the real pipeline (stage fallback / rehearsal). */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ scenario?: string; speed?: number }>(req);
    const speed = Math.min(4, Math.max(0.5, Number(body.speed) || 1));
    return json(simulateCall(body.scenario, speed), 202);
  } catch (err) {
    return fail(err);
  }
}
