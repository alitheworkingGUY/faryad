import { CATEGORIES } from "@/lib/domain";
import { listAreas } from "./areas";
import { openaiConfig } from "./openai";
import { buildInstructions, getSettings } from "./settings";

/** Function tools the voice agent can call. The browser executes them against our REST API. */
export function realtimeTools() {
  const areaNames = listAreas().map((a) => a.nameEn);
  return [
    {
      type: "function",
      name: "create_ticket",
      description:
        "Register the caller's complaint once they have confirmed the details. Returns the ticket number, the department and the expected resolution time in hours.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string", description: "Caller's name as they said it." },
          phone: { type: "string", description: "Caller's phone number, digits only, e.g. 03331234567." },
          area: {
            type: "string",
            description: `The area / mohalla of the problem. Use the closest of: ${areaNames.join(", ")}.`,
          },
          category: { type: "string", enum: [...CATEGORIES] },
          description_ur: { type: "string", description: "One sentence in Urdu script describing the problem." },
          description_en: { type: "string", description: "One sentence in English describing the problem." },
          mood: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "Caller mood: 1 very upset, 3 neutral, 5 calm.",
          },
        },
        required: ["caller_name", "phone", "area", "category", "description_ur", "description_en", "mood"],
      },
    },
    {
      type: "function",
      name: "get_ticket_status",
      description:
        "Look up an existing complaint by ticket number (e.g. FRD-1023 or just 1023) or by the caller's phone number. Returns the status in simple terms.",
      parameters: {
        type: "object",
        properties: {
          ticket_no: { type: "string", description: "Ticket number, e.g. FRD-1023." },
          phone: { type: "string", description: "Phone number the complaint was registered with." },
        },
      },
    },
    {
      type: "function",
      name: "set_location_from_gps",
      description:
        "Check whether the caller shared their phone's GPS location on this call. If shared, the ticket will use the exact location and the nearest known area is returned.",
      parameters: { type: "object", properties: {} },
    },
    {
      type: "function",
      name: "transfer_to_human",
      description:
        "Alert a human officer in the command centre. Use when the caller is angry or abusive, or asks to speak to a person.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Short reason in English." },
        },
      },
    },
  ];
}

/** Session config for POST /v1/realtime/client_secrets (GA shape). */
export function realtimeSession() {
  const cfg = openaiConfig();
  const settings = getSettings();
  const areas = listAreas();
  const transcription: Record<string, unknown> = {
    model: cfg.transcribeModel,
    // Place names help the transcriber spell the areas the caller mentions.
    prompt: `Peshawar municipal complaint helpline. Urdu in Urdu script, sometimes English. Places: ${areas
      .map((a) => a.nameUr)
      .join("، ")}.`,
  };
  if (cfg.transcribeLanguage) transcription.language = cfg.transcribeLanguage;

  return {
    model: cfg.realtimeModel,
    voice: settings.voice,
    session: {
      type: "realtime",
      model: cfg.realtimeModel,
      instructions: buildInstructions(settings),
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription,
          noise_reduction: { type: "near_field" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice: settings.voice },
      },
      tools: realtimeTools(),
      tool_choice: "auto",
    },
  };
}
