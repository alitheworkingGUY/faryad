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
      secret = await mintRealtimeSecret({
        type: session.type,
        model: session.model,
        instructions: session.instructions,
        tools: session.tools,
        tool_choice: session.tool_choice,
        audio: { output: session.audio.output },
      });
      sessionUpdate = { type: "realtime", audio: { input: session.audio.input } };
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
