# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

**Nightshift** — SOC Tier 1 training simulator. React SPA + Express + SQLite, single-port. Runs entirely locally with no Azure subscription or licence required.

The product lives at the intersection of three ideas:

1. A working **KQL engine** in the browser, with frozen time so scenarios reproduce.
2. **35 hand-authored incidents** across Microsoft Sentinel, Defender, Azure Firewall, and friends — vague titles, real raw logs, no answer key.
3. A **24/7-SOC environment** — Sentinel + Rapid7 InsightIDR + ELK panels, EDR summary tab, MITRE detail dialogs, category runbooks, and SOC ticket export.

## Commands

```bash
npm run dev        # Dev server with hot reload at http://localhost:5000
npm run build      # Build client (Vite → dist/public/) and server (esbuild → dist/index.cjs)
npm run start      # Run production build
npm run check      # TypeScript type-check across client/, shared/, server/
npm run db:push    # Push Drizzle schema changes to SQLite (data.db)
```

No test suite is configured. Use `npm run check` for type safety verification.

## Architecture

Full-stack TypeScript app. Dev uses Vite middleware on the same Express server; prod serves static files from `dist/public/`. Shared types live in `shared/schema.ts`.

**Key architectural choices**

- **Client-side KQL engine** — `client/src/lib/kql/` (tokeniser → parser → evaluator, ~600 LOC) runs entirely in the browser against in-memory log tables fetched from `/api/logs/:tableName`. No server-side query parsing.
- **Frozen time** — All `now()` / `ago()` resolve to `2026-05-13T12:00:00Z` for reproducible scenarios.
- **SQLite via Drizzle** — Schema in `shared/schema.ts`, storage CRUD in `server/storage.ts`. Tables bootstrapped at runtime (no migrations folder).
- **Path aliases** — `@/*` → `client/src/`, `@shared/*` → `shared/`.
- **Hash routing** — Wouter, eight routes: Briefing, Queue, AlertDetail, Learn, Mentor, Dashboard, Settings, NotFound.

**Data flow for alert triage**

1. `client/src/data/alerts.json` — 35 static alert definitions (goals, hints, correct verdicts, category, MITRE).
2. `/api/logs/:tableName` — serves raw JSON log tables from `server/data/logs/*.json` (~8 500 events across 10 tables).
3. KQL evaluator runs queries client-side against fetched table data.
4. Triage verdicts/notes POST to `/api/triage/:alertId` → stored in SQLite.

## Tool stack abstraction

The lab can be re-skinned for different SOC tool stacks via `client/src/data/toolStacks.json`. The active stack governs labels and which tool panels are wired up.

- **`nightshift-default`** (only fully-wired stack): Microsoft Sentinel + Rapid7 InsightIDR + ELK + Defender for Endpoint + Azure Firewall IDPS + ServiceNow.
- **`splunk-crowdstrike`** (preview): Splunk + CrowdStrike Falcon — panels show "Coming soon" overlay.

Stack selection persists to `localStorage` (`active_tool_stack`) and to SQLite via `/api/tool-stack`.

## New components / data introduced in v2 (vs base lab)

- `client/src/components/{RunbookPanel,Rapid7Panel,ElkPanel,MitreDetailDialog}.tsx`
- `client/src/data/{runbooks,mitre_map,rapid7_responses,elk_responses,toolStacks}.json`
- `client/src/lib/{exportIncident,toolStack}.ts`
- `server/data/logs/{DeviceAlertEvents,EmailEvents}.json` — coherent attack chain for INC-2026-0531..0534
- Five new alert scenarios in `client/src/data/alerts.json` (INC-2026-0531..0535)
- DB tables `incidentReports`, `toolStackPreference`
- API routes `/api/incident-reports`, `/api/tool-stack`

## Environment

Copy `.env.example` to `.env`. Only `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are needed (both optional, can also be set via Settings UI). `PORT` defaults to 5000.

## Regenerating bundled data

The `script/` folder has re-runnable generators for everything bundled:

```bash
node script/tag-alerts.mjs                # category + mitreId on alerts.json
node script/append-nightshift-alerts.mjs  # adds INC-2026-0531..0535 if missing
node script/gen-nightshift-logs.mjs       # DeviceAlertEvents.json + EmailEvents.json
node script/gen-tool-responses.mjs        # rapid7_responses.json + elk_responses.json
```

Each is idempotent.

## What not to touch

- `client/src/lib/kql/` — the engine is correct; extending it requires care with the tokeniser/parser/evaluator pipeline.
- Morgan Reyes' personality, hint logic, or voice handling — they're the trained mentor and the personality is intentional.
- The existing 30 alerts' triage logic — only additive changes (new alerts, new tags) are safe.
