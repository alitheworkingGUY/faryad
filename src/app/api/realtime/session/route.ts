import { fail, json } from "@/server/http";
import { hasOpenAIKey, mintRealtimeSecret, OpenAIError } from "@/server/openai";
import { realtimeSession } from "@/server/realtime";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Mints a short-lived client secret; the browser uses it to open the WebRTC call to OpenAI. */
export async function POST() {
  try {
    if (!hasOpenAIKey()) {
      return json(
        {
          error: "The voice agent is not configured yet. Add OPENAI_API_KEY to .env.local and restart.",
          code: "no_key",
        },
        503,
      );
    }
    const { session, model, voice } = realtimeSession();
    let secret: Awaited<ReturnType<typeof mintRealtimeSecret>>;
    // If OpenAI refuses part of the audio config (the API shape moves), start with the
    // essentials and let the browser apply the rest over the data channel.
    let sessionUpdate: Record<string, unknown> | null = null;
    try {
      secret = await mintRealtimeSecret(session);
    } catch (err) {
      if (!(err instanceof OpenAIError) || err.status !== 400) throw err;
      console.warn("[faryad] full realtime session config refused:", err.message);
      const { audio, output_modalities: _modalities, ...essentials } = session;
      secret = await mintRealtimeSecret({ ...essentials, audio: { output: audio.output } });
      sessionUpdate = { type: "realtime", audio: { input: audio.input } };
    }
    return json({
      clientSecret: secret.value,
      expiresAt: secret.expiresAt,
      model,
      voice,
      greeting: getSettings().greeting,
      sessionUpdate,
    });
  } catch (err) {
    return fail(err);
  }
}
