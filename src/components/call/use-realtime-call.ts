"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usageCostUsd, type RealtimeUsage } from "@/config/pricing";
import { api, ApiError } from "@/lib/api";
import type { TranscriptLine } from "@/lib/domain";

export type CallPhase = "idle" | "connecting" | "live" | "ended" | "error";

export type CallProblem = {
  code: "mic_denied" | "mic_missing" | "insecure" | "not_configured" | "network" | "unknown";
  message: string;
};

export type RegisteredTicket = {
  ticketNo: string;
  spokenUr: string;
  department: string;
  departmentName: string;
  slaHours: number;
  area: string;
  category: string;
};

export type Gps = { lat: number; lng: number; nearestArea?: string | null; inServiceArea?: boolean };

type SessionResponse = {
  clientSecret: string;
  model: string;
  voice: string;
  greeting: string;
  sessionUpdate: Record<string, unknown> | null;
};

type ServerEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  response?: {
    usage?: RealtimeUsage;
    output?: { type?: string; call_id?: string; name?: string; arguments?: string }[];
  };
  error?: { message?: string; code?: string };
};

const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/**
 * One voice call to the Faryad agent: microphone -> OpenAI Realtime over WebRTC.
 * Captions, tool calls and cost are mirrored to our server so the Command Center
 * sees the call as it happens.
 */
export function useRealtimeCall(gps: Gps | null) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [problem, setProblem] = useState<CallProblem | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [speaking, setSpeaking] = useState<"agent" | "caller" | null>(null);
  const [ticket, setTicket] = useState<RegisteredTicket | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [humanAlerted, setHumanAlerted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const costRef = useRef(0);
  const linesRef = useRef<Map<string, TranscriptLine>>(new Map());
  const dirtyRef = useRef<Set<string>>(new Set());
  const handledToolsRef = useRef<Set<string>>(new Set());
  const gpsRef = useRef<Gps | null>(gps);
  const endedRef = useRef(false);
  const timersRef = useRef<{ tick?: ReturnType<typeof setInterval>; flush?: ReturnType<typeof setInterval> }>({});
  /** 0..1 loudness of whoever is talking; the orb reads it every frame without re-rendering. */
  const levelRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    gpsRef.current = gps;
    // Location shared in the middle of a call still counts for this call.
    const id = callIdRef.current;
    if (gps && id && !endedRef.current) {
      void api(`/api/calls/${id}/events`, { body: { type: "gps", lat: gps.lat, lng: gps.lng } }).catch(() => {});
    }
  }, [gps]);

  // ---------- captions ----------

  const publish = useCallback(() => {
    setLines([...linesRef.current.values()].filter((l) => l.text.trim()).sort((a, b) => a.ts - b.ts));
  }, []);

  const upsertLine = useCallback(
    (id: string, role: "caller" | "agent", update: { append?: string; text?: string; final?: boolean }) => {
      const existing = linesRef.current.get(id);
      const base: TranscriptLine = existing ?? { id, role, text: "", ts: Date.now(), final: false };
      const text = update.text !== undefined ? update.text : base.text + (update.append ?? "");
      linesRef.current.set(id, { ...base, text, final: update.final ?? base.final });
      if (text.trim()) dirtyRef.current.add(id);
      publish();
    },
    [publish],
  );

  /** Sends changed caption lines to the server a few times a second. */
  const flush = useCallback(() => {
    const id = callIdRef.current;
    if (!id || dirtyRef.current.size === 0) return;
    const events = [...dirtyRef.current]
      .map((lineId) => linesRef.current.get(lineId))
      .filter((l): l is TranscriptLine => Boolean(l && l.text.trim()))
      .map((l) => ({ type: "transcript" as const, id: l.id, role: l.role, text: l.text, final: l.final !== false, ts: l.ts }));
    dirtyRef.current.clear();
    if (events.length) void api(`/api/calls/${id}/events`, { body: { events } }).catch(() => {});
  }, []);

  const postMetrics = useCallback(() => {
    const id = callIdRef.current;
    if (!id) return;
    const secs = Math.round((Date.now() - startedAtRef.current) / 1000);
    void api(`/api/calls/${id}/events`, {
      body: { type: "metrics", seconds: secs, costUsd: costRef.current },
    }).catch(() => {});
  }, []);

  // ---------- tools ----------

  const send = useCallback((payload: unknown) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(payload));
  }, []);

  const runTool = useCallback(
    async (callId: string, name: string, rawArgs: string) => {
      if (handledToolsRef.current.has(callId)) return;
      handledToolsRef.current.add(callId);
      let args: Record<string, unknown> = {};
      try {
        args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
      } catch {
        // malformed arguments: the tool reports the failure back to the model
      }
      let output: unknown;
      try {
        if (name === "create_ticket") {
          const res = await api<{
            ticket_no: string;
            ticket_no_spoken_ur: string;
            department: string;
            department_name: string;
            sla_hours: number;
            area: string;
            location_source: string;
            ticket: { category: string };
          }>("/api/tickets", { body: { ...args, call_id: callIdRef.current } });
          setTicket({
            ticketNo: res.ticket_no,
            spokenUr: res.ticket_no_spoken_ur,
            department: res.department,
            departmentName: res.department_name,
            slaHours: res.sla_hours,
            area: res.area,
            category: res.ticket.category,
          });
          output = {
            ticket_no: res.ticket_no,
            ticket_no_spoken_ur: res.ticket_no_spoken_ur,
            department: res.department,
            sla_hours: res.sla_hours,
            area: res.area,
            exact_location_used: res.location_source === "gps",
          };
        } else if (name === "get_ticket_status") {
          const q = new URLSearchParams();
          if (typeof args.ticket_no === "string" && args.ticket_no) q.set("ticketNo", args.ticket_no);
          if (typeof args.phone === "string" && args.phone) q.set("phone", args.phone);
          output = q.toString()
            ? await api(`/api/tickets/status?${q.toString()}`)
            : { found: false, message_en: "Ask the caller for the complaint number or phone number." };
        } else if (name === "set_location_from_gps") {
          const g = gpsRef.current;
          output = g
            ? g.inServiceArea === false
              ? { shared: true, usable: false, note: "The phone is outside Peshawar. Ask the caller which area the problem is in." }
              : { shared: true, usable: true, nearest_area: g.nearestArea ?? null, note: "Exact location will be attached to the ticket. Confirm the area with the caller." }
            : { shared: false, note: "Location was not shared. Ask the caller which area or mohalla the problem is in." };
        } else if (name === "transfer_to_human") {
          await api(`/api/calls/${callIdRef.current}/events`, {
            body: { type: "human_needed", reason: typeof args.reason === "string" ? args.reason : undefined },
          });
          setHumanAlerted(true);
          output = { alerted: true, note: "A human officer in the command centre has been alerted and will call back." };
        } else {
          output = { error: `Unknown tool ${name}` };
        }
      } catch (err) {
        output = {
          error: err instanceof Error ? err.message : "The request failed",
          note: "Apologise briefly and ask the caller to repeat the missing detail, then try again.",
        };
      }
      send({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
      });
      send({ type: "response.create" });
    },
    [send],
  );

  // ---------- realtime events ----------

  const onServerEvent = useCallback(
    (e: ServerEvent) => {
      switch (e.type) {
        case "input_audio_buffer.speech_started":
          setSpeaking("caller");
          // Reserve the caller's place in the conversation before the agent replies.
          if (e.item_id && !linesRef.current.has(e.item_id)) {
            linesRef.current.set(e.item_id, { id: e.item_id, role: "caller", text: "", ts: Date.now(), final: false });
          }
          break;
        case "input_audio_buffer.speech_stopped":
          setSpeaking((s) => (s === "caller" ? null : s));
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (e.item_id && e.delta) upsertLine(e.item_id, "caller", { append: e.delta });
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (e.item_id) upsertLine(e.item_id, "caller", { text: (e.transcript ?? "").trim(), final: true });
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          if (e.item_id && e.delta) upsertLine(e.item_id, "agent", { append: e.delta });
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          if (e.item_id) {
            const current = linesRef.current.get(e.item_id)?.text ?? "";
            upsertLine(e.item_id, "agent", { text: (e.transcript ?? current).trim(), final: true });
          }
          break;
        case "output_audio_buffer.started":
          setSpeaking("agent");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setSpeaking((s) => (s === "agent" ? null : s));
          break;
        case "response.function_call_arguments.done":
          if (e.call_id && e.name) void runTool(e.call_id, e.name, e.arguments ?? "{}");
          break;
        case "response.done": {
          costRef.current += usageCostUsd(e.response?.usage);
          postMetrics();
          // Safety net: pick up any function call that did not arrive as its own event.
          for (const item of e.response?.output ?? []) {
            if (item.type === "function_call" && item.call_id && item.name) {
              void runTool(item.call_id, item.name, item.arguments ?? "{}");
            }
          }
          break;
        }
        case "error":
          console.warn("[faryad] realtime error:", e.error?.message ?? e.error?.code ?? "unknown");
          break;
      }
    },
    [postMetrics, runTool, upsertLine],
  );

  // ---------- lifecycle ----------

  const teardown = useCallback(() => {
    clearInterval(timersRef.current.tick);
    clearInterval(timersRef.current.flush);
    cancelAnimationFrame(rafRef.current);
    levelRef.current = 0;
    try {
      dcRef.current?.close();
    } catch {
      // already closed
    }
    try {
      pcRef.current?.close();
    } catch {
      // already closed
    }
    micRef.current?.getTracks().forEach((t) => t.stop());
    void audioCtxRef.current?.close().catch(() => {});
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    pcRef.current = null;
    dcRef.current = null;
    micRef.current = null;
    audioCtxRef.current = null;
  }, []);

  const end = useCallback(
    (reason: "user" | "dropped" = "user") => {
      if (endedRef.current) return;
      endedRef.current = true;
      // Any line still marked as "speaking" is closed off as final.
      for (const [id, l] of linesRef.current) {
        if (l.final === false && l.text.trim()) {
          linesRef.current.set(id, { ...l, final: true });
          dirtyRef.current.add(id);
        }
      }
      flush();
      const id = callIdRef.current;
      const secs = Math.round((Date.now() - startedAtRef.current) / 1000);
      teardown();
      setSpeaking(null);
      setSeconds(secs);
      setPhase("ended");
      if (reason === "dropped") {
        setProblem({ code: "network", message: "The call was disconnected." });
      }
      if (id) {
        void api(`/api/calls/${id}`, { method: "PATCH", body: { seconds: secs, costUsd: costRef.current } }).catch(
          () => {},
        );
      }
    },
    [flush, teardown],
  );

  const fail = useCallback(
    (p: CallProblem) => {
      const id = callIdRef.current;
      endedRef.current = true;
      teardown();
      setProblem(p);
      setPhase("error");
      if (id) void api(`/api/calls/${id}`, { method: "PATCH", body: { seconds: 0 } }).catch(() => {});
    },
    [teardown],
  );

  /** Feeds microphone and agent loudness into `levelRef` for the orb. */
  const watchLevels = useCallback((mic: MediaStream, remote: MediaStream | null) => {
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioCtxRef.current ?? new Ctor();
      audioCtxRef.current = ctx;
      const analysers: AnalyserNode[] = [];
      for (const stream of [mic, remote]) {
        if (!stream || stream.getAudioTracks().length === 0) continue;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analysers.push(analyser);
      }
      const data = new Uint8Array(128);
      cancelAnimationFrame(rafRef.current);
      const loop = () => {
        let peak = 0;
        for (const a of analysers) {
          a.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          peak = Math.max(peak, Math.sqrt(sum / data.length));
        }
        levelRef.current = levelRef.current * 0.7 + Math.min(1, peak * 3.2) * 0.3;
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // The orb falls back to its idle animation.
    }
  }, []);

  const start = useCallback(async () => {
    if (pcRef.current) return;
    setProblem(null);
    setLines([]);
    setTicket(null);
    setSeconds(0);
    setHumanAlerted(false);
    setMuted(false);
    linesRef.current = new Map();
    dirtyRef.current = new Set();
    handledToolsRef.current = new Set();
    costRef.current = 0;
    endedRef.current = false;
    callIdRef.current = null;
    setPhase("connecting");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail({
        code: "insecure",
        message: "The microphone only works on a secure (https) address. Open the link from the QR code.",
      });
      return;
    }

    // 1. Microphone first, while we still hold the user's tap.
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      fail(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? { code: "mic_missing", message: "No microphone was found on this device." }
          : { code: "mic_denied", message: "Microphone permission was not given." },
      );
      return;
    }
    micRef.current = mic;

    try {
      // 2. Our call record + a short-lived OpenAI secret, in parallel.
      const [callRes, session] = await Promise.all([
        api<{ call: { id: string } }>("/api/calls", { method: "POST", body: {} }),
        api<SessionResponse>("/api/realtime/session", { method: "POST", body: {} }),
      ]);
      callIdRef.current = callRes.call.id;
      startedAtRef.current = Date.now();
      const g = gpsRef.current;
      if (g) {
        void api(`/api/calls/${callRes.call.id}/events`, { body: { type: "gps", lat: g.lat, lng: g.lng } }).catch(
          () => {},
        );
      }

      // 3. WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (ev) => {
        const stream = ev.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          void audioRef.current.play().catch(() => {});
        }
        watchLevels(mic, stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") end("dropped");
      };
      mic.getTracks().forEach((track) => pc.addTrack(track, mic));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        if (session.sessionUpdate) send({ type: "session.update", session: session.sessionUpdate });
        // The agent speaks first: the greeting.
        send({ type: "response.create" });
      };
      dc.onmessage = (msg) => {
        try {
          onServerEvent(JSON.parse(msg.data) as ServerEvent);
        } catch {
          // ignore anything that is not JSON
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch(OPENAI_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${session.clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new ApiError(`The voice service refused the call (${sdpRes.status}).`, sdpRes.status);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      watchLevels(mic, null);
      timersRef.current.tick = setInterval(
        () => setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000)),
        1000,
      );
      timersRef.current.flush = setInterval(flush, 300);
      setPhase("live");
    } catch (err) {
      const e = err as ApiError;
      fail(
        e?.code === "no_key" || e?.status === 503
          ? { code: "not_configured", message: e.message }
          : e?.status === 0
            ? { code: "network", message: e.message }
            : { code: "unknown", message: e?.message || "The call could not be connected." },
      );
    }
  }, [end, fail, flush, onServerEvent, send, watchLevels]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    teardown();
    endedRef.current = false;
    callIdRef.current = null;
    setPhase("idle");
    setProblem(null);
    setLines([]);
    setTicket(null);
    setSeconds(0);
  }, [teardown]);

  // If the tab is closed mid-call, still close the call on the server.
  useEffect(() => {
    const onHide = () => {
      const id = callIdRef.current;
      if (!id || endedRef.current) return;
      const secs = Math.round((Date.now() - startedAtRef.current) / 1000);
      navigator.sendBeacon?.(
        `/api/calls/${id}`,
        new Blob([JSON.stringify({ seconds: secs, costUsd: costRef.current })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
      teardown();
    };
  }, [teardown]);

  return {
    phase,
    problem,
    lines,
    speaking,
    ticket,
    seconds,
    muted,
    humanAlerted,
    levelRef,
    audioRef,
    start,
    end,
    reset,
    toggleMute,
  };
}
