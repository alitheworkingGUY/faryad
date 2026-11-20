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
  textModel: process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini",
});

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call(pathname: string, body: unknown, timeoutMs: number): Promise<Response> {
  if (!hasOpenAIKey()) throw new OpenAIError("OPENAI_API_KEY is not set", 503);
  const res = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
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
  const res = await call("/realtime/client_secrets", { session }, 15_000);
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
    20_000,
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
      timeoutMs,
    );
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as T) : null;
  } catch {
    return null;
  }
}
