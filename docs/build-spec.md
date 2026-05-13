# Build Spec V2 — Sentinel SOC Tier 1 Lab (Realistic Desk Simulation)

## Mission
Build a SOC Tier 1 training simulator that works like a real shift: vague alert names, raw log tables, write KQL to find the answer. **Replaces** the previous lab at the same deployment slug.

## Source files (use verbatim)
- `/home/user/workspace/sentinel-lab-v2/alerts_v2.json` — 30 alerts with vague titles + linked tables + investigation goals + hunter hints
- `/home/user/workspace/sentinel-lab-v2/logs/` — 8 JSON files containing ~8,000 realistic log events with embedded attack chain
- `/home/user/workspace/sentinel-lab-v2/kql_tutorial.json` — 4-lesson KQL tutorial
- `/home/user/workspace/sentinel-lab-v2/kql_engine_spec.md` — KQL engine specification (read this carefully, you must implement the engine)
- `/home/user/workspace/sentinel-lab-spec/mentor.json` — Morgan Reyes persona/scripts (reuse from v1, extend with KQL coaching)

Copy all into `client/src/data/` and `server/data/` as appropriate. Logs should be served by an Express endpoint `/api/logs/:tableName`.

## Tech
- Webapp template at `skills/website-building/webapp/template/`.
- Project: `/home/user/workspace/sentinel-soc-lab-v2`.
- Same stack: React + Vite + Express + Tailwind + shadcn/ui + Drizzle/SQLite + Wouter + Recharts.
- Editor: **CodeMirror 6** for KQL console (better than Monaco for our scale; supports custom languages cleanly).

## The frozen time
The dataset's "now" is **2026-05-13T12:00:00Z**. All `ago()`, `now()`, and relative time functions in the KQL engine must use this as the reference, NOT real wall-clock time. Expose it as a constant.

## KQL engine (the critical component)
Implement per `kql_engine_spec.md`. ~600 LOC client-side TypeScript in `client/src/lib/kql/`.

**Must handle all queries shown in:**
- Each alert's `starterQuery` (30 queries)
- Each alert's `hunterHints` example queries
- Each KQL tutorial lesson's expected queries
- The 5 explicit test queries at the bottom of `kql_engine_spec.md`

Before writing other UI, write the engine and unit-test it with a small Node script running those queries against the loaded JSON tables. Verify results look correct (e.g. the spray query should return one row with Users=247, Successes=3).

## Visual design
Same Sentinel dark console aesthetic as v1 but tighter:
- Background `#0b1220` (very dark slate), surface `#111a2e`, border `#1f2a44`.
- Accent cyan `190 95% 50%`. Severity colours: Critical red, High orange, Medium amber, Low sky.
- JetBrains Mono for all KQL, log table cells, IPs, hashes, command lines.
- Inter for UI chrome.
- KQL editor: dark theme, gutter line numbers, syntax highlight (keywords cyan, strings green, operators amber, comments dim grey).

## Pages

### `/` — Briefing
- Morgan onboarding (reuse v1 lines but add a new bit about the desk: 'This time, I'm not going to give you the answer. The alert tells you something is interesting. Your job is to dig.')
- New CTA: "Start KQL Tutorial" (suggested first if user has no progress) OR "Open Alert Queue" if they've done at least Lesson 1.

### `/learn` — KQL Tutorial
- Linear lesson player. One lesson per screen, sections rendered as markdown.
- Embedded KQL console at the bottom of each lesson with the exercise prompt above.
- "Check my answer" button runs the user's query, validates against `validator.mustContain` (case-insensitive token check) and `validator.mustReturnRows`. Shows ✓ or ✗ with hint on failure.
- Progress bar across lessons. Persist completion in SQLite.
- Morgan dialogue at intro and after each completion.

### `/queue` — Alert Queue
- Same as v1 but uses v2 alerts. Show vague `ruleName`, not the v1 plain-English title.
- Column for "Open"/"Triaged-Correct"/"Triaged-Incorrect".
- Quick-filter chip "Recommended order" sorts by complexity: easier alerts first (single-table investigations before multi-table).

### `/alert/:id` — Alert Detail (3-pane layout)
**Left pane (40%):** Alert summary
- Rule name + severity + product + displayedAt
- Rule description (vague — no spoilers)
- Entities (chips)
- MITRE chips
- **Investigation Goals** — 4 bullet points from `investigationGoals`. These are the QUESTIONS the analyst must answer.
- "Ask Morgan for a hint" button (counts as a hint used — track in DB).
- "AI Explain this alert" button (only available AFTER triage submitted, to discourage cheating).

**Middle pane (35%):** KQL Console
- CodeMirror 6 editor, dark theme, KQL syntax.
- Pre-filled with `starterQuery`.
- "Run" button + Ctrl+Enter.
- Below the editor: results table. Sortable. Virtual-scroll for >100 rows. Footer with execution time and total rows.
- "Save to notebook" button.
- Tabs above editor: "Editor" | "Schema" — Schema tab lists the columns available in tables related to this alert with a 1-line description for each (hard-code these descriptions in `client/src/data/tableSchemas.ts`).
- Each cell in the results table is clickable — opens a "Pivot on this value" mini-menu offering pre-filled queries against related tables (e.g. clicking an IP shows "Find this IP in DeviceNetworkEvents", "Find this IP in AzureActivity", "Check ThreatIntelligenceIndicator").

**Right pane (25%):** Triage panel + Notebook tabs
- Tab 1: Notebook (scratchpad — text area + list of saved queries from "Save to notebook")
- Tab 2: Triage
  - Verdict radio
  - Action checklist (correctActions + redHerrings shuffled)
  - Notes textarea
  - Submit button (disabled until verdict picked)

After triage submit: replace triage panel with feedback card (same as v1 — correct/partial/wrong + playbookReason + Morgan dialogue).

### `/mentor` — Mentor Chat
Same as v1, plus new starter intents:
- "I don't know where to start with this alert" → Morgan suggests an opening query
- "Help me write a KQL query for X"
- "Explain this query" (with textarea)
- "What does this column mean?" (asks for table + column)

### `/dashboard` — SOC Dashboard
All v1 charts plus:
- **Hints used** KPI (lower is better)
- **Average queries per alert** (engagement metric)
- **KQL tutorial progress** card

### `/settings` — Settings
Same as v1.

## Server endpoints (additions over v1)
- `GET /api/logs/:tableName` — return rows (cache server-side, read JSON files once at startup).
- `POST /api/kql/run` — DEPRECATED, query runs client-side. Skip.
- `GET /api/tutorial/progress` / `POST /api/tutorial/progress` — track completed lessons.
- `POST /api/triage/hint` — increment hint count for an alert (called when user clicks "Ask Morgan for a hint" or "AI Explain" before submission).
- `GET /api/notebook/:alertId` / `POST /api/notebook/:alertId` — save/load notebook notes + saved queries.

## Schema additions
```sql
tutorialProgress (id text primary key, lessonId text, completedAt integer)
hintUsage (alertId text primary key, hintCount integer)
notebooks (alertId text primary key, notes text, savedQueries text /* JSON array of {label, query} */)
queryHistory (id integer primary key autoincrement, alertId text, query text, runAt integer, resultRows integer)
```

## Morgan dialogue additions
Add to the mentor scripts:
- `kql_intro`: lines for when tutorial starts ("Right. KQL. People panic about this. They shouldn't. By the end of these four lessons, you'll be writing the queries that catch real attackers. We'll go one operator at a time.")
- `kql_lesson_complete`: per-lesson completion messages.
- `hint_first_alert`: ("Look at the rule description. Then look at the entities. The first question is always: what do I know already, and what do I need to find out?")
- `hint_lost_in_logs`: when user has run >5 queries without submitting ("Take a breath. Re-read the investigation goals. You're hunting for specific answers, not browsing.")
- `praise_no_hints`: when user submits correct triage without using any hints ("That's the real thing. No hints, correct call. Tier 2 in waiting.")

Generate these — extend `mentor.json` with sensible Morgan-voiced lines.

## QA before deploy (Playwright at 1280x800)
1. Open `/` — briefing renders, Morgan bubbles appear.
2. Open `/learn` — start Lesson 1, complete the exercise (`DeviceProcessEvents | take 5`), advance.
3. Open `/queue` — see 30 alerts with vague names.
4. Open `INC-2026-0501` (password spray). Run the starter query — confirm 50 rows returned. Modify to the summarize query from the hint — confirm one row with Users=247, Failures>1800, Successes=3. Submit verdict TP + correct actions. Confirm feedback.
5. Open `INC-2026-0506` (Office spawned PS). Run starter, see ~2 rows for j.harrington's Office children. Pivot via clicking the host name → confirm pivot menu works.
6. Open `/dashboard` — confirm KPIs and charts render.

Take screenshots, evaluate visually, fix any text overflow / broken layouts.

## Deploy
1. `npm run build`
2. start_server (`NODE_ENV=production node dist/index.cjs`, port 5000, project_path)
3. `deploy_website(project_path="/home/user/workspace/sentinel-soc-lab-v2/dist/public", site_name="sentinel-soc-tier1-lab", entry_point="index.html")` — **use the same site_name as v1 to replace it.**

Return the final deployed URL.

## Out of scope
- Real authentication
- Multi-tenant
- Real Azure connectivity
- Anything beyond the listed routes/features

## Critical reminders
- The KQL engine is the heart of this. Build and test it FIRST before any UI work.
- Server reads JSON log files at startup, never per-request.
- Frozen time: 2026-05-13T12:00:00Z everywhere relative time is computed.
- Persist to SQLite, NEVER localStorage.
- Re-use Morgan persona from v1 but extend with KQL coaching lines.
