"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CircleCheck,
  FileText,
  Headset,
  LocateFixed,
  MapPin,
  Phone,
  PhoneCall,
  Tag,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { CATEGORY_ICONS } from "@/components/shared/category";
import { TranscriptBubbles } from "@/components/shared/transcript";
import { foreignPlatformPkr } from "@/config/pricing";
import { CATEGORY_META, MOOD_META } from "@/lib/domain";
import { clock } from "@/lib/format";
import { Bi, Ur, useLang } from "@/lib/i18n";
import { useLive, type LiveCall } from "@/lib/store";
import { cn } from "@/lib/utils";

function Waveform({ active, bars = 22 }: { active: boolean; bars?: number }) {
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full bg-live", active ? "wave-bar" : "opacity-30")}
          style={{
            height: `${30 + ((i * 37) % 70)}%`,
            animationDelay: `${(i * 0.07) % 0.9}s`,
            animationDuration: `${0.7 + ((i * 13) % 5) * 0.12}s`,
            transform: active ? undefined : "scaleY(0.25)",
          }}
        />
      ))}
    </div>
  );
}

function useCallUrl(): { url: string; local: boolean } {
  const base = useLive((s) => s.publicBaseUrl);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const root = base || origin;
  return { url: root ? `${root}/call` : "", local: !base && /localhost|127\.0\.0\.1/.test(origin) };
}

function Idle() {
  const { url, local } = useCallUrl();
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-8 px-8 py-6">
      <div className="flex flex-col items-start gap-4 ps-2">
        <div className="relative grid size-40 place-items-center">
          <span className="pulse-ring-slow absolute size-16 rounded-full border border-live/60" />
          <span className="pulse-ring-slow absolute size-16 rounded-full border border-live/60" style={{ animationDelay: "1.3s" }} />
          <span className="absolute size-32 rounded-full border border-line" />
          <span className="absolute size-20 rounded-full border border-line/70" />
          <span className="radar-sweep absolute size-32 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgb(16_185_129/0.3)_70deg,transparent_72deg)]" />
          <span className="relative grid size-14 place-items-center rounded-full border border-live/50 bg-ink text-live">
            <Headset className="size-6" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-fg">
            <Bi en="Waiting for calls…" ur="کال کا انتظار ہے" stack secondaryClassName="mt-1 text-lg" />
          </p>
          <p className="mt-3 max-w-sm text-sm text-dim">
            <Bi
              en="The AI agent answers in Urdu, registers the complaint and pins it on the map."
              ur="اے آئی ایجنٹ اردو میں جواب دیتا ہے، شکایت درج کرتا ہے اور نقشے پر نشان لگاتا ہے۔"
              only
            />
          </p>
        </div>
      </div>

      <div className="flex w-[268px] flex-col items-center rounded-2xl border border-line bg-panel-2 p-5 text-center">
        <div className="rounded-xl bg-white p-3">
          {url ? (
            <QRCodeSVG value={url} size={184} level="M" marginSize={0} bgColor="#ffffff" fgColor="#0B1220" />
          ) : (
            <div className="size-[184px] animate-pulse rounded bg-slate-200" />
          )}
        </div>
        <p className="mt-4 text-base font-semibold text-fg">Scan to report a complaint</p>
        <Ur as="p" className="mt-0.5 text-base text-live">
          شکایت درج کرانے کے لیے اسکین کریں
        </Ur>
        <p dir="ltr" className="mt-2 w-full truncate text-[11px] text-dim">
          {url.replace(/^https?:\/\//, "")}
        </p>
        {local && (
          <p className="mt-2 flex items-start gap-1.5 text-start text-[11px] leading-snug text-warn">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            Phones cannot open localhost. Set the tunnel URL in Settings.
          </p>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  en,
  ur,
  value,
  accent,
  urduValue = false,
}: {
  icon: LucideIcon;
  en: string;
  ur: string;
  value?: string;
  accent?: string;
  urduValue?: boolean;
}) {
  const filled = Boolean(value);
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition-colors duration-300",
          filled ? "border-live/40 bg-live/15 text-live" : "border-line bg-panel-2 text-dim/60",
        )}
        style={filled && accent ? { borderColor: `${accent}66`, background: `${accent}22`, color: accent } : undefined}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-dim uppercase">
          <Bi en={en} ur={ur} only />
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {filled ? (
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("text-[15px] font-medium text-fg", urduValue ? "ur ur-tight" : "line-clamp-2")}
              style={accent ? { color: accent } : undefined}
            >
              {value}
            </motion.p>
          ) : (
            <motion.div key="empty" exit={{ opacity: 0 }} className="mt-1.5 h-3 w-24 animate-pulse rounded bg-line/70" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MoodGauge({ mood }: { mood?: number }) {
  const { t } = useLang();
  const meta = mood ? MOOD_META[mood] : undefined;
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 px-3.5 py-3">
      <div className="flex items-center justify-between text-[11px] font-medium tracking-wide text-dim uppercase">
        <Bi en="Caller mood" ur="کالر کا موڈ" only />
        <span className="text-xs font-semibold normal-case" style={{ color: meta?.color ?? "#94A3B8" }}>
          {meta ? t(meta.en, meta.ur) : "—"}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.span
            key={n}
            className="h-2 flex-1 rounded-full"
            animate={{ backgroundColor: mood && n <= mood ? MOOD_META[mood].color : "#1F2A44" }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

function TicketSuccess({ ticketNo }: { ticketNo: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 grid place-items-center bg-ink/88 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="flex flex-col items-center text-center"
      >
        <span className="relative grid size-20 place-items-center">
          <span className="ripple-once absolute inset-0 rounded-full border-2 border-live" />
          <span className="ripple-once absolute inset-0 rounded-full border-2 border-live" style={{ animationDelay: "0.3s" }} />
          <span className="grid size-20 place-items-center rounded-full bg-live text-ink">
            <CircleCheck className="size-10" strokeWidth={2.2} />
          </span>
        </span>
        <p className="mt-5 text-base font-medium text-dim">
          <Bi en="Complaint registered" ur="شکایت درج ہو گئی" />
        </p>
        <p className="mt-1 text-6xl font-semibold tracking-tight text-fg tnum">{ticketNo}</p>
      </motion.div>
    </motion.div>
  );
}

function ActiveCall({ call, others }: { call: LiveCall; others: number }) {
  const { t } = useLang();
  const skew = useLive((s) => s.skew);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const ended = call.endedAt != null;
  const elapsed = ended ? call.seconds : Math.max(call.seconds, Math.floor((now + skew - call.startedAt) / 1000));
  const showSuccess = Boolean(call.ticket && call.ticketAt && now - call.ticketAt < 4500);
  const f = call.fields;
  const catMeta = f.category ? CATEGORY_META[f.category] : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <AnimatePresence>{showSuccess && call.ticket && <TicketSuccess ticketNo={call.ticket.ticketNo} />}</AnimatePresence>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-4 border-b border-line px-5 py-3">
        <span
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-widest uppercase",
            ended ? "border-line bg-panel-2 text-dim" : "border-danger/50 bg-danger/15 text-danger",
          )}
        >
          <span className={cn("size-2 rounded-full", ended ? "bg-dim" : "blink bg-danger")} />
          {ended ? t("Call ended", "کال ختم") : t("Live call", "براہِ راست کال")}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-semibold text-fg tnum">
            {f.name ? `${f.name} · ` : ""}
            {call.phoneMasked ?? "03xx-xxx-xxxx"}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <PhoneCall className="size-3" />
            {call.simulated ? "Simulated call" : t("Web call via QR", "کیو آر کے ذریعے ویب کال")}
            {call.hasGps && (
              <span className="flex items-center gap-1 text-live">
                · <LocateFixed className="size-3" /> GPS
              </span>
            )}
            {others > 0 && <span className="text-warn">· +{others} more in progress</span>}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-4">
          <Waveform active={!ended} />
          <span className="text-[28px] leading-none font-semibold text-fg tnum" dir="ltr">
            {clock(elapsed)}
          </span>
        </div>
      </div>

      {call.humanNeeded && (
        <div className="flex shrink-0 items-center gap-2 border-b border-danger/40 bg-danger/15 px-5 py-2 text-sm font-medium text-danger">
          <TriangleAlert className="size-4" />
          <Bi en="Human officer requested" ur="انسانی افسر درکار ہے" />
          <span className="truncate font-normal text-fg/80">— {call.humanNeeded}</span>
        </div>
      )}

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_0.8fr]">
        <div className="scroll-thin min-h-0 overflow-y-auto border-e border-line p-4">
          <TranscriptBubbles lines={call.lines} emptyLabel={t("Connecting the caller…", "کالر سے رابطہ ہو رہا ہے…")} />
        </div>
        <div className="scroll-thin flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          <div className="rounded-xl border border-line bg-panel-2/40 px-3.5 py-1.5">
            <p className="flex items-center justify-between py-1.5 text-[11px] font-semibold tracking-wide text-dim uppercase">
              <Bi en="Extracted details" ur="حاصل شدہ تفصیلات" only />
              {call.ticket && (
                <span className="flex items-center gap-1 text-live normal-case">
                  <CircleCheck className="size-3.5" /> {call.ticket.ticketNo}
                </span>
              )}
            </p>
            <div className="divide-y divide-line/70">
              <DetailRow icon={User} en="Name" ur="نام" value={f.name} />
              <DetailRow icon={Phone} en="Phone" ur="فون" value={f.phone} />
              <DetailRow icon={MapPin} en="Area" ur="علاقہ" value={f.area} />
              <DetailRow
                icon={f.category ? CATEGORY_ICONS[f.category] : Tag}
                en="Category"
                ur="قسم"
                value={catMeta ? t(catMeta.en, catMeta.ur) : undefined}
                accent={catMeta?.color}
              />
              <DetailRow icon={FileText} en="Problem" ur="مسئلہ" value={f.description} />
            </div>
          </div>
          <MoodGauge mood={f.mood} />
        </div>
      </div>

      {/* Cost meter */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line bg-panel-2/40 px-5 py-2.5 text-sm" dir="ltr">
        <span className="text-dim">
          This call:{" "}
          <span className="text-base font-semibold text-live tnum">PKR {call.costPkr.toFixed(2)}</span>
        </span>
        <span className="text-dim">
          Foreign platform est.:{" "}
          <span className="text-base font-semibold text-fg/80 tnum">PKR {foreignPlatformPkr(elapsed).toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}

export function LiveCallPanel() {
  const calls = useLive((s) => s.calls);
  const list = Object.values(calls).sort((a, b) => b.startedAt - a.startedAt);
  const live = list.filter((c) => c.endedAt == null);
  const current = live[0] ?? list[0];

  return (
    <section className="relative min-h-0 overflow-hidden rounded-2xl border border-line bg-panel">
      <AnimatePresence mode="wait" initial={false}>
        {current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="h-full"
          >
            <ActiveCall call={current} others={Math.max(0, live.length - 1)} />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="h-full"
          >
            <Idle />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
