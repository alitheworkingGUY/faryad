import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ file: string }> };

/**
 * Serves voice notes generated at runtime. They are written to public/audio,
 * but a file created after the server started is not reliably served from
 * /public, so they are streamed from here instead.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { file } = await ctx.params;
  if (!/^[A-Za-z0-9._-]+\.mp3$/.test(file)) return new Response("Not found", { status: 404 });
  const full = path.join(process.cwd(), "public", "audio", file);
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  const data = fs.readFileSync(full);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "none",
    },
  });
}
