"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleCheck, Copy, Pause, Play, Share2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryTile } from "@/components/shared/category";
import { api } from "@/lib/api";
import { CATEGORY_META, isCategory, type LiveEvent, type Status, type TicketDTO } from "@/lib/domain";
import { toUrduNumerals } from "@/lib/format";
import { useLiveEvents } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { RegisteredTicket } from "./use-realtime-call";

const STEPS: { status: Status; ur: string; en: string }[] = [
  { status: "open", ur: "شکایت درج ہو گئی", en: "Registered" },
  { status: "assigned", ur: "ٹیم کے حوالے", en: "Assigned to a team" },
  { status: "in_progress", ur: "کام جاری ہے", en: "Work in progress" },
  { status: "resolved", ur: "مسئلہ حل ہو گیا", en: "Resolved" },
];

/** The big ticket card shown as soon as the agent registers the complaint. */
export function TicketCard({ ticket, compact = false }: { ticket: RegisteredTicket; compact?: boolean }) {
  const category = isCategory(ticket.category) ? ticket.category : "water";
  const meta = CATEGORY_META[category];
  const [copied, setCopied] = useState(false);

  const text = `فریاد ہیلپ لائن — شکایت نمبر ${ticket.ticketNo} (${meta.ur}، ${ticket.area})`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(ticket.ticketNo);
      setCopied(true);
      toast.success("شکایت نمبر کاپی ہو گیا");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("کاپی نہیں ہو سکا");
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Faryad", text });
      else await copy();
    } catch {
      // the share sheet was dismissed
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="w-full rounded-3xl border border-live/40 bg-gradient-to-b from-live/15 to-panel p-5 text-center shadow-[0_10px_40px_rgb(16_185_129/0.18)]"
    >
      <div className="flex items-center justify-center gap-2 text-live">
        <CircleCheck className="size-5" />
        <span className="ur ur-tight text-lg">آپ کی شکایت درج ہو گئی ہے</span>
      </div>
      <p className="mt-0.5 text-xs text-dim" dir="ltr">
        Your complaint is registered
      </p>

      <p className="ur ur-tight mt-4 text-sm text-dim">شکایت نمبر</p>
      <p dir="ltr" className={cn("font-semibold tracking-tight text-fg tnum", compact ? "text-4xl" : "text-5xl")}>
        {ticket.ticketNo}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 text-start">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-ink/60 p-3">
          <CategoryTile category={category} size="sm" />
          <div className="min-w-0">
            <p className="ur ur-tight truncate text-base text-fg">{meta.ur}</p>
            <p className="truncate text-[11px] text-dim" dir="ltr">
              {ticket.area}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-ink/60 p-3">
          <p className="ur ur-tight text-base text-fg">{toUrduNumerals(ticket.slaHours)} گھنٹوں میں حل</p>
          <p className="truncate text-[11px] text-dim" dir="ltr">
            {ticket.department} · within {ticket.slaHours}h
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={copy}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel-2 text-fg transition-colors active:bg-line"
          >
            {copied ? <Check className="size-4 text-live" /> : <Copy className="size-4" />}
            <span className="ur ur-tight text-base">کاپی کریں</span>
          </button>
          <button
            type="button"
            onClick={share}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-panel-2 text-fg transition-colors active:bg-line"
          >
            <Share2 className="size-4" />
            <span className="ur ur-tight text-base">شیئر کریں</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function VoiceNote({ url, autoPlay }: { url: string; autoPlay: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoPlay) return;
    // Autoplay can be refused by the browser; the play button below is the fallback.
    audio.play().catch(() => setBlocked(true));
  }, [autoPlay, url]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setBlocked(false);
      void audio.play().catch(() => toast.error("آڈیو نہیں چل سکی"));
    } else audio.pause();
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-live/40 bg-ink/60 p-3">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-full bg-live text-ink transition-transform active:scale-95",
          blocked && "animate-pulse",
        )}
      >
        {playing ? <Pause className="size-6" /> : <Play className="size-6 translate-x-0.5" />}
      </button>
      <div className="min-w-0 flex-1 text-start">
        <p className="ur ur-tight text-base text-fg">{blocked ? "صوتی پیغام سننے کے لیے دبائیں" : "صوتی پیغام"}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-dim" dir="ltr">
          <Volume2 className="size-3" /> {playing ? "Playing voice note…" : "Voice note from Faryad"}
        </p>
      </div>
    </div>
  );
}

/** Live status of the citizen's ticket; plays the Urdu voice note when it is resolved. */
export function TicketStatus({ ticket }: { ticket: RegisteredTicket }) {
  const [status, setStatus] = useState<Status>("open");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [justResolved, setJustResolved] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ ticket: TicketDTO }>(`/api/tickets/${encodeURIComponent(ticket.ticketNo)}`);
      setStatus(res.ticket.status);
      setAudioUrl(res.ticket.voiceNoteUrl);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [ticket.ticketNo]);

  useEffect(() => {
    void refresh();
    // Phones sleep and drop the live connection; catch up whenever the page is shown again.
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(refresh, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [refresh]);

  const onEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === "ticket.updated" && event.payload.ticketNo === ticket.ticketNo) {
        setStatus(event.payload.status);
        if (event.payload.voiceNoteUrl) setAudioUrl(event.payload.voiceNoteUrl);
      } else if (event.type === "citizen.notify" && event.payload.ticketNo === ticket.ticketNo) {
        setStatus("resolved");
        setJustResolved(true);
        if (event.payload.audioUrl) setAudioUrl(event.payload.audioUrl);
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      } else if (event.type === "demo.reset") {
        void refresh();
      }
    },
    [refresh, ticket.ticketNo],
  );
  useLiveEvents(onEvent);

  const index = STEPS.findIndex((s) => s.status === status);
  const resolved = status === "resolved";

  return (
    <div className="w-full">
      <AnimatePresence>
        {resolved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="mb-4 rounded-3xl border border-live/50 bg-live/15 p-5 text-center"
          >
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-live text-ink">
              <Check className="size-9" strokeWidth={3} />
            </div>
            <p className="ur ur-tight mt-3 text-2xl text-fg">آپ کی شکایت حل ہو گئی ✅</p>
            <p className="mt-1 text-sm text-dim" dir="ltr">
              Resolved · {ticket.ticketNo}
            </p>
            {audioUrl && <VoiceNote url={audioUrl} autoPlay={justResolved} />}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-3xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <p className="ur ur-tight text-lg text-fg">شکایت کی حالت</p>
          <span className="flex items-center gap-1.5 text-[11px] text-dim" dir="ltr">
            <span className="blink size-1.5 rounded-full bg-live" /> Live · {ticket.ticketNo}
          </span>
        </div>
        <ol className="relative mt-4 flex flex-col gap-4">
          <span className="absolute start-[13px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          {STEPS.map((step, i) => {
            const done = i <= index;
            const current = i === index && !resolved;
            return (
              <li key={step.status} className="relative flex items-center gap-3">
                <span
                  className={cn(
                    "z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300",
                    done ? "border-live bg-live text-ink" : "border-line bg-ink text-dim",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-line" />}
                </span>
                {current && <span className="pulse-ring absolute start-0 size-7 rounded-full border border-live" />}
                <div className="min-w-0">
                  <p className={cn("ur ur-tight text-base", done ? "text-fg" : "text-dim")}>{step.ur}</p>
                  <p className="text-[11px] text-dim" dir="ltr">
                    {step.en}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {loadError && (
          <p className="ur ur-tight mt-3 text-sm text-warn">حالت تازہ نہیں ہو سکی، دوبارہ کوشش جاری ہے…</p>
        )}
      </div>
    </div>
  );
}
