import { areaDTO, isInPeshawar, listAreas, nearestArea } from "@/server/areas";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** All areas. With ?lat=&lng= it also returns the nearest area to that point. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const hasPoint = url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng);
    const inServiceArea = hasPoint ? isInPeshawar(lat, lng) : undefined;
    const nearest = hasPoint && inServiceArea ? nearestArea(lat, lng) : null;
    return json({
      areas: listAreas().map(areaDTO),
      ...(hasPoint ? { inServiceArea, nearest: nearest ? areaDTO(nearest) : null } : {}),
    });
  } catch (err) {
    return fail(err);
  }
}
