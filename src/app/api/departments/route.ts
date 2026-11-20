import { departmentDTO, refs } from "@/server/dto";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ departments: [...refs().depts.values()].map(departmentDTO) });
  } catch (err) {
    return fail(err);
  }
}
