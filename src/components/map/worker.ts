import { setWorkerUrl } from "maplibre-gl";

// Served from /public (copied there by scripts/copy-map-worker.mjs before dev/build).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
