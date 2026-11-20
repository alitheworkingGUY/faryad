import { fail, json } from "@/server/http";
import { listIncidents } from "@/server/incidents";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ incidents: listIncidents() });
  } catch (err) {
    return fail(err);
  }
}
