"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./worker";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import { CATEGORY_ICONS } from "@/components/shared/category";
import { DeptChip, StatusBadge } from "@/components/shared/chips";
import { CATEGORY_META, type IncidentDTO, type TicketDTO } from "@/lib/domain";
import { timeAgo } from "@/lib/format";
import { MAP_STYLE, PESHAWAR_BOUNDS } from "./style";

export type MapFocus = { lat: number; lng: number; zoom?: number; key: string | number };

type Props = {
  tickets: TicketDTO[];
  incidents?: IncidentDTO[];
  /** ticketNo -> arrival time, for the drop animation */
  fresh?: Record<string, number>;
  heatmap?: boolean;
  focus?: MapFocus | null;
  selectedTicketNo?: string | null;
  onTicketClick?: (ticketNo: string) => void;
  onIncidentClick?: (incident: IncidentDTO) => void;
};

const Pin = memo(function Pin({
  ticket,
  fresh,
  selected,
}: {
  ticket: TicketDTO;
  fresh: boolean;
  selected: boolean;
}) {
  const Icon = CATEGORY_ICONS[ticket.category];
  const color = CATEGORY_META[ticket.category].color;
  const resolved = ticket.status === "resolved";
  return (
    <motion.div
      initial={fresh ? { y: -70, opacity: 0, scale: 0.5 } : false}
      animate={{ y: 0, opacity: resolved ? 0.5 : 1, scale: selected ? 1.25 : 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
      className="relative grid size-8 cursor-pointer place-items-center"
    >
      {fresh && (
        <>
          <span className="ripple-once absolute inset-0 rounded-full border-2" style={{ borderColor: color }} />
          <span
            className="ripple-once absolute inset-0 rounded-full border-2"
            style={{ borderColor: color, animationDelay: "0.25s" }}
          />
        </>
      )}
      <span
        className="grid size-7 place-items-center rounded-full border-2 shadow-[0_2px_10px_rgb(0_0_0/0.55)]"
        style={{
          background: resolved ? "#16213A" : color,
          borderColor: resolved ? color : "#0B1220",
          boxShadow: selected ? `0 0 0 3px ${color}66, 0 2px 10px rgb(0 0 0 / 0.55)` : undefined,
        }}
      >
        <Icon className="size-3.5" style={{ color: resolved ? color : "#0B1220" }} strokeWidth={2.6} />
      </span>
      {resolved && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-live text-ink">
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
      )}
      {!resolved && ticket.priority === "urgent" && (
        <span className="blink absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-ink bg-danger" />
      )}
    </motion.div>
  );
});

function IncidentRing({ incident }: { incident: IncidentDTO }) {
  return (
    <div className="relative grid size-28 cursor-pointer place-items-center" title={incident.summary}>
      <span className="pulse-ring absolute size-16 rounded-full border-2 border-danger" />
      <span className="pulse-ring absolute size-16 rounded-full border-2 border-danger" style={{ animationDelay: "0.9s" }} />
      <span className="absolute size-20 rounded-full border border-danger/60 bg-danger/10" />
      <span className="absolute -top-0.5 flex items-center gap-1 rounded-full border border-danger bg-[#2a0f14] px-2 py-0.5 text-[11px] font-semibold text-danger shadow-lg tnum">
        <span className="blink size-1.5 rounded-full bg-danger" />
        {incident.ticketCount} reports
      </span>
    </div>
  );
}

function HoverCard({ ticket }: { ticket: TicketDTO }) {
  const meta = CATEGORY_META[ticket.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none w-64 rounded-xl border border-line bg-panel/95 p-3 text-left shadow-2xl backdrop-blur"
      dir="ltr"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg tnum">{ticket.ticketNo}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full" style={{ background: meta.color }} />
        <span className="font-medium" style={{ color: meta.color }}>
          {meta.en}
        </span>
        <span className="text-dim">·</span>
        <span className="truncate text-fg">{ticket.areaEn}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-dim">{ticket.descriptionEn}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-dim">
        <span>{timeAgo(ticket.createdAt)}</span>
        <DeptChip code={ticket.departmentCode} className="h-5" />
      </div>
    </motion.div>
  );
}

export default function CityMap({
  tickets,
  incidents = [],
  fresh = {},
  heatmap = false,
  focus,
  selectedTicketNo,
  onTicketClick,
  onIncidentClick,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 14,
      duration: 900,
      essential: true,
    });
  }, [focus]);

  const heatData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: tickets
        .filter((t) => t.status !== "resolved")
        .map((t) => ({
          type: "Feature" as const,
          properties: { weight: t.priority === "urgent" ? 2 : t.priority === "high" ? 1.5 : 1 },
          geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
        })),
    }),
    [tickets],
  );

  const hoveredTicket = hovered ? tickets.find((t) => t.ticketNo === hovered) : undefined;
  // Newest last, so the newest pin is drawn on top.
  const ordered = useMemo(() => [...tickets].sort((a, b) => a.createdAt - b.createdAt), [tickets]);

  return (
    <div dir="ltr" className="absolute inset-0">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ bounds: PESHAWAR_BOUNDS, fitBoundsOptions: { padding: 36 } }}
        minZoom={9.5}
        maxZoom={18}
        attributionControl={{ compact: true }}
        dragRotate={false}
        touchPitch={false}
        onError={() => {
          /* a missing tile is not worth an error overlay */
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {heatmap && (
          <Source id="heat" type="geojson" data={heatData}>
            <Layer
              id="heat-layer"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "weight"],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 15, 2.2],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 34, 15, 70],
                "heatmap-opacity": 0.72,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(16,185,129,0)",
                  0.2,
                  "rgba(16,185,129,0.55)",
                  0.5,
                  "rgba(245,158,11,0.75)",
                  0.8,
                  "rgba(239,68,68,0.85)",
                  1,
                  "rgba(254,202,202,0.95)",
                ],
              }}
            />
          </Source>
        )}

        {incidents
          .filter((i) => i.status === "active")
          .map((i) => (
            <Marker
              key={`incident-${i.id}`}
              longitude={i.lng}
              latitude={i.lat}
              anchor="center"
              style={{ zIndex: 1 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onIncidentClick?.(i);
              }}
            >
              <IncidentRing incident={i} />
            </Marker>
          ))}

        {ordered.map((t) => {
          const arrived = fresh[t.ticketNo];
          const isFresh = Boolean(arrived && arrived >= mountedAt);
          return (
            <Marker
              key={t.ticketNo}
              longitude={t.lng}
              latitude={t.lat}
              anchor="center"
              style={{ zIndex: hovered === t.ticketNo || selectedTicketNo === t.ticketNo ? 6 : isFresh ? 5 : 2 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onTicketClick?.(t.ticketNo);
              }}
            >
              <div onMouseEnter={() => setHovered(t.ticketNo)} onMouseLeave={() => setHovered(null)}>
                <Pin ticket={t} fresh={isFresh} selected={selectedTicketNo === t.ticketNo} />
              </div>
            </Marker>
          );
        })}

        {hoveredTicket && (
          <Marker
            longitude={hoveredTicket.lng}
            latitude={hoveredTicket.lat}
            anchor="bottom"
            offset={[0, -22]}
            style={{ zIndex: 10, pointerEvents: "none" }}
          >
            <HoverCard ticket={hoveredTicket} />
          </Marker>
        )}
      </Map>
    </div>
  );
}
