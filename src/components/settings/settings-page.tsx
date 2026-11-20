"use client";

import {
  CircleCheck,
  Copy,
  Keyboard,
  Link2,
  PhoneCall,
  RotateCcw,
  Save,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/shared/app-shell";
import { Panel, SelectBox } from "@/components/shared/controls";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Ur } from "@/lib/i18n";

type Settings = {
  agentName: string;
  greeting: string;
  voice: string;
  systemPrompt: string;
  publicBaseUrl: string;
};

type Payload = {
  settings: Settings;
  defaults: { greeting: string; systemPrompt: string };
  voices: string[];
  resolvedPrompt: string;
  publicBaseUrl: string | null;
  envPublicBaseUrl: string | null;
  aiReady: boolean;
  models: { realtime: string; transcribe: string; tts: string; ttsVoice: string; text: string };
};

const SCENARIOS = [
  { key: "gulbahar-water", label: "No water · Gulbahar", hint: "Third report: raises an incident" },
  { key: "hayatabad-streetlight", label: "Streetlights · Hayatabad Phase 3", hint: "Routes to TMA" },
  { key: "saddar-garbage", label: "Garbage · Saddar", hint: "Routes to WSSP" },
];

function QrCard({ title, titleUr, url }: { title: string; titleUr: string; url: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-ink/50 p-4 text-center">
      <div className="rounded-xl bg-white p-2.5">
        {url ? (
          <QRCodeSVG value={url} size={148} level="M" marginSize={0} bgColor="#ffffff" fgColor="#0B1220" />
        ) : (
          <div className="size-[148px] rounded bg-slate-200" />
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-fg">{title}</p>
      <Ur as="p" className="ur-tight text-sm text-live">
        {titleUr}
      </Ur>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(
            () => toast.success("Link copied"),
            () => toast.error("Could not copy"),
          );
        }}
        className="mt-2 flex max-w-full items-center gap-1.5 text-[11px] text-dim hover:text-fg"
      >
        <Copy className="size-3 shrink-0" />
        <span className="truncate" dir="ltr">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </button>
    </div>
  );
}

function Body() {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api<Payload>("/api/settings");
      setData(res);
      setForm(res.settings);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  if (error && !data) return <ErrorState message={error} onRetry={load} className="h-dvh" />;
  if (!data || !form) return <LoadingState label="Loading settings" className="h-dvh" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings);
  const base = (form.publicBaseUrl || origin).replace(/\/+$/, "");
  const usingLocalhost = !form.publicBaseUrl && /localhost|127\.0\.0\.1/.test(origin);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await api<Payload>("/api/settings", { method: "PUT", body: form });
      setData(res);
      setForm(res.settings);
      toast.success("Settings saved. They apply from the next call.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function resetDemo() {
    setResetting(true);
    try {
      const res = await api<{ tickets: number; calls: number }>("/api/demo/reset", { method: "POST", body: {} });
      toast.success(`Demo data reset: ${res.tickets} tickets, ${res.calls} calls`);
      setResetOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResetting(false);
    }
  }

  async function simulate(scenario: string) {
    try {
      await api("/api/demo/simulate", { body: { scenario } });
      toast.success("Simulated call started. Watch the Command Center.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader en="Settings" ur="ترتیبات" hint="Voice agent, public link and demo tools.">
        <Button variant="outline" size="lg" disabled={!dirty || saving} onClick={() => setForm(data.settings)}>
          <Undo2 /> Discard
        </Button>
        <Button size="lg" disabled={!dirty || saving} onClick={save}>
          <Save /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </PageHeader>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5">
          {/* Agent */}
          <Panel title="Voice agent" titleUr="صوتی ایجنٹ" className="row-span-2">
            <div
              className={
                data.aiReady
                  ? "mb-5 flex items-center gap-2.5 rounded-xl border border-live/40 bg-live/10 px-3.5 py-2.5 text-sm text-live"
                  : "mb-5 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-sm text-warn"
              }
            >
              {data.aiReady ? <CircleCheck className="size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
              <span>
                {data.aiReady ? (
                  <>
                    OpenAI key found. Realtime <b>{data.models.realtime}</b>, transcription <b>{data.models.transcribe}</b>,
                    voice note <b>{data.models.tts}</b>.
                  </>
                ) : (
                  <>
                    OPENAI_API_KEY is not set, so calls, voice notes and AI summaries are off. Add it to{" "}
                    <code className="rounded bg-ink/60 px-1">.env.local</code> and restart the server.
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="agentName" className="mb-1.5 text-dim">
                  Agent name
                </Label>
                <Input
                  id="agentName"
                  value={form.agentName}
                  onChange={(e) => set("agentName", e.target.value)}
                  className="h-10 border-line bg-ink"
                />
              </div>
              <div>
                <Label className="mb-1.5 text-dim">Voice</Label>
                <SelectBox
                  label="Voice"
                  value={form.voice}
                  onChange={(v) => set("voice", v)}
                  options={data.voices.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="greeting" className="text-dim">
                  Greeting
                </Label>
                <button
                  type="button"
                  onClick={() => set("greeting", data.defaults.greeting)}
                  className="text-xs text-dim hover:text-fg"
                >
                  Use default
                </button>
              </div>
              <Textarea
                id="greeting"
                dir="rtl"
                lang="ur"
                value={form.greeting}
                onChange={(e) => set("greeting", e.target.value)}
                className="ur min-h-16 border-line bg-ink text-lg"
              />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="prompt" className="text-dim">
                  System prompt
                </Label>
                <button
                  type="button"
                  onClick={() => set("systemPrompt", data.defaults.systemPrompt)}
                  className="flex items-center gap-1 text-xs text-dim hover:text-fg"
                >
                  <RotateCcw className="size-3" /> Reset to default
                </button>
              </div>
              <Textarea
                id="prompt"
                value={form.systemPrompt}
                onChange={(e) => set("systemPrompt", e.target.value)}
                spellCheck={false}
                className="scroll-thin min-h-[300px] border-line bg-ink font-mono text-[13px] leading-relaxed"
              />
              <p className="mt-2 text-xs text-dim">
                <code className="rounded bg-ink px-1">{"{agent_name}"}</code>,{" "}
                <code className="rounded bg-ink px-1">{"{greeting}"}</code> and{" "}
                <code className="rounded bg-ink px-1">{"{list}"}</code> (the known areas) are filled in when a call
                starts. Tool-handling rules are added automatically.
              </p>
            </div>
          </Panel>

          {/* Public link */}
          <Panel title="Public link & QR" titleUr="عوامی لنک">
            <Label htmlFor="baseUrl" className="mb-1.5 text-dim">
              Public URL (the https address from cloudflared)
            </Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
              <Input
                id="baseUrl"
                dir="ltr"
                value={form.publicBaseUrl}
                onChange={(e) => set("publicBaseUrl", e.target.value.trim())}
                placeholder="https://something.trycloudflare.com"
                className="h-10 border-line bg-ink ps-9"
              />
            </div>
            <p className="mt-2 text-xs text-dim">
              Used in every QR code. <code className="rounded bg-ink px-1">npm run tunnel</code> fills this in for you.
              {data.envPublicBaseUrl ? ` Environment default: ${data.envPublicBaseUrl}` : ""}
            </p>
            {usingLocalhost && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warn">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                No public URL yet: these codes point at localhost, which phones cannot open.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <QrCard title="Citizen call page" titleUr="شکایت درج کریں" url={base ? `${base}/call` : ""} />
              <QrCard title="Officer app" titleUr="افسر ایپ" url={base ? `${base}/officer` : ""} />
            </div>
          </Panel>

          {/* Demo tools */}
          <Panel title="Demo tools" titleUr="ڈیمو">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-ink/50 p-4">
              <div>
                <p className="text-sm font-semibold text-fg">Reset demo data</p>
                <p className="mt-0.5 text-xs text-dim">
                  Reloads the 31 seeded tickets with fresh timestamps and clears live calls, incidents and voice notes.
                  Do this shortly before going on stage: the two Gulbahar water reports must be under two hours old for
                  the third call to raise an incident.
                </p>
              </div>
              <Button variant="destructive" size="lg" onClick={() => setResetOpen(true)}>
                <RotateCcw /> Reset
              </Button>
            </div>

            <p className="mt-5 mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-dim uppercase">
              <PhoneCall className="size-3.5" /> Simulated calls (stage fallback)
            </p>
            <div className="flex flex-col gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => simulate(s.key)}
                  className="flex items-center justify-between rounded-xl border border-line bg-ink/50 px-4 py-2.5 text-start transition-colors hover:border-[#2a3757] hover:bg-panel-2"
                >
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                  <span className="text-xs text-dim">{s.hint}</span>
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-dim uppercase">
              <Keyboard className="size-3.5" /> Command Center shortcuts
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-dim">
              {[
                ["F", "Fullscreen"],
                ["M", "Heatmap layer"],
                ["R", "Show / hide resolved"],
                ["S", "Start a simulated call"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <kbd className="grid size-7 place-items-center rounded-md border border-line bg-ink text-xs font-semibold text-fg">
                    {key}
                  </kbd>
                  {label}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="border-line bg-panel">
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>
              All tickets, calls and incidents are replaced by the seeded demo set. Tickets created during testing are
              removed. Agent settings are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" />}>Keep current data</DialogClose>
            <Button variant="destructive" size="lg" disabled={resetting} onClick={resetDemo}>
              <RotateCcw /> {resetting ? "Resetting…" : "Reset demo data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SettingsPage() {
  return (
    <AppShell>
      <Body />
    </AppShell>
  );
}
