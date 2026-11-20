// A REAL call to the Faryad voice agent, with a scripted Urdu caller. Spends OpenAI credit
// (about one 1-2 minute Realtime call plus a few short text-to-speech clips).
//
// The caller's lines are synthesised with OpenAI TTS and played into the call page as
// its microphone. The script waits for the agent to finish each turn before answering,
// so it is a genuine back-and-forth with the Realtime model: Urdu speech in, tool
// calls, ticket creation, and the ticket number read back.
//
//   node scripts/e2e-real-call.mjs [baseUrl] [screenshotDir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const shots = process.argv[3] ?? ".";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const key = env.match(/^OPENAI_API_KEY=(.*)$/m)?.[1]?.trim();
if (!key) {
  console.error("OPENAI_API_KEY is not set in .env.local");
  process.exit(1);
}

// What the caller says, in order. Each line is sent after the agent stops talking.
const LINES = [
  "السلام علیکم۔ گلبہار میں صبح سے پانی نہیں آ رہا، بہت پریشانی ہے۔",
  "جی، گلبہار میں۔ میرا نام عمران خان ہے، اور میرا فون نمبر ہے صفر تین تین تین، ایک دو تین، چار پانچ چھ سات۔",
  "جی ہاں، بالکل درست ہے۔",
  "جی ہاں، درج کر دیں۔",
  "نہیں، بس یہی تھا۔ بہت شکریہ۔",
];

const audioDir = path.join(root, "public", "audio");
fs.mkdirSync(audioDir, { recursive: true });
const clips = [];
console.log("Synthesising the caller's lines...");
for (let i = 0; i < LINES.length; i++) {
  const file = `test-caller-${i + 1}.mp3`;
  let audio = null;
  // Connections and downloads sometimes stall on a weak network: retry the whole clip.
  for (let attempt = 1; attempt <= 5 && !audio; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "ash",
          input: LINES[i],
          response_format: "mp3",
          instructions: "A man from Peshawar phoning a helpline. Natural conversational Pakistani Urdu, clear, normal pace.",
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.error(`TTS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        process.exit(1);
      }
      audio = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.log(`  clip ${i + 1}: attempt ${attempt} failed (${err.message}), retrying`);
      if (attempt === 5) {
        console.error("Could not reach OpenAI for text-to-speech.");
        process.exit(1);
      }
    }
  }
  fs.writeFileSync(path.join(audioDir, file), audio);
  clips.push(`/api/audio/${file}`);
}

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const problems = [];

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
    if (m.type() === "warning" && m.text().includes("[faryad]")) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.addInitScript(() => {
    // A virtual microphone the test can speak into.
    const mic = { ctx: null, dest: null, speaking: false };
    window.__mic = mic;
    const ensure = () => {
      if (!mic.ctx) {
        mic.ctx = new AudioContext();
        mic.dest = mic.ctx.createMediaStreamDestination();
        // A whisper of noise keeps the track alive between utterances.
        const osc = mic.ctx.createOscillator();
        const g = mic.ctx.createGain();
        g.gain.value = 0.00001;
        osc.connect(g).connect(mic.dest);
        osc.start();
      }
      return mic;
    };
    navigator.mediaDevices.getUserMedia = async () => ensure().dest.stream;
    mic.say = async (url) => {
      const m = ensure();
      await m.ctx.resume();
      const buf = await m.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      const src = m.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(m.dest);
      m.speaking = true;
      src.start();
      await new Promise((r) => (src.onended = r));
      m.speaking = false;
      return buf.duration;
    };

    // Record every event the real Realtime API sends over the data channel.
    window.__rt = { types: {}, usage: null, tools: [], errors: [], sent: [], active: 0, audio: false, last: Date.now() };
    const create = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function (...args) {
      const dc = create.apply(this, args);
      dc.addEventListener("message", (ev) => {
        try {
          const e = JSON.parse(ev.data);
          window.__rt.types[e.type] = (window.__rt.types[e.type] || 0) + 1;
          // Is the agent in the middle of a turn (thinking, calling a tool, or speaking)?
          if (e.type === "response.created") window.__rt.active++;
          if (e.type === "response.done") window.__rt.active = Math.max(0, window.__rt.active - 1);
          if (e.type === "output_audio_buffer.started") window.__rt.audio = true;
          if (e.type === "output_audio_buffer.stopped" || e.type === "output_audio_buffer.cleared") window.__rt.audio = false;
          if (/^(response\.|output_audio_buffer\.)/.test(e.type)) window.__rt.last = Date.now();
          if (e.type === "response.done" && e.response?.usage) window.__rt.usage = e.response.usage;
          if (e.type === "response.function_call_arguments.done") window.__rt.tools.push({ name: e.name, args: e.arguments });
          if (e.type === "error") window.__rt.errors.push(e.error);
        } catch {}
      });
      const send = dc.send.bind(dc);
      dc.send = (data) => {
        try {
          window.__rt.sent.push(JSON.parse(data).type);
        } catch {}
        return send(data);
      };
      return dc;
    };
  });

  await page.goto(`${base}/call`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("faryad.ticket"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const b = document.querySelector('button[aria-label="Start talking"]');
    return Boolean(b && Object.keys(b).some((k) => k.startsWith("__reactProps")));
  });

  const t0 = Date.now();
  await page.click('button[aria-label="Start talking"]');
  await page.waitForSelector("text=Live", { timeout: 30_000 });
  check("Connected to OpenAI Realtime over WebRTC", true, `${Date.now() - t0} ms from tap to live`);

  const bodyText = () => page.evaluate(() => document.body.innerText);
  // The agent's turn is over when no response is in progress, its audio has finished
  // playing, and nothing has happened for a moment (a tool call starts a new response
  // a few hundred milliseconds after the previous one ends).
  const agentIdle = async () => {
    for (let i = 0; i < 240; i++) {
      const idle = await page.evaluate(
        () => window.__rt.active === 0 && !window.__rt.audio && !window.__mic.speaking && Date.now() - window.__rt.last > 2500,
      );
      if (idle) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const ticketShown = async () => /FRD-\d{4}/.test(await bodyText());

  // Greeting
  await page.waitForFunction(() => (window.__rt.types["response.output_audio_transcript.done"] ?? 0) + (window.__rt.types["response.audio_transcript.done"] ?? 0) > 0, null, { timeout: 30_000 });
  const greeting = (await bodyText()).split("\n").find((l) => l.includes("فریاد")) ?? "";
  check("Agent greeted first, in Urdu", /[؀-ۿ]/.test(greeting), greeting.trim().slice(0, 90));
  await agentIdle();
  await page.screenshot({ path: `${shots}/real-call-1-greeting.png` });

  for (let i = 0; i < clips.length; i++) {
    if (i >= 2 && (await ticketShown()) && i < clips.length - 1) continue; // already registered: skip extra confirmations
    console.log(`CALLER  ${LINES[i]}`);
    await page.evaluate((u) => window.__mic.say(u), clips[i]);
    // give the model a moment to start answering, then wait for it to finish
    await page.waitForTimeout(1500);
    await agentIdle();
    if ((await ticketShown()) && i === clips.length - 1) break;
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/real-call-2-ticket.png` });
  const rt = await page.evaluate(() => window.__rt);
  const text = await bodyText();
  const ticketNo = text.match(/FRD-\d{4}/)?.[0];

  console.log("\nRealtime events received:", JSON.stringify(rt.types));
  console.log("Client events sent:", [...new Set(rt.sent)].join(", "));
  console.log("Usage sample:", JSON.stringify(rt.usage));
  console.log("Tool calls:", JSON.stringify(rt.tools));

  check("Caller's Urdu was transcribed", (rt.types["conversation.item.input_audio_transcription.completed"] ?? 0) > 0);
  check("Agent captions streamed", (rt.types["response.output_audio_transcript.delta"] ?? rt.types["response.audio_transcript.delta"] ?? 0) > 0);
  check("Usage arrives on response.done", Boolean(rt.usage && (rt.usage.input_tokens || rt.usage.total_tokens)));
  check("Agent called create_ticket", rt.tools.some((t) => t.name === "create_ticket"));
  check("Ticket registered and shown on the phone", Boolean(ticketNo), ticketNo ?? "none");
  check("No Realtime error events", rt.errors.length === 0, rt.errors.map((e) => e?.message).join(" | "));

  await page.click('button[aria-label="End call"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${shots}/real-call-3-ended.png` });

  if (ticketNo) {
    const d = await (await fetch(`${base}/api/tickets/${ticketNo}`)).json();
    const t = d.ticket;
    console.log("\nTicket:", JSON.stringify({ no: t.ticketNo, name: t.callerName, phone: t.phoneMasked, area: t.areaEn, category: t.category, dept: t.departmentCode, mood: t.mood, ur: t.descriptionUr, en: t.descriptionEn }));
    console.log("Call:", JSON.stringify({ seconds: d.call?.seconds, costUsd: d.call?.costUsd, costPkr: d.call?.costPkr, lines: d.call?.transcript?.length }));
    for (const l of d.call?.transcript ?? []) console.log(`  ${l.role === "agent" ? "AGENT " : "CALLER"} ${l.text}`);
    const agentLines = (d.call?.transcript ?? []).filter((l) => l.role === "agent").map((l) => l.text);
    const digitWords = ["صفر", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو"];
    const spoken = t.ticketNo.replace(/\D/g, "").split("").map((n) => digitWords[Number(n)]);
    const readOut = agentLines.some((l) => spoken.every((w) => l.includes(w)) || l.includes(t.ticketNo.replace(/\D/g, "")));
    check("Agent read the ticket number back", readOut, spoken.join(" "));
    check("Agent did not claim a GPS location (none was shared)", !agentLines.some((l) => /لوکیشن (مل|ملی|موصول)/.test(l)));
    check("Area matched to Gulbahar", t.areaEn === "Gulbahar", t.areaEn);
    check("Category is water", t.category === "water", t.category);
    check("Cost recorded for the call", (d.call?.costUsd ?? 0) > 0, `USD ${d.call?.costUsd?.toFixed(4)} = PKR ${d.call?.costPkr}`);
  }
} catch (err) {
  check("real call completed", false, err.message.split("\n")[0]);
} finally {
  await browser.close();
  for (const f of fs.readdirSync(audioDir)) if (f.startsWith("test-caller-")) fs.rmSync(path.join(audioDir, f), { force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (problems.length) console.log(`Browser console:\n${[...new Set(problems)].join("\n")}`);
process.exit(failed ? 1 : 0);
