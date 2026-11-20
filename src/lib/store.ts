"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { api } from "./api";
import type {
  AreaDTO,
  CallDTO,
  DepartmentDTO,
  IncidentDTO,
  LiveEvent,
  StatsDTO,
  TicketDTO,
  TranscriptLine,
} from "./domain";

export type LiveCall = CallDTO & {
  /** Lines including the one still being spoken. */
  lines: TranscriptLine[];
  humanNeeded?: string;
  /** Set when the agent registered a ticket during this call. */
  ticket?: TicketDTO;
  ticketAt?: number;
};

type Bootstrap = {
  tickets: TicketDTO[];
  incidents: IncidentDTO[];
  areas: AreaDTO[];
  departments: DepartmentDTO[];
  stats: StatsDTO;
  activeCalls: CallDTO[];
  publicBaseUrl: string | null;
  aiReady: boolean;
  serverTime: number;
};

type LiveState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  connected: boolean;
  tickets: TicketDTO[];
  incidents: IncidentDTO[];
  areas: AreaDTO[];
  departments: DepartmentDTO[];
  stats: StatsDTO;
  calls: Record<string, LiveCall>;
  /** ticketNo -> time it arrived live; drives the pin-drop and slide-in animations. */
  fresh: Record<string, number>;
  publicBaseUrl: string | null;
  aiReady: boolean;
  /** serverTime - Date.now() at load, so timers agree across devices. */
  skew: number;
  load: () => Promise<void>;
  apply: (event: LiveEvent) => void;
  upsertTicket: (ticket: TicketDTO) => void;
};

const toLiveCall = (c: CallDTO): LiveCall => ({ ...c, lines: c.transcript });

function upsertLine(lines: TranscriptLine[], line: TranscriptLine): TranscriptLine[] {
  const at = line.id ? lines.findIndex((l) => l.id === line.id) : -1;
  if (at >= 0) {
    const next = lines.slice();
    next[at] = { ...line, ts: lines[at].ts };
    return next;
  }
  return [...lines, line];
}

export const useLive = create<LiveState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  connected: false,
  tickets: [],
  incidents: [],
  areas: [],
  departments: [],
  stats: { callsToday: 0, avgHandlingSeconds: 0, avgCostPkr: 0 },
  calls: {},
  fresh: {},
  publicBaseUrl: null,
  aiReady: false,
  skew: 0,

  async load() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const b = await api<Bootstrap>("/api/bootstrap");
      set({
        loaded: true,
        loading: false,
        error: null,
        tickets: b.tickets,
        incidents: b.incidents,
        areas: b.areas,
        departments: b.departments,
        stats: b.stats,
        calls: Object.fromEntries(b.activeCalls.map((c) => [c.id, toLiveCall(c)])),
        publicBaseUrl: b.publicBaseUrl,
        aiReady: b.aiReady,
        skew: b.serverTime - Date.now(),
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  upsertTicket(ticket) {
    set((s) => {
      const at = s.tickets.findIndex((t) => t.ticketNo === ticket.ticketNo);
      if (at < 0) return { tickets: [ticket, ...s.tickets] };
      const tickets = s.tickets.slice();
      tickets[at] = ticket;
      return { tickets };
    });
  },

  apply(event) {
    switch (event.type) {
      case "ticket.created": {
        const t = event.payload;
        set((s) => {
          const exists = s.tickets.some((x) => x.ticketNo === t.ticketNo);
          const calls = { ...s.calls };
          if (t.callId && calls[t.callId]) {
            calls[t.callId] = { ...calls[t.callId], ticket: t, ticketNo: t.ticketNo, ticketAt: Date.now() };
          }
          return {
            tickets: exists ? s.tickets.map((x) => (x.ticketNo === t.ticketNo ? t : x)) : [t, ...s.tickets],
            fresh: { ...s.fresh, [t.ticketNo]: Date.now() },
            calls,
          };
        });
        break;
      }
      case "ticket.updated":
        get().upsertTicket(event.payload);
        break;
      case "incident.created":
      case "incident.updated": {
        const inc = event.payload;
        set((s) => {
          const at = s.incidents.findIndex((i) => i.id === inc.id);
          if (at < 0) return { incidents: [inc, ...s.incidents] };
          const incidents = s.incidents.slice();
          incidents[at] = inc;
          return { incidents };
        });
        break;
      }
      case "call.started": {
        const c = event.payload;
        set((s) => ({
          calls: { ...s.calls, [c.id]: toLiveCall(c) },
          stats: { ...s.stats, callsToday: s.stats.callsToday + 1 },
        }));
        break;
      }
      case "call.transcript": {
        const { callId, line } = event.payload;
        set((s) => {
          const c = s.calls[callId];
          if (!c) return {};
          return { calls: { ...s.calls, [callId]: { ...c, lines: upsertLine(c.lines, line) } } };
        });
        break;
      }
      case "call.fields": {
        const { callId, fields } = event.payload;
        set((s) => {
          const c = s.calls[callId];
          if (!c) return {};
          return {
            calls: {
              ...s.calls,
              [callId]: { ...c, fields: { ...c.fields, ...fields }, phoneMasked: fields.phone ?? c.phoneMasked },
            },
          };
        });
        break;
      }
      case "call.metrics": {
        const { callId, seconds, costUsd, costPkr } = event.payload;
        set((s) => {
          const c = s.calls[callId];
          if (!c) return {};
          return { calls: { ...s.calls, [callId]: { ...c, seconds, costUsd, costPkr } } };
        });
        break;
      }
      case "call.human_needed": {
        const { callId, reason } = event.payload;
        set((s) => {
          const c = s.calls[callId];
          if (!c) return {};
          return { calls: { ...s.calls, [callId]: { ...c, humanNeeded: reason } } };
        });
        break;
      }
      case "call.ended": {
        const { call, stats } = event.payload;
        set((s) => {
          const existing = s.calls[call.id];
          if (!existing) return { stats };
          return {
            stats,
            calls: {
              ...s.calls,
              [call.id]: { ...existing, ...call, lines: existing.lines, ticket: existing.ticket, ticketAt: existing.ticketAt },
            },
          };
        });
        // Leave the finished call on screen for a moment, then clear the panel.
        setTimeout(() => {
          set((s) => {
            if (!s.calls[call.id]) return {};
            const calls = { ...s.calls };
            delete calls[call.id];
            return { calls };
          });
        }, 7000);
        break;
      }
      case "demo.reset":
        set({ fresh: {}, calls: {} });
        void get().load();
        break;
      case "settings.updated":
        set({ publicBaseUrl: event.payload.publicBaseUrl });
        break;
      case "citizen.notify":
        break;
    }
  },
}));

// ---------- one shared SSE connection per tab ----------

type Listener = (event: LiveEvent) => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;
let everConnected = false;

function connect() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/stream");
  source.onopen = () => {
    useLive.setState({ connected: true });
    // After a dropped connection, reload to pick up anything that was missed.
    if (everConnected) void useLive.getState().load();
    everConnected = true;
  };
  source.onerror = () => {
    useLive.setState({ connected: false });
  };
  source.onmessage = (msg) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(msg.data) as LiveEvent;
    } catch {
      return;
    }
    useLive.getState().apply(event);
    listeners.forEach((l) => l(event));
  };
}

/** Subscribe to raw live events (toasts, the citizen page, the officer app). */
export function onLiveEvent(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
  };
}

/** Loads the shared dataset once and keeps it live. Call from any screen that shows data. */
export function useLiveData() {
  const loaded = useLive((s) => s.loaded);
  const error = useLive((s) => s.error);
  useEffect(() => {
    const s = useLive.getState();
    if (!s.loaded && !s.loading) void s.load();
    connect();
  }, []);
  return { loaded, error, retry: () => useLive.getState().load() };
}

/** Events only, without loading the dataset (citizen call page). */
export function useLiveEvents(listener: Listener) {
  useEffect(() => onLiveEvent(listener), [listener]);
}
