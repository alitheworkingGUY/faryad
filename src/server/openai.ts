import fs from "node:fs";
import path from "node:path";

const API = "https://api.openai.com/v1";

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10);
}

export const openaiConfig = () => ({
  realtimeModel: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
  realtimeVoice: process.env.OPENAI_REALTIME_VOICE?.trim() || "marin",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe",
  transcribeLanguage: (process.env.OPENAI_TRANSCRIBE_LANGUAGE ?? "ur").trim(),
  ttsModel: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
  ttsVoice: process.env.OPENAI_TTS_VOICE?.trim() || "coral",
  // Incident summaries and live field extraction. OPENAI_TEXT_MODEL is the older name.
  textModel:
    process.env.OPENAI_SUMMARY_MODEL?.trim() || process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini",
});

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Attempts = {
  /** Most tries in total. */
  attempts: number;
  /** A try is abandoned if no response has started within this time. */
  attemptTimeoutMs: number;
  /** While a try is still pending after this long, a second one starts alongside it. */
  hedgeAfterMs: number;
};

/**
 * POST with protection against a stalled connection. On a flaky network a new
 * connection to OpenAI sometimes hangs for 10 s before failing; here a slow try gets
 * company (a parallel second try) and a dead one is cut off, and the first response wins.
 */
function resilientPost(url: string, init: { headers: Record<string, string>; body: string }, opts: Attempts) {
  return new Promise<Response>((resolve, reject) => {
    const controllers: AbortController[] = [];
    let launched = 0;
    let failed = 0;
    let settled = false;
    let lastError: unknown = new Error("no attempt was made");

    const launch = () => {
      if (settled || launched >= opts.attempts) return;
      launched++;
      const controller = new AbortController();
      controllers.push(controller);
      const giveUp = setTimeout(() => controller.abort(new Error(`no response within ${opts.attemptTimeoutMs} ms`)), opts.attemptTimeoutMs);
      const hedge = setTimeout(launch, opts.hedgeAfterMs);
      fetch(url, { method: "POST", ...init, signal: controller.signal })
        .then((res) => {
          if (settled) {
            void res.body?.cancel().catch(() => {});
            return;
          }
          settled = true;
          for (const c of controllers) if (c !== controller) c.abort();
          resolve(res);
        })
        .catch((err) => {
          lastError = controller.signal.aborted && controller.signal.reason ? controller.signal.reason : err;
          failed++;
          if (settled) return;
          if (launched < opts.attempts) launch();
          else if (failed >= launched) reject(lastError);
        })
        .finally(() => {
          clearTimeout(giveUp);
          clearTimeout(hedge);
        });
    };
    launch();
  });
}

async function call(
  pathname: string,
  body: unknown,
  opts: Attempts = { attempts: 2, attemptTimeoutMs: 9000, hedgeAfterMs: 4000 },
): Promise<Response> {
  if (!hasOpenAIKey()) throw new OpenAIError("OPENAI_API_KEY is not set", 503);
  const started = Date.now();
  let res: Response;
  try {
    res = await resilientPost(
      `${API}${pathname}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      opts,
    );
  } catch (err) {
    const reason = (err as Error)?.message || "network error";
    console.warn(`[faryad] openai ${pathname} failed after ${Date.now() - started} ms: ${reason}`);
    throw new OpenAIError(`Could not reach OpenAI (${reason})`, 504);
  }
  // One line per call in the server log: handy when something feels slow on stage.
  console.log(`[faryad] openai ${pathname} -> ${res.status} in ${Date.now() - started} ms`);
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {
      // body was not JSON
    }
    throw new OpenAIError(detail || `OpenAI request failed (${res.status})`, res.status);
  }
  return res;
}

/** Mints a short-lived client secret the browser uses to open the WebRTC call. */
export async function mintRealtimeSecret(session: Record<string, unknown>): Promise<{
  value: string;
  expiresAt: number | null;
}> {
  // This sits on the path of every call starting, so it is the most impatient: normally
  // answered in well under a second, a second try joins after 1.5 s.
  const res = await call("/realtime/client_secrets", { session }, { attempts: 3, attemptTimeoutMs: 6000, hedgeAfterMs: 1500 });
  const data = (await res.json()) as {
    value?: string;
    expires_at?: number;
    client_secret?: { value?: string; expires_at?: number };
  };
  const value = data.value ?? data.client_secret?.value;
  if (!value) throw new OpenAIError("OpenAI did not return a client secret", 502);
  return { value, expiresAt: data.expires_at ?? data.client_secret?.expires_at ?? null };
}

/** Text -> MP3 file under public/audio. Returns the file name. */
export async function synthesizeSpeech(input: string, fileName: string): Promise<string> {
  const cfg = openaiConfig();
  const res = await call(
    "/audio/speech",
    {
      model: cfg.ttsModel,
      voice: cfg.ttsVoice,
      input,
      response_format: "mp3",
      instructions:
        "Speak in natural, warm, polite Pakistani Urdu, like a courteous government helpline officer. Calm, clear pace. Read the complaint number slowly, one digit at a time.",
    },
    { attempts: 3, attemptTimeoutMs: 12_000, hedgeAfterMs: 5000 },
  );
  const dir = path.join(process.cwd(), "public", "audio");
  fs.mkdirSync(dir, { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return fileName;
}

/** Small JSON-mode helper for extraction and summaries. Returns null on any failure. */
export async function chatJson<T>(system: string, user: string, timeoutMs = 8000): Promise<T | null> {
  if (!hasOpenAIKey()) return null;
  try {
    const res = await call(
      "/chat/completions",
      {
        model: openaiConfig().textModel,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      // A normal answer takes 3-5 s, so the parallel second try only starts after that.
      { attempts: 2, attemptTimeoutMs: Math.max(timeoutMs, 9000), hedgeAfterMs: 5500 },
    );
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as T) : null;
  } catch (err) {
    console.warn("[faryad] text model call failed:", (err as Error).message);
    return null;
  }
}
