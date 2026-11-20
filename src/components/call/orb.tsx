"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The call orb. It breathes when idle and swells with the voice of whoever is
 * speaking: emerald for the agent, sky blue for the caller.
 */
export function Orb({
  levelRef,
  speaking,
  active,
  className,
}: {
  levelRef: React.RefObject<number>;
  speaking: "agent" | "caller" | null;
  active: boolean;
  className?: string;
}) {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const loop = () => {
      t += 0.016;
      const level = active ? (levelRef.current ?? 0) : 0;
      const breathe = Math.sin(t * 1.6) * 0.025;
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + breathe + level * 0.28})`;
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${1.15 + level * 0.9})`;
        haloRef.current.style.opacity = String(0.25 + level * 0.6);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef]);

  const color = speaking === "caller" ? "56 189 248" : "16 185 129";

  return (
    <div className={cn("relative grid size-56 place-items-center", className)} aria-hidden="true">
      <div
        ref={haloRef}
        className="absolute size-44 rounded-full blur-2xl transition-colors duration-300"
        style={{ background: `rgb(${color} / 0.55)` }}
      />
      {active && (
        <>
          <span className="pulse-ring-slow absolute size-40 rounded-full border" style={{ borderColor: `rgb(${color} / 0.5)` }} />
          <span
            className="pulse-ring-slow absolute size-40 rounded-full border"
            style={{ borderColor: `rgb(${color} / 0.5)`, animationDelay: "1.3s" }}
          />
        </>
      )}
      <div
        ref={coreRef}
        className="relative size-40 rounded-full transition-[background] duration-300 will-change-transform"
        style={{
          background: `radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.55), rgb(${color} / 0.95) 38%, rgb(${color} / 0.55) 70%, rgb(11 18 32 / 0.9) 100%)`,
          boxShadow: `0 0 60px rgb(${color} / 0.45), inset 0 -18px 40px rgb(11 18 32 / 0.55)`,
        }}
      />
    </div>
  );
}
