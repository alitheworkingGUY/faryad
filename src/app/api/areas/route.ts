import { areaDTO, listAreas } from "@/server/areas";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ areas: listAreas().map(areaDTO) });
  } catch (err) {
    return fail(err);
  }
}
