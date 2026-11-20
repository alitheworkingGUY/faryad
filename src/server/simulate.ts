import { randomUUID } from "node:crypto";
import type { Category } from "@/lib/domain";
import { ticketNoSpokenUr } from "@/lib/format";
import { addCallEvent, endCall, startCall } from "./calls";
import { createTicket } from "./tickets";

// A scripted call played through the same pipeline as a real one (call record,
// live transcript, extracted details, ticket, incident clustering). It is the
// stage fallback if the venue network cannot reach OpenAI, and a quick way to
// rehearse the Command Center.

type Scenario = {
  name: string;
  phone: string;
  area: string;
  areaUr: string;
  category: Category;
  mood: number;
  problemUr: string;
  descriptionEn: string;
};

export const SCENARIOS: Record<string, Scenario> = {
  "gulbahar-water": {
    name: "Sajid Khan",
    phone: "03339876543",
    area: "Gulbahar",
    areaUr: "گلبہار",
    category: "water",
    mood: 2,
    problemUr: "جی، ہمارے علاقے میں صبح سے پانی نہیں آ رہا، بہت پریشانی ہے۔",
    descriptionEn: "No water supply since morning in Gulbahar.",
  },
  "hayatabad-streetlight": {
    name: "Nida Yousaf",
    phone: "03451239876",
    area: "Hayatabad Phase 3",
    areaUr: "حیات آباد فیز ۳",
    category: "streetlight",
    mood: 4,
    problemUr: "ہماری گلی کی سٹریٹ لائٹس کئی دن سے بند ہیں، رات کو بہت اندھیرا ہوتا ہے۔",
    descriptionEn: "Streetlights have been off for several days in Hayatabad Phase 3.",
  },
  "saddar-garbage": {
    name: "Arif Hussain",
    phone: "03005557788",
    area: "Saddar",
    areaUr: "صدر",
    category: "garbage",
    mood: 3,
    problemUr: "بازار کے قریب کچرے کا ڈھیر لگا ہوا ہے، تین دن سے کوئی اٹھانے نہیں آیا۔",
    descriptionEn: "A garbage heap near the bazaar in Saddar has not been collected for three days.",
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Speaks a line word by word, like live captions. */
async function say(callId: string, role: "caller" | "agent", text: string, speed = 1): Promise<void> {
  const id = randomUUID();
  const words = text.split(" ");
  let shown = "";
  for (let i = 0; i < words.length; i++) {
    shown = shown ? `${shown} ${words[i]}` : words[i];
    if (i < words.length - 1 && i % 2 === 0) {
      addCallEvent(callId, { type: "transcript", id, role, text: shown, final: false });
    }
    await sleep((role === "agent" ? 130 : 170) / speed);
  }
  addCallEvent(callId, { type: "transcript", id, role, text, final: true });
}

export function listScenarios(): string[] {
  return Object.keys(SCENARIOS);
}

/** Starts the scripted call and returns immediately; the call plays out in the background. */
export function simulateCall(scenarioKey?: string, speed = 1): { callId: string; scenario: string } {
  const key = scenarioKey && SCENARIOS[scenarioKey] ? scenarioKey : "gulbahar-water";
  const s = SCENARIOS[key];
  const call = startCall({ simulated: true });
  const callId = call.id;
  const started = Date.now();
  const pause = (ms: number) => sleep(ms / speed);
  // Roughly what a real Realtime call costs per second of conversation.
  const USD_PER_SECOND = 0.0011;
  const elapsed = () => Math.round(((Date.now() - started) / 1000) * speed);
  const tick = () =>
    addCallEvent(callId, {
      type: "metrics",
      seconds: Math.round((Date.now() - started) / 1000),
      costUsd: elapsed() * USD_PER_SECOND,
    });

  void (async () => {
    try {
      await pause(900);
      await say(callId, "agent", "السلام علیکم، فریاد ہیلپ لائن، میں آپ کی کیا مدد کر سکتی ہوں؟", speed);
      tick();
      await pause(700);
      await say(callId, "caller", s.problemUr, speed);
      addCallEvent(callId, {
        type: "fields",
        fields: { category: s.category, description: s.descriptionEn, mood: s.mood },
      });
      tick();
      await pause(600);
      await say(callId, "agent", "مجھے افسوس ہے کہ آپ کو یہ تکلیف ہو رہی ہے۔ یہ مسئلہ کس علاقے میں ہے؟", speed);
      await pause(600);
      await say(callId, "caller", `${s.areaUr} میں۔`, speed);
      addCallEvent(callId, { type: "fields", fields: { area: s.area } });
      tick();
      await pause(500);
      await say(callId, "agent", "شکریہ۔ براہِ کرم اپنا نام اور فون نمبر بتا دیں۔", speed);
      await pause(600);
      await say(callId, "caller", `میرا نام ${s.name} ہے، اور نمبر ہے ${s.phone}۔`, speed);
      addCallEvent(callId, { type: "fields", fields: { name: s.name, phone: s.phone } });
      tick();
      await pause(500);
      await say(
        callId,
        "agent",
        `ٹھیک ہے ${s.name} صاحب، ${s.areaUr} میں مسئلہ درج کر رہی ہوں۔ کیا یہ درست ہے؟`,
        speed,
      );
      await pause(500);
      await say(callId, "caller", "جی، بالکل درست ہے۔", speed);
      await pause(700);

      const { ticket, slaHours } = createTicket({
        callerName: s.name,
        phone: s.phone,
        area: s.area,
        category: s.category,
        descriptionUr: s.problemUr,
        descriptionEn: s.descriptionEn,
        mood: s.mood,
        callId,
      });
      tick();
      await pause(900);
      await say(
        callId,
        "agent",
        `آپ کی شکایت درج ہو گئی ہے۔ آپ کا شکایت نمبر ہے: ${ticketNoSpokenUr(ticket.ticketNo)}۔ یہ ${slaHours} گھنٹوں کے اندر حل کر دی جائے گی۔ کیا میں کسی اور چیز میں مدد کر سکتی ہوں؟`,
        speed,
      );
      await pause(600);
      await say(callId, "caller", "نہیں، بہت شکریہ۔", speed);
      await pause(400);
      await say(callId, "agent", "فریاد ہیلپ لائن پر کال کرنے کا شکریہ۔ اللہ حافظ۔", speed);
      tick();
      await pause(1200);
    } catch (err) {
      console.error("[faryad] simulated call failed:", err);
    } finally {
      try {
        endCall(callId, { seconds: Math.round((Date.now() - started) / 1000), costUsd: elapsed() * USD_PER_SECOND });
      } catch {
        // the call may already be gone after a demo reset
      }
    }
  })();

  return { callId, scenario: key };
}
