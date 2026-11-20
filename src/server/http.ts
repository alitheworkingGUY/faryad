// Small helpers shared by the route handlers.

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return (body && typeof body === "object" ? body : {}) as T;
  } catch {
    return {} as T;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Turns a thrown error into a JSON error response with a sensible status. */
export function fail(err: unknown): Response {
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? ((err as { status: number }).status as number)
      : 500;
  const message = err instanceof Error ? err.message : "Something went wrong";
  if (status >= 500) console.error("[faryad] api error:", err);
  return json({ error: message }, status);
}
