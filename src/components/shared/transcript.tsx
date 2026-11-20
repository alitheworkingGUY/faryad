"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/domain";
import { cn } from "@/lib/utils";

const ARABIC_SCRIPT = /[؀-ۿ]/;

/** Text that may be Urdu or English: Urdu gets Nastaliq + RTL automatically. */
export function SmartText({ text, className }: { text: string; className?: string }) {
  const urdu = ARABIC_SCRIPT.test(text);
  return (
    <span dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"} className={cn(urdu && "ur", "block", className)}>
      {text}
    </span>
  );
}

export function TranscriptBubbles({
  lines,
  autoScroll = true,
  size = "md",
  className,
  emptyLabel = "The conversation will appear here as it happens.",
}: {
  lines: TranscriptLine[];
  autoScroll?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  emptyLabel?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = lines[lines.length - 1];

  // Follow the conversation by scrolling the nearest scrollable box only. scrollIntoView
  // would also scroll the page, which on a phone pushes the call controls off screen.
  useEffect(() => {
    if (!autoScroll) return;
    let box = endRef.current?.parentElement ?? null;
    while (box && box !== document.body) {
      const overflow = getComputedStyle(box).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && box.scrollHeight > box.clientHeight) {
        box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
        return;
      }
      box = box.parentElement;
    }
  }, [autoScroll, lines.length, last?.text]);

  const text = size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-[15px]";

  if (lines.length === 0) {
    return <p className={cn("px-2 py-6 text-center text-sm text-dim", className)}>{emptyLabel}</p>;
  }

  return (
    <div dir="ltr" className={cn("flex flex-col gap-2.5", className)}>
      <AnimatePresence initial={false}>
        {lines.map((line, i) => {
          const agent = line.role === "agent";
          return (
            <motion.div
              key={line.id ?? `${line.ts}-${i}`}
              layout="position"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={cn("flex items-end gap-2", agent ? "flex-row-reverse" : "flex-row")}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  agent ? "border-live/40 bg-live/15 text-live" : "border-line bg-panel-2 text-dim",
                )}
              >
                {agent ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
              </span>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl border px-3.5 py-2",
                  text,
                  agent
                    ? "rounded-br-md border-live/30 bg-live/10 text-fg"
                    : "rounded-bl-md border-line bg-panel-2 text-fg",
                  line.final === false && "opacity-80",
                )}
              >
                <SmartText text={line.text} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}
