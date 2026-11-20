import type { LiveEvent } from "@/lib/domain";

// In-process pub/sub behind the SSE endpoint. Kept on globalThis so every
// route handler (and dev hot-reload) shares the same set of open screens.
type Client = { id: number; send: (chunk: string) => void };
type Bus = { clients: Map<number, Client>; nextId: number };

const g = globalThis as unknown as { __faryadBus?: Bus };
const bus: Bus = (g.__faryadBus ??= { clients: new Map(), nextId: 1 });

export function subscribe(send: (chunk: string) => void): () => void {
  const id = bus.nextId++;
  bus.clients.set(id, { id, send });
  return () => {
    bus.clients.delete(id);
  };
}

export function broadcast(event: LiveEvent): void {
  const chunk = `data: ${JSON.stringify({ ...event, ts: Date.now() })}\n\n`;
  for (const client of bus.clients.values()) {
    try {
      client.send(chunk);
    } catch {
      bus.clients.delete(client.id);
    }
  }
}

export function clientCount(): number {
  return bus.clients.size;
}
