import { fail, json } from "@/server/http";
import { hasOpenAIKey, mintRealtimeSecret } from "@/server/openai";
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
    const secret = await mintRealtimeSecret(session);
    return json({
      clientSecret: secret.value,
      expiresAt: secret.expiresAt,
      model,
      voice,
      greeting: getSettings().greeting,
    });
  } catch (err) {
    return fail(err);
  }
}
