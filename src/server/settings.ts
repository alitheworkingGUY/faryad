import { db, schema } from "@/db";
import { listAreas } from "./areas";
import { openaiConfig } from "./openai";

export const REALTIME_VOICES = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;

export type AgentSettings = {
  agentName: string;
  greeting: string;
  voice: string;
  systemPrompt: string;
  /** Public https address of this app (the tunnel URL). Used in every QR code. */
  publicBaseUrl: string;
};

export const DEFAULT_GREETING = "السلام علیکم، فریاد ہیلپ لائن، میں آپ کی کیا مدد کر سکتی ہوں؟";

// {agent_name}, {greeting} and {list} are filled in when a call starts.
export const DEFAULT_SYSTEM_PROMPT = `You are {agent_name}, the 24/7 complaint helpline of Peshawar municipal services. Speak natural, warm, polite Pakistani Urdu; switch to English if the caller does. Keep replies to 1–2 short sentences.

Flow: greet ('{greeting}') → understand the problem → ask area/mohalla (match to known areas: {list}) → ask name and phone → read back and confirm → call create_ticket → tell the ticket number slowly digit by digit and the expected resolution time → ask if anything else.

If the caller gives a ticket number or asks about an old complaint, call get_ticket_status. Never invent numbers, times or promises. If the caller is angry, abusive or asks for a human, call transfer_to_human. Estimate caller mood 1–5 for create_ticket.`;

// Operating rules that are always appended: they describe how the tools behave,
// so they are not part of the editable prompt.
const TOOL_RULES = `

Operating rules:
- Start the call by saying the greeting exactly once, then listen.
- You speak as a woman: always use feminine Urdu verb forms for yourself (کر سکتی ہوں، کر لیتی ہوں، درج کر رہی ہوں), never masculine ones.
- You handle these complaint types only: water (پانی), sewerage (گٹر / نکاسی), garbage (کچرا), streetlight (سٹریٹ لائٹ), road (سڑک), electricity (بجلی). For anything else, politely say this helpline covers municipal services only.
- A system note at the start of the call says whether the caller shared their GPS location. Only if it says the location WAS shared may you tell the caller their location was received; then confirm the area it suggests instead of asking where the problem is. If it says the location was NOT shared, ask which area or mohalla. Never claim to have the caller's location unless a system note or the set_location_from_gps tool says so. Call set_location_from_gps only to re-check later, for example if the caller says they have just shared it.
- Collect the phone number as digits. When you read it back, say it digit by digit.
- Only call create_ticket after the caller has confirmed the details. Pass description_ur in Urdu script and description_en in plain English, one sentence each. mood: 1 = very upset, 3 = neutral, 5 = calm.
- create_ticket returns ticket_no_spoken_ur and sla_hours. Say the ticket number using ticket_no_spoken_ur, slowly, one digit at a time, and say it will be resolved within sla_hours hours. Never state a number or time that a tool did not return.
- For get_ticket_status, use the in_simple_terms text from the result.
- After transfer_to_human, tell the caller an officer has been alerted and will call them back shortly, and stay polite.
- Never mention tools, JSON, or that you are an AI model unless asked directly.`;

const DEFAULTS = (): AgentSettings => ({
  agentName: "Faryad",
  greeting: DEFAULT_GREETING,
  voice: openaiConfig().realtimeVoice,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  publicBaseUrl: cleanUrl(process.env.PUBLIC_BASE_URL),
});

function cleanUrl(value: string | undefined | null): string {
  const v = (value ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : "";
}

/** Saved in Settings (or by `npm run tunnel`); falls back to PUBLIC_BASE_URL from the environment. */
export function getPublicBaseUrl(): string | null {
  return getSettings().publicBaseUrl || null;
}

export function getSettings(): AgentSettings {
  const rows = db().select().from(schema.settings).all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const base = DEFAULTS();
  return {
    agentName: stored.agentName?.trim() || base.agentName,
    greeting: stored.greeting?.trim() || base.greeting,
    voice: (REALTIME_VOICES as readonly string[]).includes(stored.voice) ? stored.voice : base.voice,
    systemPrompt: stored.systemPrompt?.trim() || base.systemPrompt,
    publicBaseUrl: stored.publicBaseUrl !== undefined ? cleanUrl(stored.publicBaseUrl) : base.publicBaseUrl,
  };
}

export function saveSettings(patch: Partial<AgentSettings>): AgentSettings {
  const d = db();
  for (const key of ["agentName", "greeting", "voice", "systemPrompt", "publicBaseUrl"] as const) {
    let value = patch[key];
    if (typeof value !== "string") continue;
    if (key === "publicBaseUrl") value = cleanUrl(value);
    d.insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
      .run();
  }
  return getSettings();
}

export function resetSettings(): AgentSettings {
  db().delete(schema.settings).run();
  return getSettings();
}

/** The full instructions sent to the Realtime model for one call. */
export function buildInstructions(s: AgentSettings = getSettings()): string {
  const list = listAreas()
    .map((a) => `${a.nameEn} (${a.nameUr})`)
    .join(", ");
  const prompt = s.systemPrompt
    .replaceAll("{agent_name}", s.agentName)
    .replaceAll("{greeting}", s.greeting)
    .replaceAll("{list}", list);
  return prompt + TOOL_RULES;
}
