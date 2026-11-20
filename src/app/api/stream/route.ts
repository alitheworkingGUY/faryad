import { subscribe } from "@/server/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events: every open screen holds one of these connections. */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };
      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => {
        try {
          send(": ping\n\n");
        } catch {
          cleanup();
        }
      }, 15_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      req.signal.addEventListener("abort", cleanup);
      send("retry: 1500\n\n");
      send(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
