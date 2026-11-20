import fs from "node:fs";
import path from "node:path";
import { getStore } from "@/db";
import { seedDatabase } from "@/db/seed";
import { broadcast } from "@/server/bus";
import { fail, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Reseeds tickets, calls and incidents and tells every open screen to reload its data. */
export async function POST() {
  try {
    const result = seedDatabase(getStore());
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (fs.existsSync(audioDir)) {
      for (const file of fs.readdirSync(audioDir)) {
        if (file.endsWith(".mp3")) fs.rmSync(path.join(audioDir, file), { force: true });
      }
    }
    broadcast({ type: "demo.reset", payload: {} });
    return json({ ok: true, ...result });
  } catch (err) {
    return fail(err);
  }
}
