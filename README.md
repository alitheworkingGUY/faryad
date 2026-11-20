# Faryad · فریاد

A 24/7 AI voice helpline for Peshawar municipal services (prototype).

A citizen scans a QR code, speaks their complaint in Urdu or English from the phone's browser, and the AI agent registers a ticket. The complaint drops as a pin on the city map in the Command Center, an officer resolves it from their phone, and the citizen hears an Urdu voice note confirming it.

| Screen | Path | For |
| --- | --- | --- |
| Command Center | `/` | Projector / desk. Live map, live call panel, ticket feed, counters |
| Citizen call page | `/call` | Phone. Urdu-first voice call, ticket card, live status, voice note |out
| Officer app | `/officer` | Phone. Department queue, Assign → Start → Resolve |
| Tickets | `/tickets` | Search, filter, sort; ticket drawer with transcript, timeline, mark place |
| Incidents | `/incidents` | Clusters of similar complaints, AI summary, escalation level |
| Analytics | `/analytics` | Calls per hour, categories, areas, SLA, cost per call |
| Settings | `/settings` | Agent prompt and voice, public URL + QR codes, demo reset, simulated calls |

## Setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local     # then put your OpenAI key in it
npm run dev                    # http://localhost:3000
```

The database (`data/faryad.db`) is created and seeded automatically on first run.

**For the live demo, run the production build instead: `npm run demo`** (it runs `npm run build` then `npm start`, same port). `npm run dev` is for working on the code. Development bundles are many times larger, and through the tunnel on a slow uplink the phone page took over two minutes to become usable in dev mode, against a few seconds in production.

### Environment variables (`.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | none | **Required** for the voice agent, the Urdu voice note and AI incident summaries |
| `OPENAI_REALTIME_MODEL` | `gpt-realtime` | Voice agent model |
| `OPENAI_REALTIME_VOICE` | `marin` | Default agent voice (can be changed in Settings) |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe` | Transcribes the caller for captions and the Command Center |
| `OPENAI_TRANSCRIBE_LANGUAGE` | `ur` | Keeps Urdu in Urdu script. Leave empty to auto-detect |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | Voice note on resolve |
| `OPENAI_TTS_VOICE` | `coral` | Voice note voice |
| `OPENAI_TEXT_MODEL` | `gpt-4o-mini` | Live field extraction and incident summaries |
| `PUBLIC_BASE_URL` | none | Public https address used in QR codes. Optional: `npm run tunnel` sets it at runtime |

Restart the server after changing `.env.local`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app on port 3000 in development mode |
| `npm run demo` | Build and start the production server on port 3000. Use this on stage |
| `npm run test:call` | End-to-end check of the call page with a stand-in for OpenAI (no credit used). Needs the app running; pass the tunnel URL as an argument to test through it |
| `npm run seed` | Wipe tickets, calls and incidents and load the demo dataset (use Settings → Reset demo data while the app is running) |
| `npm run tunnel` | Start `cloudflared` and tell the app its public URL, so QR codes work on phones |
| `npm run tiles` | Cache the Peshawar map tiles locally (needs the app running). Do this once on good internet |
| `npm run demo:call` | Play a scripted call through the real pipeline |
| `npm run build` / `npm start` | Production build and server |

## Phones: Cloudflare tunnel

Phones need https for the microphone, so the app is exposed through a Cloudflare quick tunnel.

```bash
winget install Cloudflare.cloudflared      # once (or put cloudflared.exe in ./tools/)

# terminal 1
npm run demo
# terminal 2
npm run tunnel
```

`npm run tunnel` runs `cloudflared tunnel --url http://localhost:3000`, reads the `https://….trycloudflare.com` address it prints and saves it in the app. Every QR code updates immediately. To do it by hand, run the cloudflared command yourself and paste the address into Settings → Public URL.

Keep the Command Center on `http://localhost:3000` on the projector laptop (fastest). Phones use the tunnel address from the QR code.

Cloudflare quick tunnels hold back Server-Sent Events, so a page opened through the tunnel gets its live updates by long-polling `/api/events` instead. This is automatic. Measured through the tunnel: the citizen's phone showed "Resolved" about 150 ms after the officer's update.

## Demo-day checklist

The evening before:

1. Put `OPENAI_API_KEY` in `.env.local`. Confirm the account has credit.
2. `npm run demo`, then `npm run tiles` once so the map loads from disk.
3. `npm run tunnel`, scan the QR with an Android phone and complete one full Urdu call. Check the pin drops and the ticket number is read out.
4. Open `/officer` on a second phone, resolve that ticket and confirm the first phone plays the voice note.

On the day, about 30 minutes before you present:

1. Connect the laptop to the venue network, then start `npm run demo` and `npm run tunnel` (the tunnel address is new every time).
2. Open `http://localhost:3000` in Chrome on the projector and press **F** for fullscreen. Check the top bar shows **AI Agent Online** in green.
3. Settings → **Reset demo data**. This matters: the dataset has two open "no water" reports in Gulbahar, and the third call raises an incident only while those two are under two hours old. A reset gives you about 1 h 45 min.
4. Open `/officer` on the officer phone and pick **WSSP**.
5. Scan the Command Center QR with the caller phone, allow the microphone, and tap **📍 اپنی لوکیشن بھیجیں** if you want the exact GPS pin.

Suggested script for the live call: say there has been no water since morning, the area is **Gulbahar**, then give a name and phone number. The agent reads the ticket number digit by digit, the pin drops, and a red incident ring appears over Gulbahar. Then resolve the ticket from the officer phone and the caller phone plays the Urdu voice note.

If the venue network cannot reach OpenAI: press **S** on the Command Center (or Settings → Simulated calls). A scripted call plays through the same pipeline: live transcript, extracted details, ticket, pin and incident.

Command Center keys: **F** fullscreen · **M** heatmap · **R** show/hide resolved pins · **S** simulated call.

## How it works

- **One Next.js app** (App Router, TypeScript, Tailwind v4, shadcn/ui, Framer Motion). No other services to run.
- **Data**: SQLite at `data/faryad.db` through Drizzle ORM. Schema in `src/db/schema.ts`, demo data in `src/db/seed-data.ts`.
- **Live updates**: `GET /api/stream` is a Server-Sent Events stream. Every screen holds one connection; the server broadcasts `call.*`, `ticket.*`, `incident.*`, `citizen.notify` and `settings.updated` events. `GET /api/events` serves the same events by long-polling for connections that buffer SSE; the browser switches to it by itself if the stream's first message does not arrive within four seconds.
- **Voice**: the browser opens a WebRTC call straight to the OpenAI Realtime API using a short-lived client secret from `POST /api/realtime/session`. The agent's tools (`create_ticket`, `get_ticket_status`, `set_location_from_gps`, `transfer_to_human`) run in the browser against our REST API. Captions and usage are posted to `/api/calls/{id}/events` so the Command Center shows the call live. Speaking over the agent interrupts it (server VAD, 500 ms silence).
- **Extracted details** on the Command Center come from the server: a keyword pass on each caller line, then a small text model, so the voice loop is never slowed.
- **Business rules** (`src/server/`): department and SLA by category, priority from category + caller mood, incident clustering (3+ open tickets, same category and area, within 2 hours; escalation = min(3, floor(count / 3))).
- **Voice note**: on resolve, OpenAI TTS writes an MP3 to `public/audio/`, served through `/api/audio/…`.
- **Map**: MapLibre GL with OpenStreetMap raster tiles, darkened in the map style. Tiles go through `/api/tiles`, which caches them in `data/tiles/`.
- **Cost meter**: `src/config/pricing.ts` holds the OpenAI prices, the USD → PKR rate and the "foreign platform" comparison. **The comparison figure and the exchange rate are assumptions**; set them to numbers you can defend before presenting.

## API

```
POST /api/realtime/session
GET|POST /api/tickets        GET|PATCH /api/tickets/{ticketNo}     POST /api/tickets/{ticketNo}/notes
GET  /api/tickets/status?ticketNo=|phone=
GET  /api/incidents          GET /api/areas[?lat=&lng=]            GET /api/departments
POST /api/calls              POST /api/calls/{id}/events           PATCH /api/calls/{id}
GET  /api/analytics/summary  GET /api/stream (SSE)                 GET /api/bootstrap
GET  /api/events (long-poll twin of /api/stream)
GET|PUT /api/settings        POST /api/demo/reset                  POST /api/demo/simulate
```

Create a ticket by hand (a pin drops on every open Command Center):

```bash
curl -X POST http://localhost:3000/api/tickets -H "Content-Type: application/json"   -d '{"caller_name":"Test","phone":"03001234567","area":"Saddar","category":"garbage","description_en":"Garbage in Saddar","mood":3}'
```

`description_ur` is optional here (it falls back to the English text). Urdu typed on a Windows command line is often mangled by the console, so send it from a file or a tool that speaks UTF-8.

## Notes and known limits

- This is a prototype: there is no login, and the officer app trusts whichever department is picked.
- "Cantt" and "Peshawar Cantonment" are one area with both names as aliases, so the seed has 24 areas.
- Area coordinates are approximate centres. Without GPS, a ticket's pin is placed near the centre of its area.
- If the schema in `src/db/schema.ts` changes, delete `data/faryad.db*` and restart.
- Map tiles are fetched from OpenStreetMap's public servers and cached; keep usage light and keep the attribution visible.
- OpenAI's docs list `gpt-4o-mini-tts` for shutdown on 6 January 2027. `OPENAI_TTS_MODEL` lets you switch.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Top bar says "AI key not set" | `OPENAI_API_KEY` is missing from `.env.local`, or the server was not restarted |
| Phone shows "Open this page from the QR code (https)" | The phone opened an http address. Use the tunnel URL |
| Phone shows "Microphone permission was not given" | Tap the lock icon in the address bar → allow microphone → retry |
| QR code points at localhost | Run `npm run tunnel` or set Settings → Public URL |
| Third Gulbahar call raises no incident | The seeded tickets are older than two hours. Reset demo data |
| Map has dark gaps | Tiles were unreachable. Run `npm run tiles` on a good connection |
| The app starts on port 3001 | Something is still using port 3000 (often an earlier server). Close it; the tunnel and QR codes expect 3000 |
| Phone page is very slow to open | You are running `npm run dev`. Use `npm run demo` |
