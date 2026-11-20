import { broadcast } from "@/server/bus";
import { fail, json, readJson } from "@/server/http";
import { hasOpenAIKey, openaiConfig } from "@/server/openai";
import {
  buildInstructions,
  DEFAULT_GREETING,
  DEFAULT_SYSTEM_PROMPT,
  getSettings,
  REALTIME_VOICES,
  resetSettings,
  saveSettings,
  type AgentSettings,
} from "@/server/settings";

export const dynamic = "force-dynamic";

function payload() {
  const cfg = openaiConfig();
  const settings = getSettings();
  return {
    settings,
    defaults: { greeting: DEFAULT_GREETING, systemPrompt: DEFAULT_SYSTEM_PROMPT },
    voices: REALTIME_VOICES,
    resolvedPrompt: buildInstructions(settings),
    publicBaseUrl: settings.publicBaseUrl || null,
    envPublicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || null,
    aiReady: hasOpenAIKey(),
    models: {
      realtime: cfg.realtimeModel,
      transcribe: cfg.transcribeModel,
      tts: cfg.ttsModel,
      ttsVoice: cfg.ttsVoice,
      text: cfg.textModel,
    },
  };
}

export async function GET() {
  try {
    return json(payload());
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await readJson<Partial<AgentSettings> & { reset?: boolean }>(req);
    if (body.reset) resetSettings();
    else saveSettings(body);
    const result = payload();
    // QR codes on every open screen follow the new address straight away.
    broadcast({ type: "settings.updated", payload: { publicBaseUrl: result.publicBaseUrl } });
    return json(result);
  } catch (err) {
    return fail(err);
  }
}
