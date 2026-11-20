import { fail, json } from "@/server/http";
import { statusForCaller } from "@/server/tickets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticketNo = url.searchParams.get("ticketNo") ?? url.searchParams.get("ticket_no");
    const phone = url.searchParams.get("phone");
    if (!ticketNo && !phone) return json({ error: "Provide ticketNo or phone" }, 400);
    return json(statusForCaller({ ticketNo, phone }));
  } catch (err) {
    return fail(err);
  }
}
