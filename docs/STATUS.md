# Faryad build status

Resume point if a session is interrupted. Spec: the build brief pasted on 20 Nov 2026 (milestones 1-7).

## State on 20 Nov 2026 (evening)

All seven milestones are built. Repo: https://github.com/alitheworkingGUY/faryad (private), branch `main`.

Verified on this machine:

- `npx tsc --noEmit` clean, ESLint 0 errors (12 warnings, all `react-hooks/set-state-in-effect`, explained in `eslint.config.mjs`), `npm run build` succeeds.
- `npm run test:call` passes 18/18 against localhost (SSE) and through a Cloudflare quick tunnel (long-poll). It uses a stand-in WebRTC peer for OpenAI, so it covers our whole call flow but not OpenAI itself.
- Command Center, Tickets, Incidents, Analytics, Settings, Officer and Call pages screenshotted at their target sizes with no console errors.

NOT verified, because no `OPENAI_API_KEY` was available on this machine:

- A real Realtime call (session minting at `/v1/realtime/client_secrets`, the WebRTC handshake with OpenAI, Urdu speech quality, barge-in).
- The Urdu voice note (`/v1/audio/speech`).
- AI incident summaries and live field extraction by the text model (the keyword pass and the template summary were verified).

First thing to do once the key is in `.env.local`: restart, open `/call`, make one call. If session minting returns HTTP 400, the server logs the reason and retries with a smaller session config (see `src/app/api/realtime/session/route.ts`).

## Decisions made

- One Next.js 16 app (App Router, TypeScript, Tailwind v4, shadcn/ui on Base UI). `cacheComponents` is off: every screen is live data.
- SQLite `data/faryad.db` via Drizzle + better-sqlite3. Tables come from `SCHEMA_SQL` in `src/db/schema.ts`; demo data auto-seeds when the DB is empty. If the schema changes, delete `data/faryad.db*`.
- "Cantt" and "Peshawar Cantonment" are one area (aliases): 24 areas.
- The two seeded Gulbahar "no water" tickets are 14 and 5 minutes old at reset, so the 2-hour incident window stays open about 1 h 45 min after a reset.
- Live updates: in-process bus (`src/server/bus.ts`). SSE at `/api/stream`; long-poll at `/api/events` because Cloudflare quick tunnels buffer SSE (measured: zero bytes in 40 s). The browser picks automatically (`src/lib/store.ts`).
- Demo must run the production build (`npm run demo`). In dev mode the phone page took 164 s to become interactive through the tunnel on a slow uplink; in production 3-14 s.
- Voice: browser <-> OpenAI Realtime over WebRTC with an ephemeral secret. Tools run in the browser against our REST API.
- Live "extracted details" come from the server (keyword pass, then a small text model), so the voice loop is never slowed.
- Voice notes are saved in `public/audio/` and served through `/api/audio/[file]`.
- Map: OpenStreetMap raster tiles darkened in the MapLibre style (CARTO's dark tiles now need an API key). Tiles go through the caching proxy `/api/tiles` into `data/tiles/` (978 tiles for zoom 9-15 are cached on this machine).
- MapLibre v6 worker is copied to `public/maplibre/` by `scripts/copy-map-worker.mjs` (runs before dev and build).
- Urdu font: the stack uses the real Inter and Noto Nastaliq Urdu faces only. next/font's "Inter Fallback" is local Arial, which has Arabic glyphs and was hijacking Urdu text.
- `public base URL` is a runtime setting (Settings page, or `npm run tunnel` sets it), not only an env var.
- Cost meter config is in `src/config/pricing.ts`. `USD_TO_PKR = 280` and `FOREIGN_PLATFORM_USD_PER_MIN = 0.35` are assumptions to be replaced with defensible numbers.
- cloudflared: winget failed on this network, so the binary sits in `tools/cloudflared.exe` (git-ignored); `npm run tunnel` finds it there.

## Gotchas met

- Turbopack sometimes missed a rewrite of `globals.css` on Windows; touching the file again fixed it.
- Headless Chrome's `--virtual-time-budget` hangs on pages with an open SSE connection; use `scripts/shot.mjs` (Playwright, installed Chrome).
- Node's own `fetch` to `*.trycloudflare.com` timed out connecting on this network while curl and Chrome worked.
