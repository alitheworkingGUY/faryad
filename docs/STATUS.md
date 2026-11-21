# Faryad build status

Resume point if a session is interrupted. Spec: the build brief pasted on 20 Nov 2026 (milestones 1-7).

## State on 20 Nov 2026 (evening)

All seven milestones are built. Repo: https://github.com/alitheworkingGUY/faryad (private), branch `main`.

Verified on this machine:

- `npx tsc --noEmit` clean, ESLint 0 errors (12 warnings, all `react-hooks/set-state-in-effect`, explained in `eslint.config.mjs`), `npm run build` succeeds.
- `npm run test:call` passes 18/18 against localhost (SSE) and through a Cloudflare quick tunnel (long-poll). It uses a stand-in WebRTC peer for OpenAI, so it covers our whole call flow but not OpenAI itself.
- Command Center, Tickets, Incidents, Analytics, Settings, Officer and Call pages screenshotted at their target sizes with no console errors.

Verified with the real OpenAI key (added to `.env.local` late on 20 Nov 2026):

- `npm run test:real-call`: a real Realtime call with a scripted Urdu caller passed 13/13. The agent greeted in Urdu, transcribed the caller, called `create_ticket` with the right fields, read the ticket number digit by digit, and stopped when spoken over. A 117 s call cost USD 0.114 (PKR 32); an 86 s call cost USD 0.042.
- OpenAI accepted the full session config (no fallback needed). Event names and the usage shape match what the client code expects.
- Urdu voice note: generated ahead of time, attached 26-280 ms after resolve, autoplays on the citizen page.
- AI incident summary (English + Urdu) and live field extraction with `gpt-4.1`.

Still not done by anyone: a call from a physical phone through the tunnel (microphone permission prompt, speaker audio, real Urdu speech). Do this once before the demo.

## Decisions made

- One Next.js 16 app (App Router, TypeScript, Tailwind v4, shadcn/ui on Base UI). `cacheComponents` is off: every screen is live data.
- SQLite `data/faryad.db` via Drizzle + better-sqlite3. Tables come from `SCHEMA_SQL` in `src/db/schema.ts`; demo data auto-seeds when the DB is empty. If the schema changes, delete `data/faryad.db*`.
- "Cantt" and "Peshawar Cantonment" are one area (aliases): 24 areas.
- The two seeded Gulbahar "no water" tickets are 14 and 5 minutes old at reset, so the 2-hour incident window stays open about 1 h 45 min after a reset.
- Live updates: in-process bus (`src/server/bus.ts`). SSE at `/api/stream`; long-poll at `/api/events` because Cloudflare quick tunnels buffer SSE (measured: zero bytes in 40 s). The browser picks automatically (`src/lib/store.ts`).
- Demo must run the production build (`npm run demo`). In dev mode the phone page took 164 s to become interactive through the tunnel on a slow uplink; in production 3-14 s.
- Voice: browser <-> OpenAI Realtime over WebRTC with an ephemeral secret. Tools run in the browser against our REST API.
- Live "extracted details" come from the server (keyword pass, then a small text model), so the voice loop is never slowed.
- Voice notes are saved in `public/audio/` and served through `/api/audio/[file]`. They are prepared in the background on ticket creation / pickup (`prepareVoiceNote` in `src/server/tickets.ts`), because synthesis takes 4-6 s.
- The agent is told the GPS status by a system note at call start. Left to call `set_location_from_gps` itself it skipped the tool and claimed a location it never had.
- The session secret is fetched when `/call` opens (`prewarm`), so the tap only opens the mic and WebRTC.
- Server calls to OpenAI go through `resilientPost` (`src/server/openai.ts`): per-try timeout, retries, and a parallel second try when the first is slow. This network dropped new connections to OpenAI intermittently (10 s connect timeouts).
- `OPENAI_SUMMARY_MODEL` (the user's name for it) selects the text model; `OPENAI_TEXT_MODEL` still works.
- Map: OpenStreetMap raster tiles darkened in the MapLibre style (CARTO's dark tiles now need an API key). Tiles go through the caching proxy `/api/tiles` into `data/tiles/` (978 tiles for zoom 9-15 are cached on this machine).
- MapLibre v6 worker is copied to `public/maplibre/` by `scripts/copy-map-worker.mjs` (runs before dev and build).
- Urdu font: the stack uses the real Inter and Noto Nastaliq Urdu faces only. next/font's "Inter Fallback" is local Arial, which has Arabic glyphs and was hijacking Urdu text.
- `public base URL` is a runtime setting (Settings page, or `npm run tunnel` sets it), not only an env var.
- Cost meter config is in `src/config/pricing.ts`. `USD_TO_PKR = 280` and `FOREIGN_PLATFORM_USD_PER_MIN = 0.35` are assumptions to be replaced with defensible numbers.
- cloudflared: winget failed on this network, so the binary sits in `tools/cloudflared.exe` (git-ignored); `npm run tunnel` finds it there.

## Gotchas met

- Turbopack sometimes missed a rewrite of `globals.css` on Windows; touching the file again fixed it.
- Headless Chrome's `--virtual-time-budget` hangs on pages with an open SSE connection; use `scripts/shot.mjs` (Playwright, installed Chrome).
- Node's own `fetch` to `*.trycloudflare.com` and to `api.openai.com` intermittently timed out connecting on this network while curl and Chrome worked.
- On this network, tap-to-live took 9-11 s (session + SDP exchange with OpenAI). Expect 1-3 s on a healthy connection.

## Submission (KP AI Impact Challenge 2026), 21 Nov 2026

- Zip built with `git archive` from `main`: `~/Downloads/faryad-submission/Faryad-MVP.zip` (0.29 MB). Needs renaming to `[Application_Ref]_[Team_Name].zip`.
- Clean-folder check passed: extract, `npm install`, `npm run build`, run with no API key. First run seeds the database, the scripted call raises the incident, all pages return 200, no console errors.
- `.npmrc` has `ignore-scripts=true` on purpose. Installing from `package-lock.json` makes npm compile better-sqlite3 from source (npm drops the package's `gypfile: false` when it reads the lockfile), which fails on Windows without Visual Studio build tools. The package ships prebuilt binaries, so no compile is needed. Because pre/post npm hooks are skipped too, the MapLibre worker copy runs inside the `dev` and `build` commands.
- `scripts/tunnel.mjs` now requests the quick tunnel itself (cloudflared's own request timed out when Cloudflare took ~7 s to answer), publishes the URL only once connected, and replaces a tunnel Cloudflare has deleted. One tunnel lasted 3 h 15 min and died when the laptop's network dropped for about a minute.
