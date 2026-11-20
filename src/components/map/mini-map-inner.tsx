"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./worker";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { CATEGORY_ICONS } from "@/components/shared/category";
import { CATEGORY_META, type Category } from "@/lib/domain";
import { MAP_STYLE } from "./style";

export type MiniMapProps = {
  lat: number;
  lng: number;
  category: Category;
  zoom?: number;
  /** When set, clicking the map proposes a new position ("mark place"). */
  picking?: boolean;
  picked?: { lat: number; lng: number } | null;
  onPick?: (pos: { lat: number; lng: number }) => void;
  interactive?: boolean;
};

export default function MiniMapInner({
  lat,
  lng,
  category,
  zoom = 14.2,
  picking = false,
  picked,
  onPick,
  interactive = true,
}: MiniMapProps) {
  const ref = useRef<MapRef>(null);
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_META[category].color;

  useEffect(() => {
    ref.current?.easeTo({ center: [lng, lat], duration: 500 });
  }, [lat, lng]);

  return (
    <div dir="ltr" className="absolute inset-0">
      <Map
        ref={ref}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: lng, latitude: lat, zoom }}
        attributionControl={false}
        dragRotate={false}
        touchPitch={false}
        interactive={interactive}
        cursor={picking ? "crosshair" : undefined}
        onClick={(e) => {
          if (picking) onPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
        onError={() => {
          /* a missing tile is not worth an error overlay */
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {interactive && <NavigationControl position="bottom-right" showCompass={false} />}
        <Marker longitude={lng} latitude={lat} anchor="center">
          <div className="relative grid size-10 place-items-center" style={{ opacity: picked ? 0.45 : 1 }}>
            <span className="pulse-ring-slow absolute size-8 rounded-full border-2" style={{ borderColor: color }} />
            <span
              className="grid size-8 place-items-center rounded-full border-2 border-ink shadow-lg"
              style={{ background: color }}
            >
              <Icon className="size-4 text-ink" strokeWidth={2.6} />
            </span>
          </div>
        </Marker>
        {picked && (
          <Marker longitude={picked.lng} latitude={picked.lat} anchor="bottom">
            <MapPin className="size-9 fill-live/30 text-live drop-shadow-lg" strokeWidth={2.2} />
          </Marker>
        )}
      </Map>
      <span className="pointer-events-none absolute start-2 bottom-1.5 rounded bg-ink/70 px-1.5 text-[10px] leading-4 text-dim">
        © OpenStreetMap contributors
      </span>
    </div>
  );
}
