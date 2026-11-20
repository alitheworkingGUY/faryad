import { fail, json } from "@/server/http";
import { getAnalytics } from "@/server/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(getAnalytics());
  } catch (err) {
    return fail(err);
  }
}
