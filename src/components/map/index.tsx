"use client";

import dynamic from "next/dynamic";

function MapSkeleton() {
  return (
    <div className="grid-backdrop absolute inset-0 grid place-items-center bg-ink">
      <div className="flex flex-col items-center gap-3 text-dim">
        <div className="relative size-10">
          <span className="absolute inset-0 rounded-full border-2 border-line" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-live" />
        </div>
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  );
}

// MapLibre needs the browser (WebGL, window), so both maps load on the client only.
export const CityMap = dynamic(() => import("./city-map"), { ssr: false, loading: MapSkeleton });
export const MiniMap = dynamic(() => import("./mini-map-inner"), { ssr: false, loading: MapSkeleton });

export type { MapFocus } from "./city-map";
