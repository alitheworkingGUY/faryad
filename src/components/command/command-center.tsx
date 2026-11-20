"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { ErrorState } from "@/components/shared/states";
import { api } from "@/lib/api";
import { useLive } from "@/lib/store";
import { LiveCallPanel } from "./live-call-panel";
import { MapPanel, type MapLayers } from "./map-panel";
import { TicketFeed } from "./ticket-feed";
import { TopBar } from "./top-bar";

function Body() {
  const error = useLive((s) => s.error);
  const loaded = useLive((s) => s.loaded);
  const [layers, setLayers] = useState<MapLayers>({
    hidden: [],
    heatmap: false,
    showResolved: true,
    fullscreen: false,
  });

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => toast.error("Fullscreen was blocked by the browser"));
  }, []);

  useEffect(() => {
    const onChange = () => setLayers((l) => ({ ...l, fullscreen: Boolean(document.fullscreenElement) }));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard: F fullscreen, M heatmap, R resolved pins, S scripted call (stage fallback)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "f") toggleFullscreen();
      else if (key === "m") setLayers((l) => ({ ...l, heatmap: !l.heatmap }));
      else if (key === "r") setLayers((l) => ({ ...l, showResolved: !l.showResolved }));
      else if (key === "s") {
        api("/api/demo/simulate", { body: {} }).catch((err) => toast.error((err as Error).message));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  if (error && !loaded) {
    return <ErrorState message={error} onRetry={() => useLive.getState().load()} className="h-dvh" />;
  }

  return (
    <div className="flex h-dvh min-h-[640px] min-w-[1180px] flex-col">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[62fr_38fr] gap-4 px-4 pb-4">
        <MapPanel
          layers={layers}
          onChange={(next) => setLayers((l) => ({ ...l, ...next }))}
          onToggleFullscreen={toggleFullscreen}
        />
        <div className="grid min-h-0 grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
          <LiveCallPanel />
          <TicketFeed />
        </div>
      </div>
    </div>
  );
}

export function CommandCenter() {
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
