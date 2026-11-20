// Smoke test for the citizen call page that needs no OpenAI credit.
//
// A fake "OpenAI" WebRTC peer runs inside the browser page and speaks the Realtime
// data-channel protocol: agent captions, caller transcription, tool calls, usage.
// Everything else is real: the call hook, tool execution against the REST API,
// ticket creation, SSE, and the Command Center mirroring the call.
//
//   node scripts/e2e-fake-call.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const shots = process.argv[3] ?? ".";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const problems = [];
const watch = (page, name) => {
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`[${name}] ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`[${name}] pageerror: ${e.message}`));
};

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

try {
  // Command Center on a desktop viewport
  const desk = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const cc = await desk.newPage();
  cc.setDefaultNavigationTimeout(180_000);
  watch(cc, "command-center");
  await cc.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await cc.waitForSelector("text=Waiting for calls", { timeout: 180_000 });

  // Citizen phone
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone", "geolocation"],
    geolocation: { latitude: 34.0108, longitude: 71.5893 }, // Gulbahar
  });
  const call = await phone.newPage();
  call.setDefaultNavigationTimeout(180_000);
  watch(call, "call-page");

  // The session endpoint normally needs an OpenAI key; answer it locally.
  await call.route("**/api/realtime/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientSecret: "ek_test_fake",
        model: "gpt-realtime",
        voice: "marin",
        greeting: "السلام علیکم",
        sessionUpdate: null,
      }),
    }),
  );

  // Fake OpenAI peer: intercepts the SDP POST and answers from a second peer connection.
  await call.addInitScript(() => {
    const realFetch = window.fetch.bind(window);
    window.__fake = { received: [], toolOutputs: [] };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!url.startsWith("https://api.openai.com/v1/realtime/calls")) return realFetch(input, init);

      const pc2 = new RTCPeerConnection();
      // An audible tone stands in for the agent's voice so the audio path is exercised.
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.02;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      dest.stream.getTracks().forEach((t) => pc2.addTrack(t, dest.stream));

      pc2.ondatachannel = (ev) => {
        const dc = ev.channel;
        const send = (e) => dc.send(JSON.stringify(e));
        let responses = 0;

        const agentSays = async (id, text) => {
          send({ type: "output_audio_buffer.started" });
          const words = text.split(" ");
          for (const w of words) {
            send({ type: "response.output_audio_transcript.delta", item_id: id, delta: w + " " });
            await sleep(60);
          }
          send({ type: "response.output_audio_transcript.done", item_id: id, transcript: text });
          send({
            type: "response.done",
            response: {
              usage: {
                input_tokens: 900,
                output_tokens: 260,
                input_token_details: { text_tokens: 700, audio_tokens: 200, cached_tokens: 0 },
                output_token_details: { text_tokens: 60, audio_tokens: 200 },
              },
              output: [],
            },
          });
          send({ type: "output_audio_buffer.stopped" });
        };
        const callerSays = async (id, text) => {
          send({ type: "input_audio_buffer.speech_started", item_id: id });
          await sleep(500);
          send({ type: "input_audio_buffer.speech_stopped", item_id: id });
          // Transcription lands after the agent has started to answer, as it does for real.
          setTimeout(
            () => send({ type: "conversation.item.input_audio_transcription.completed", item_id: id, transcript: text }),
            350,
          );
        };

        dc.onmessage = async (msg) => {
          const e = JSON.parse(msg.data);
          window.__fake.received.push(e.type);
          if (e.type === "conversation.item.create" && e.item?.type === "function_call_output") {
            window.__fake.toolOutputs.push({ call_id: e.item.call_id, output: JSON.parse(e.item.output) });
          }
          if (e.type !== "response.create") return;
          responses++;
          if (responses === 1) {
            await agentSays("a1", "السلام علیکم، فریاد ہیلپ لائن، میں آپ کی کیا مدد کر سکتی ہوں؟");
            await sleep(300);
            await callerSays("u1", "گلبہار میں صبح سے پانی نہیں آ رہا۔");
            await sleep(200);
            // The agent checks for GPS right after hearing the problem.
            send({ type: "response.function_call_arguments.done", call_id: "c_gps", name: "set_location_from_gps", arguments: "{}" });
          } else if (responses === 2) {
            await agentSays("a2", "آپ کی لوکیشن مل گئی ہے، آپ گلبہار میں ہیں۔ اپنا نام اور فون نمبر بتا دیں۔");
            await sleep(300);
            await callerSays("u2", "میرا نام عمران خان ہے، نمبر 03331234567 ہے۔");
            await sleep(900);
            send({
              type: "response.function_call_arguments.done",
              call_id: "c_ticket",
              name: "create_ticket",
              arguments: JSON.stringify({
                caller_name: "Imran Khan",
                phone: "03331234567",
                area: "Gulbahar",
                category: "water",
                description_ur: "گلبہار میں صبح سے پانی نہیں آ رہا۔",
                description_en: "No water in Gulbahar since morning.",
                mood: 2,
              }),
            });
          } else if (responses === 3) {
            const out = window.__fake.toolOutputs.find((t) => t.call_id === "c_ticket")?.output ?? {};
            await agentSays(
              "a3",
              `آپ کی شکایت درج ہو گئی ہے۔ شکایت نمبر ہے: ${out.ticket_no_spoken_ur ?? "?"}۔ یہ ${out.sla_hours ?? "?"} گھنٹوں میں حل ہو جائے گی۔`,
            );
            window.__fake.done = true;
          }
        };
      };

      await pc2.setRemoteDescription({ type: "offer", sdp: init.body });
      await pc2.setLocalDescription(await pc2.createAnswer());
      // Like the real service, the answer must carry this peer's ICE candidates.
      if (pc2.iceGatheringState !== "complete") {
        await new Promise((resolve) => {
          const done = () => pc2.iceGatheringState === "complete" && resolve();
          pc2.addEventListener("icegatheringstatechange", done);
          setTimeout(resolve, 4000);
        });
      }
      window.__fake.pc2 = pc2;
      return new Response(pc2.localDescription.sdp, { status: 201, headers: { "Content-Type": "application/sdp" } });
    };
  });

  await call.goto(`${base}/call`, { waitUntil: "domcontentloaded" });
  await call.evaluate(() => localStorage.removeItem("faryad.ticket"));
  await call.reload({ waitUntil: "domcontentloaded" });
  const loadStart = Date.now();
  await call.waitForSelector('button[aria-label="Start talking"]', { timeout: 180_000 });
  console.log(`INFO  call page ready ${((Date.now() - loadStart) / 1000).toFixed(1)}s after reload`);
  // Tapping before React has attached its handlers does nothing, so wait for hydration.
  await call.waitForFunction(
    () => {
      const b = document.querySelector('button[aria-label="Start talking"]');
      return Boolean(b && Object.keys(b).some((k) => k.startsWith("__reactProps")));
    },
    null,
    { timeout: 180_000 },
  );
  console.log(`INFO  call page interactive ${((Date.now() - loadStart) / 1000).toFixed(1)}s after reload`);

  // Share location first (Gulbahar)
  await call.click("text=اپنی لوکیشن بھیجیں");
  await call.waitForSelector("text=لوکیشن مل گئی", { timeout: 15_000 });
  const gpsLabel = await call.locator("text=لوکیشن مل گئی").first().innerText();
  check("GPS shared and nearest area shown", gpsLabel.includes("Gulbahar"), gpsLabel.replace(/\s+/g, " "));

  await call.click('button[aria-label="Start talking"]');
  await call.waitForSelector("text=Live", { timeout: 20_000 });
  check("Call connects and goes live", true);

  if (process.env.DEBUG_E2E) {
    await call.waitForTimeout(5000);
    console.log(
      "DEBUG",
      JSON.stringify(
        await call.evaluate(() => ({
          received: window.__fake?.received,
          pc2: window.__fake?.pc2?.connectionState,
          text: document.body.innerText.slice(0, 400),
        })),
      ),
    );
    await call.screenshot({ path: `${shots}/e2e-debug.png` });
  }
  await call.waitForFunction(() => document.body.innerText.includes("فریاد ہیلپ لائن، میں آپ کی کیا مدد"), null, { timeout: 15_000 });
  await call.waitForTimeout(900);
  await call.screenshot({ path: `${shots}/e2e-call-live.png` });
  await cc.waitForSelector("text=Live call", { timeout: 10_000 });
  check("Command Center shows the live call", true);

  await call.waitForFunction(() => window.__fake?.done === true, null, { timeout: 40_000 });
  await call.waitForTimeout(1200);

  const fake = await call.evaluate(() => ({
    received: window.__fake.received,
    toolOutputs: window.__fake.toolOutputs,
  }));
  const gpsOut = fake.toolOutputs.find((t) => t.call_id === "c_gps")?.output;
  const ticketOut = fake.toolOutputs.find((t) => t.call_id === "c_ticket")?.output;
  check("set_location_from_gps returned shared=true", gpsOut?.shared === true && gpsOut?.nearest_area === "Gulbahar", JSON.stringify(gpsOut));
  check("create_ticket returned a ticket number", /^FRD-\d+$/.test(ticketOut?.ticket_no ?? ""), JSON.stringify(ticketOut));
  check("ticket used the exact GPS location", ticketOut?.exact_location_used === true);
  check(
    "each tool result was followed by response.create",
    fake.received.filter((t) => t === "response.create").length === 3,
    fake.received.join(","),
  );

  const ticketNo = ticketOut?.ticket_no ?? "FRD-0000";
  const cardVisible = await call.locator(`text=${ticketNo}`).first().isVisible();
  check("Phone shows the ticket card", cardVisible, ticketNo);
  await call.screenshot({ path: `${shots}/e2e-call-ticket.png` });

  // Command Center: pin + feed row + mirrored transcript and details
  await cc.waitForSelector(`text=${ticketNo}`, { timeout: 10_000 });
  await cc.waitForTimeout(600);
  await cc.screenshot({ path: `${shots}/e2e-cc-live.png` });
  const ccText = await cc.locator("body").innerText();
  check("Command Center feed shows the new ticket", ccText.includes(ticketNo));
  check("Command Center mirrors the transcript", ccText.includes("گلبہار میں صبح سے پانی نہیں آ رہا"));
  check("Extracted details show the caller", ccText.includes("Imran Khan") && ccText.includes("03xx-xxx-4567"));

  // Caption order: the caller's line must sit between the agent's first and second lines.
  const order = await call.evaluate(() => {
    const t = document.body.innerText;
    return [t.indexOf("میں آپ کی کیا مدد"), t.indexOf("صبح سے پانی نہیں"), t.indexOf("آپ کی لوکیشن مل گئی ہے")];
  });
  check("Captions are in speaking order", order[0] >= 0 && order[0] < order[1] && order[1] < order[2], order.join(" < "));

  // End the call -> status view
  await call.click('button[aria-label="End call"]');
  await call.waitForSelector("text=شکایت کی حالت", { timeout: 10_000 });
  check("Ending the call opens the live status view", true);

  // API calls go through the Command Center's browser tab, so they use the same route
  // (localhost or tunnel) as everything else in this run.
  const api = (path, init) =>
    cc.evaluate(
      async ([p, i]) => {
        const res = await fetch(p, i ? { ...i, headers: { "Content-Type": "application/json" } } : undefined);
        return res.json();
      },
      [path, init ?? null],
    );

  // Server record
  const detail = await api(`/api/tickets/${ticketNo}`);
  check("Ticket stored with GPS source", detail.ticket?.locationSource === "gps", detail.ticket?.locationSource);
  check(
    "Call transcript saved on the server",
    (detail.call?.transcript?.length ?? 0) >= 5,
    `${detail.call?.transcript?.length ?? 0} lines, ${detail.call?.seconds}s, PKR ${detail.call?.costPkr}`,
  );
  check("Call cost recorded from usage events", (detail.call?.costPkr ?? 0) > 0, `PKR ${detail.call?.costPkr}`);
  const incident = (await api("/api/incidents")).incidents.find((i) => i.ticketNos.includes(ticketNo));
  check("Third Gulbahar water report raised an incident", Boolean(incident), incident ? `#${incident.id}, ${incident.ticketCount} reports` : "none");

  // Officer resolves -> the citizen's phone updates
  for (const status of ["assigned", "in_progress", "resolved"]) {
    await api(`/api/tickets/${ticketNo}`, {
      method: "PATCH",
      body: JSON.stringify({ status, actor: "Insp. Shahid Afridi (WSSP)", resolutionNote: "Supply restored." }),
    });
  }
  const resolveSent = Date.now();
  await call.waitForSelector("text=آپ کی شکایت حل ہو گئی", { timeout: 15_000 });
  check("Phone shows Resolved after the officer resolves", true, `${Date.now() - resolveSent} ms after the update`);
  await call.waitForTimeout(3500);
  await call.screenshot({ path: `${shots}/e2e-call-resolved.png` });
  const hasAudio = await call.locator("audio[src*='/api/audio/']").count();
  console.log(hasAudio ? "INFO  voice note audio is attached" : "INFO  no voice note audio (needs OPENAI_API_KEY for text-to-speech)");
} catch (err) {
  check("test run completed", false, err.message.split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
console.log(problems.length ? `Console errors:\n${problems.join("\n")}` : "No console errors on either page.");
process.exit(failed ? 1 : 0);
