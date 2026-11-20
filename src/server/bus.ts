import { randomUUID } from "node:crypto";
import type { LiveEvent } from "@/lib/domain";

// In-process pub/sub behind the live endpoints. Kept on globalThis so every
// route handler (and dev hot-reload) shares the same set of open screens.
//
// Two transports read from it:
//   - GET /api/stream  Server-Sent Events (the Command Center on localhost)
//   - GET /api/events  long-polling, for connections that buffer SSE. Cloudflare
//     quick tunnels do, so phones on the tunnel use this one.
type Client = { id: number; send: (chunk: string) => void };
type Logged = { seq: number; event: LiveEvent & { ts: number } };
type Bus = {
  clients: Map<number, Client>;
  nextId: number;
  /** Changes when the server restarts, so a poller knows its position is stale. */
  epoch: string;
  seq: number;
  log: Logged[];
  waiters: Set<() => void>;
};

const LOG_SIZE = 500;

const g = globalThis as unknown as { __faryadBus?: Bus };
const bus: Bus = (g.__faryadBus ??= {
  clients: new Map(),
  nextId: 1,
  epoch: randomUUID().slice(0, 8),
  seq: 0,
  log: [],
  waiters: new Set(),
});
// A bus created by an older build (dev hot-reload) may lack the newer fields.
bus.epoch ??= randomUUID().slice(0, 8);
bus.seq ??= 0;
bus.log ??= [];
bus.waiters ??= new Set();

export function subscribe(send: (chunk: string) => void): () => void {
  const id = bus.nextId++;
  bus.clients.set(id, { id, send });
  return () => {
    bus.clients.delete(id);
  };
}

export function broadcast(event: LiveEvent): void {
  const stamped = { ...event, ts: Date.now() };
  bus.seq++;
  bus.log.push({ seq: bus.seq, event: stamped });
  if (bus.log.length > LOG_SIZE) bus.log.splice(0, bus.log.length - LOG_SIZE);

  const chunk = `data: ${JSON.stringify(stamped)}\n\n`;
  for (const client of bus.clients.values()) {
    try {
      client.send(chunk);
    } catch {
      bus.clients.delete(client.id);
    }
  }
  for (const wake of [...bus.waiters]) wake();
}

export type PollResult = {
  epoch: string;
  seq: number;
  events: (LiveEvent & { ts: number })[];
  /** True when the caller's position cannot be continued from (server restarted, or too far behind). */
  reset: boolean;
};

function collect(since: number): PollResult {
  const oldest = bus.log[0]?.seq ?? bus.seq + 1;
  const missed = since < oldest - 1; // events between `since` and the oldest logged one are gone
  return {
    epoch: bus.epoch,
    seq: bus.seq,
    events: missed ? [] : bus.log.filter((l) => l.seq > since).map((l) => l.event),
    reset: missed,
  };
}

/**
 * Long-poll: answers at once if there are events after `since`, otherwise waits
 * for the next broadcast (or the timeout) and then answers.
 */
export async function pollEvents(
  since: number | null,
  epoch: string | null,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<PollResult> {
  if (since == null || !Number.isFinite(since)) return { epoch: bus.epoch, seq: bus.seq, events: [], reset: false };
  if (epoch !== bus.epoch || since > bus.seq) return { epoch: bus.epoch, seq: bus.seq, events: [], reset: true };
  if (bus.seq > since) return collect(since);

  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      bus.waiters.delete(finish);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    bus.waiters.add(finish);
    signal?.addEventListener("abort", finish);
  });
  return collect(since);
}

export function clientCount(): number {
  return bus.clients.size + bus.waiters.size;
}
