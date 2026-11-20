# Faryad build status

Resume point if a session is interrupted. Spec: the build brief pasted on 20 Nov 2026 (milestones 1-7).

## Decisions made

- One Next.js 16 app (App Router, TypeScript, Tailwind v4, shadcn/ui on Base UI), `npm run dev` only.
- `cacheComponents` is off in `next.config.ts`: every screen is live data.
- SQLite file `data/faryad.db` via Drizzle + better-sqlite3. Tables are created from `SCHEMA_SQL` in `src/db/schema.ts` on first open, and the demo data is auto-seeded when the DB is empty. If the schema changes, delete `data/faryad.db*`.
- "Cantt" and "Peshawar Cantonment" are one area (aliases), so the seed has 24 areas.
- Live updates: in-process bus (`src/server/bus.ts`) behind `GET /api/stream` (SSE).
- Voice: browser <-> OpenAI Realtime over WebRTC with an ephemeral secret from `POST /api/realtime/session` (`/v1/realtime/client_secrets` then `/v1/realtime/calls`). Tools run in the browser against our REST API.
- Live "extracted details" on the Command Center come from the server: keyword pass first, then a small text model, so the voice loop is never slowed down.
- Voice notes are saved in `public/audio/` and served through `/api/audio/[file]`.
- `POST /api/demo/simulate` plays a scripted call through the real pipeline (stage fallback).
- Cost meter prices and the "foreign platform" comparison live in `src/config/pricing.ts`. The comparison figure is an assumption, not a quote.

## Milestones

- [x] 1a. Scaffold, deps, design tokens, DB schema + seed
- [x] 2a. Server logic + all API routes (type-check clean)
- [ ] 1b. Layout shell + Command Center (map, pins, feed, counters)
- [ ] 2b. SSE wired into the Command Center (live pin drop)
- [ ] 3. /call page with Realtime voice (needs OPENAI_API_KEY in .env.local)
- [ ] 4. Officer app + resolve -> Urdu voice note on citizen page
- [ ] 5. GPS share, incident clustering UI, cost meter, human-needed alert
- [ ] 6. Tickets page + drawer + mark place, Incidents, Settings
- [ ] 7. Analytics + polish pass
- [ ] README + demo-day checklist

## Open items

- OPENAI_API_KEY is not set on this machine yet, so the voice call, TTS and AI summaries are untested against the real API.
- cloudflared is not installed yet.
