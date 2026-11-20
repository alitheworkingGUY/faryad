// `npm run tiles` - fills the local map-tile cache for greater Peshawar so the
// map appears instantly on stage. The dev server must be running.
//   node scripts/prewarm-tiles.mjs [maxZoom=15] [baseUrl=http://localhost:3000]
const maxZoom = Number(process.argv[2] ?? 15);
const base = process.argv[3] ?? "http://localhost:3000";
const BOUNDS = { west: 71.36, south: 33.92, east: 71.67, north: 34.13 };

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

const jobs = [];
for (let z = 9; z <= maxZoom; z++) {
  const x0 = lon2x(BOUNDS.west, z), x1 = lon2x(BOUNDS.east, z);
  const y0 = lat2y(BOUNDS.north, z), y1 = lat2y(BOUNDS.south, z);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(`${z}/${x}/${y}`);
}

console.log(`Caching ${jobs.length} tiles (zoom 9-${maxZoom}) through ${base} ...`);
let done = 0, failed = 0;
async function worker() {
  for (;;) {
    const job = jobs.shift();
    if (!job) return;
    try {
      const res = await fetch(`${base}/api/tiles/${job}`);
      if (!res.ok || res.headers.get("x-faryad-tile") === "miss") failed++;
      await res.arrayBuffer();
    } catch {
      failed++;
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done} done, ${failed} failed, ${jobs.length} left`);
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`Finished: ${done - failed} cached, ${failed} failed.`);
