import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ z: string; x: string; y: string }> };

// Caching proxy for OpenStreetMap raster tiles. Each tile is fetched from OSM
// once and then served from data/tiles, so the map loads instantly and keeps
// working if the venue network is slow. `npm run tiles` pre-fills the cache.
const UPSTREAM = process.env.MAP_TILE_UPSTREAM || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAX_PARALLEL = 4;
// 1x1 transparent PNG
const EMPTY_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

type TileState = { pending: Map<string, Promise<Buffer | null>>; active: number; queue: (() => void)[] };
const g = globalThis as unknown as { __faryadTiles?: TileState };
const state: TileState = (g.__faryadTiles ??= { pending: new Map(), active: 0, queue: [] });

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (state.active >= MAX_PARALLEL) await new Promise<void>((resolve) => state.queue.push(resolve));
  state.active++;
  try {
    return await fn();
  } finally {
    state.active--;
    state.queue.shift()?.();
  }
}

async function fetchTile(z: number, x: number, y: number, file: string): Promise<Buffer | null> {
  const url = UPSTREAM.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  return withSlot(async () => {
    // The public tile servers occasionally stall a connection, so try twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Faryad-prototype/0.1 (municipal helpline demo; cached tiles)" },
          signal: AbortSignal.timeout(attempt === 0 ? 7_000 : 12_000),
        });
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) continue;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buffer);
        return buffer;
      } catch {
        // retry once
      }
    }
    return null;
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const p = await ctx.params;
  const z = Number(p.z);
  const x = Number(p.x);
  const y = Number(p.y.replace(/\.png$/, ""));
  const max = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= max || y >= max) {
    return new Response("Bad tile", { status: 400 });
  }
  const file = path.join(process.cwd(), "data", "tiles", String(z), String(x), `${y}.png`);
  const key = `${z}/${x}/${y}`;

  let data: Buffer | null = null;
  if (fs.existsSync(file)) {
    data = fs.readFileSync(file);
  } else {
    let pending = state.pending.get(key);
    if (!pending) {
      pending = fetchTile(z, x, y, file).finally(() => state.pending.delete(key));
      state.pending.set(key, pending);
    }
    data = await pending;
  }
  if (!data) {
    // Upstream is unreachable: answer with a transparent tile (not cached) so the map
    // shows the navy background there instead of raising errors in the console.
    return new Response(new Uint8Array(EMPTY_TILE), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Faryad-Tile": "miss" },
    });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
