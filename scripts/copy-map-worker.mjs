// MapLibre v6 loads its web worker from a URL. Turbopack does not emit that file,
// so it is copied into /public and the map components point MapLibre at it.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const to = join(root, "public", "maplibre", "maplibre-gl-worker.mjs");

if (existsSync(from)) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
} else {
  console.warn("[faryad] maplibre-gl worker not found; run npm install first");
}
