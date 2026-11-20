import { activeCalls, startCall } from "@/server/calls";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ calls: activeCalls() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST() {
  try {
    return json({ call: startCall() }, 201);
  } catch (err) {
    return fail(err);
  }
}
