"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Headset,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import { TranscriptBubbles } from "@/components/shared/transcript";
import { api } from "@/lib/api";
import type { AreaDTO } from "@/lib/domain";
import { clock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Orb } from "./orb";
import { TicketCard, TicketStatus } from "./ticket-status";
import { useRealtimeCall, type CallProblem, type Gps, type RegisteredTicket } from "./use-realtime-call";

const STORAGE_KEY = "faryad.ticket";

const PROBLEMS: Record<CallProblem["code"], { ur: string; en: string; hintUr?: string }> = {
  mic_denied: {
    ur: "مائیکروفون کی اجازت نہیں ملی",
    en: "Microphone permission was not given",
    hintUr: "براؤزر کے ایڈریس بار میں تالے کے نشان پر دبائیں، مائیکروفون کی اجازت دیں، پھر دوبارہ کوشش کریں۔",
  },
  mic_missing: { ur: "اس فون میں مائیکروفون نہیں ملا", en: "No microphone was found" },
  insecure: {
    ur: "یہ صفحہ محفوظ لنک پر کھولیں",
    en: "Open this page from the QR code (https) to use the microphone",
  },
  not_configured: {
    ur: "ہیلپ لائن اس وقت دستیاب نہیں",
    en: "The voice agent is not available right now",
    hintUr: "تھوڑی دیر بعد دوبارہ کوشش کریں۔",
  },
  network: {
    ur: "رابطہ منقطع ہو گیا",
    en: "The connection was lost",
    hintUr: "انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔",
  },
  unknown: { ur: "کال نہیں مل سکی", en: "The call could not be connected" },
};

/** Urdu line with a small English line underneath. */
function Dual({ ur, en, className, enClassName }: { ur: string; en: string; className?: string; enClassName?: string }) {
  return (
    <div className="text-center">
      <p className={cn("ur", className)}>{ur}</p>
      <p dir="ltr" className={cn("mt-1 text-sm text-dim", enClassName)}>
        {en}
      </p>
    </div>
  );
}

function LocationButton({
  gps,
  busy,
  onShare,
  compact = false,
}: {
  gps: Gps | null;
  busy: boolean;
  onShare: () => void;
  compact?: boolean;
}) {
  if (gps) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl border border-live/40 bg-live/10 text-live",
          compact ? "h-11 px-3" : "h-14 px-4",
        )}
      >
        <Check className="size-4 shrink-0" />
        <span className="ur ur-tight truncate text-base">
          {gps.inServiceArea === false
            ? "لوکیشن مل گئی (پشاور سے باہر)"
            : gps.nearestArea
              ? `لوکیشن مل گئی · ${gps.nearestArea}`
              : "لوکیشن مل گئی"}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onShare}
      disabled={busy}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-panel text-fg transition-colors active:bg-panel-2 disabled:opacity-70",
        compact ? "h-11 px-3" : "h-14 px-4",
      )}
    >
      {busy ? <LoaderCircle className="size-5 animate-spin text-live" /> : <LocateFixed className="size-5 text-live" />}
      <span className="flex items-baseline gap-2">
        <span className="ur ur-tight text-lg">📍 اپنی لوکیشن بھیجیں</span>
        {!compact && (
          <span dir="ltr" className="text-xs text-dim">
            Share my location
          </span>
        )}
      </span>
    </button>
  );
}

export function CallScreen() {
  const [gps, setGps] = useState<Gps | null>(null);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState<RegisteredTicket | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const { call, levelRef, audioRef } = useRealtimeCall(gps);
  const { phase, ticket } = call;

  // A ticket from an earlier visit: the citizen can come back to follow it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSaved(JSON.parse(raw) as RegisteredTicket);
        setShowStatus(true);
      }
    } catch {
      // nothing saved
    }
  }, []);

  useEffect(() => {
    if (!ticket) return;
    setSaved(ticket);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
    } catch {
      // storage unavailable
    }
  }, [ticket]);

  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("اس فون پر لوکیشن دستیاب نہیں");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let extra: { nearestArea?: string | null; inServiceArea?: boolean } = {};
        try {
          const res = await api<{ inServiceArea?: boolean; nearest?: AreaDTO | null }>(
            `/api/areas?lat=${point.lat}&lng=${point.lng}`,
          );
          extra = { nearestArea: res.nearest?.nameEn ?? null, inServiceArea: res.inServiceArea };
        } catch {
          // the location itself is still usable
        }
        setGps({ ...point, ...extra });
        setLocating(false);
        toast.success("لوکیشن مل گئی");
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "لوکیشن کی اجازت نہیں ملی" : "لوکیشن معلوم نہیں ہو سکی");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  function newComplaint() {
    setShowStatus(false);
    call.reset();
  }

  function forgetTicket() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSaved(null);
    newComplaint();
  }

  const live = phase === "live";
  const connecting = phase === "connecting";
  const view: "welcome" | "call" | "status" | "ended" | "error" =
    phase === "error"
      ? "error"
      : live || connecting
        ? "call"
        : phase === "ended"
          ? ticket
            ? "status"
            : "ended"
          : showStatus && saved
            ? "status"
            : "welcome";
  const statusTicket = ticket ?? saved;

  return (
    <div
      dir="rtl"
      lang="ur"
      className={cn(
        "mx-auto flex w-full max-w-md flex-col bg-ink px-5 pt-5 pb-7",
        // During a call the screen is exactly one viewport tall: captions scroll inside
        // their box and the End call button never leaves the screen.
        view === "call" ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <header className="flex items-center justify-between" dir="ltr">
        <Logo size="sm" />
        <span className="flex items-center gap-1.5 rounded-full border border-live/40 bg-live/10 px-2.5 py-1 text-[11px] font-medium text-live">
          <span className="blink size-1.5 rounded-full bg-live" /> 24/7
        </span>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {view === "welcome" && (
          <motion.main
            key="welcome"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col items-center"
          >
            <div className="mt-10">
              <Dual
                ur="فریاد ہیلپ لائن"
                en="Peshawar municipal complaint helpline"
                className="text-4xl text-fg"
              />
            </div>
            <p className="ur mt-5 max-w-xs text-center text-lg text-dim">
              پانی، بجلی، کچرے یا سڑک کا مسئلہ ہے؟ بٹن دبائیں اور اردو میں بتائیں۔
            </p>

            <div className="relative mt-10 grid size-56 place-items-center">
              <span className="pulse-ring-slow absolute size-40 rounded-full border border-live/50" />
              <span className="pulse-ring-slow absolute size-40 rounded-full border border-live/50" style={{ animationDelay: "1.3s" }} />
              <button
                type="button"
                onClick={call.start}
                aria-label="Start talking"
                className="relative grid size-40 place-items-center rounded-full bg-live text-ink shadow-[0_0_60px_rgb(16_185_129/0.45)] transition-transform duration-200 active:scale-95"
              >
                <Mic className="size-16" strokeWidth={1.8} />
              </button>
            </div>
            <div className="mt-5">
              <Dual ur="بات شروع کریں" en="Tap to start talking" className="text-3xl text-fg" />
            </div>

            <div className="mt-auto w-full pt-8">
              <LocationButton gps={gps} busy={locating} onShare={shareLocation} />
              <p className="ur ur-tight mt-2 text-center text-sm text-dim">
                لوکیشن بھیجنے سے ٹیم سیدھی آپ کی جگہ پر پہنچے گی
              </p>
              {saved && (
                <button
                  type="button"
                  onClick={() => setShowStatus(true)}
                  className="mt-4 flex h-12 w-full items-center justify-between rounded-2xl border border-line bg-panel px-4"
                >
                  <span className="ur ur-tight text-base text-fg">پچھلی شکایت کی حالت دیکھیں</span>
                  <span dir="ltr" className="text-sm font-semibold text-live tnum">
                    {saved.ticketNo}
                  </span>
                </button>
              )}
              <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-dim" dir="ltr">
                <ShieldCheck className="size-3.5" /> Free · Urdu & English · Your number stays private
              </p>
            </div>
          </motion.main>
        )}

        {view === "call" && (
          <motion.main
            key="call"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col items-center"
          >
            <div className="mt-3 flex items-center gap-2 text-sm" dir="ltr">
              {connecting ? (
                <span className="flex items-center gap-2 text-dim">
                  <LoaderCircle className="size-4 animate-spin text-live" /> Connecting…
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 rounded-full border border-danger/50 bg-danger/15 px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-danger uppercase">
                    <span className="blink size-1.5 rounded-full bg-danger" /> Live
                  </span>
                  <span className="text-lg font-semibold text-fg tnum">{clock(call.seconds)}</span>
                </>
              )}
            </div>

            {ticket ? (
              <div className="mt-4 w-full">
                <TicketCard ticket={ticket} compact />
              </div>
            ) : (
              <Orb levelRef={levelRef} speaking={call.speaking} active={live} className="mt-2" />
            )}

            <p className="ur ur-tight mt-1 h-8 text-center text-lg text-dim">
              {connecting
                ? "رابطہ ہو رہا ہے…"
                : call.muted
                  ? "مائیک بند ہے"
                  : call.speaking === "agent"
                    ? "فریاد بول رہی ہے"
                    : call.speaking === "caller"
                      ? "آپ کی بات سنی جا رہی ہے"
                      : "بولیں، میں سن رہی ہوں"}
            </p>

            {call.humanAlerted && (
              <div className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                <Headset className="size-4 shrink-0" />
                <span className="ur ur-tight text-sm">افسر کو اطلاع دے دی گئی ہے، وہ جلد آپ سے رابطہ کریں گے</span>
              </div>
            )}

            <div className="scroll-thin mt-3 min-h-20 w-full flex-1 overflow-y-auto rounded-3xl border border-line bg-panel/60 p-3">
              <TranscriptBubbles lines={call.lines} size="lg" emptyLabel="گفتگو یہاں نظر آئے گی" />
            </div>

            {!gps && live && (
              <div className="mt-3 w-full">
                <LocationButton gps={gps} busy={locating} onShare={shareLocation} compact />
              </div>
            )}

            <div className="mt-4 flex w-full items-center justify-center gap-6" dir="ltr">
              <button
                type="button"
                onClick={call.toggleMute}
                disabled={!live}
                aria-label={call.muted ? "Unmute" : "Mute"}
                className={cn(
                  "grid size-14 place-items-center rounded-full border transition-colors disabled:opacity-40",
                  call.muted ? "border-warn/50 bg-warn/15 text-warn" : "border-line bg-panel text-fg",
                )}
              >
                {call.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
              <button
                type="button"
                onClick={() => call.end()}
                aria-label="End call"
                className="flex h-16 items-center gap-3 rounded-full bg-danger px-8 text-white shadow-[0_8px_30px_rgb(239_68_68/0.35)] transition-transform active:scale-95"
              >
                <PhoneOff className="size-6" />
                <span className="ur ur-tight text-xl">کال ختم کریں</span>
              </button>
            </div>
          </motion.main>
        )}

        {view === "status" && statusTicket && (
          <motion.main
            key="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col items-center gap-4 pt-6"
          >
            <TicketCard ticket={statusTicket} />
            <TicketStatus key={statusTicket.ticketNo} ticket={statusTicket} />
            <div className="mt-auto grid w-full grid-cols-1 gap-2.5 pt-2">
              <button
                type="button"
                onClick={newComplaint}
                className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-live text-ink transition-transform active:scale-[0.98]"
              >
                <Mic className="size-5" />
                <span className="ur ur-tight text-xl">نئی شکایت درج کریں</span>
              </button>
              <button type="button" onClick={forgetTicket} className="h-9 text-xs text-dim underline-offset-4 hover:underline" dir="ltr">
                Clear this ticket from my phone
              </button>
            </div>
          </motion.main>
        )}

        {view === "ended" && (
          <motion.main
            key="ended"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <span className="grid size-20 place-items-center rounded-full border border-line bg-panel text-dim">
              <PhoneOff className="size-8" />
            </span>
            <Dual
              ur={call.problem ? "کال منقطع ہو گئی" : "کال ختم ہو گئی"}
              en={call.problem ? "The call was disconnected" : `Call ended · ${clock(call.seconds)}`}
              className="text-3xl text-fg"
            />
            <p className="ur max-w-xs text-center text-lg text-dim">
              {call.problem ? "دوبارہ کال کر کے اپنی شکایت مکمل کریں۔" : "فریاد ہیلپ لائن استعمال کرنے کا شکریہ۔"}
            </p>
            <button
              type="button"
              onClick={call.start}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-live text-ink transition-transform active:scale-[0.98]"
            >
              <Mic className="size-5" />
              <span className="ur ur-tight text-xl">دوبارہ بات کریں</span>
            </button>
          </motion.main>
        )}

        {view === "error" && call.problem && (
          <motion.main
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col items-center justify-center gap-5"
          >
            <span className="grid size-20 place-items-center rounded-full border border-warn/40 bg-warn/10 text-warn">
              {call.problem.code === "mic_denied" || call.problem.code === "mic_missing" ? (
                <MicOff className="size-8" />
              ) : (
                <TriangleAlert className="size-8" />
              )}
            </span>
            <Dual
              ur={PROBLEMS[call.problem.code].ur}
              en={PROBLEMS[call.problem.code].en}
              className="text-3xl text-fg"
            />
            {PROBLEMS[call.problem.code].hintUr && (
              <p className="ur max-w-xs text-center text-base text-dim">{PROBLEMS[call.problem.code].hintUr}</p>
            )}
            <button
              type="button"
              onClick={call.start}
              className="mt-2 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-live text-ink transition-transform active:scale-[0.98]"
            >
              <RotateCcw className="size-5" />
              <span className="ur ur-tight text-xl">دوبارہ کوشش کریں</span>
            </button>
            <button type="button" onClick={call.reset} className="flex items-center gap-1.5 text-sm text-dim">
              <MapPin className="hidden" />
              <span className="ur ur-tight">واپس جائیں</span>
            </button>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
