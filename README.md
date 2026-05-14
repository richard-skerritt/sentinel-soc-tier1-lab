<div align="center">

<img src="docs/screenshots/08-alert-detail.png" alt="Nightshift — SOC Tier 1 training simulator showing KQL editor, runbook, MITRE detail and triage panel" width="100%" />

# Nightshift

**SOC Tier 1 training for the 24/7 shift.**

A realistic desk simulator for entry-level SOC analysts. Vague alerts across Sentinel, Rapid7, ELK and EDR. Ten raw log tables with a real attack chain hidden inside. Category runbooks, MITRE ATT&CK detail, a working KQL engine, and a senior mentor who will not give you the answer.

[Why](#why-this-exists) · [What you do](#what-you-actually-do) · [Features](#features) · [Tool stack](#tool-stack) · [Screenshots](#screenshots) · [Getting started](#getting-started) · [Structure](#project-structure) · [Disclaimer](#disclaimer)

</div>

---

## Why this exists

Most SOC training tools tell you what's happening. The alert says **"Password Spray Detected"** and you click *True Positive*. That is not what a real shift feels like.

In a real Tier 1 seat the alert says something flat like **"Multiple authentication failures - single source IP"**. The product fired a rule, that's all. Whether it's a spray, a misconfigured printer, a forgotten service account or a noisy VPN is for **you** to work out by reading logs.

Nightshift rebuilds that experience locally — no Azure subscription, no licence, no cost — so you can practise the actual habits a junior analyst is paid for:

- Read a vague alert and decide what question to ask
- Write KQL against real log tables to answer that question
- Pivot from one entity (IP, user, host) to another to trace an attack chain
- Triage the alert with a verdict, an action list and notes another analyst could read
- Pivot between **Sentinel**, **Rapid7 InsightIDR** and **ELK** to see how the same attack looks in different tools
- Walk a step-by-step **runbook** when you don't know what to do next

## What you actually do

Every alert in the queue follows the same loop:

1. **Open the alert.** You get the rule name, a one-line description, an entity or two and a MITRE technique. That's it. No answer key.
2. **Read the investigation goals.** Four plain-English questions you have to answer before you can call this thing.
3. **Open the logs.** Ten live tables: `SigninLogs`, `DeviceProcessEvents`, `DeviceNetworkEvents`, `DeviceAlertEvents`, `OfficeActivity`, `EmailEvents`, `AzureActivity`, `AzureFirewallNetworkRule`, `SysmonEvent`, `ThreatIntelligenceIndicator`. ~8 500 events with two real attack chains hidden inside.
4. **Write KQL.** Real operators — `where`, `project`, `summarize`, `count`, `extend`, `take`, `sort`, `join`, `bin`, `ago`, `has`, `contains`. The engine returns real result tables in milliseconds.
5. **Pivot.** Found a suspicious IP? Click it to query every table that mentions it. Found a host? Same. Follow the chain until you can tell the story.
6. **Cross-check in another tool.** Tab over to Rapid7 InsightIDR or ELK Stack and see the same event in their format. ECS vs Microsoft fields — a Tier 1 skill that doesn't get taught in books.
7. **Open the runbook.** Step-by-step playbook tailored to the alert's category (authentication, malware, phishing, network, lateral-movement, privilege-escalation). Each step has a KQL query you can copy and a Yes/No decision branch.
8. **Triage and export.** Pick a verdict, tick the correct response actions, leave notes. Then click **Export Report** to generate a SOC-ticket-formatted Markdown handoff for Tier 2.

If you get stuck, you can ask Morgan — the senior mentor — for a hint. Each hint is counted. The dashboard shows your hint usage so you can tell whether you're improving or just leaning harder on help.

## The mentor

The lab ships with a fictional Tier 3 shift lead called **Morgan Reyes**. Twelve years in SOC and IR, calm, direct, the kind of senior who has seen junior analysts panic on day one and is fine with that.

Morgan's rule:

> "I'm not going to give you the answer. I'm going to ask you the question I'd ask myself. If you're stuck on what to ask, ask me."

Morgan appears in five places — shift briefing, mentor chat, alert hints, post-triage feedback, and tutorial coaching. If you supply an **ElevenLabs API key + voice ID** in Settings, Morgan's lines play as audio. Without those, the lab is text-only — fully functional, just quieter.

## Features

### A working KQL engine

Not a fake regex matcher. A tokeniser → parser → evaluator that runs against the bundled log tables and returns a typed result set.

| Supported | Examples |
|---|---|
| Tabular operators | `where`, `project`, `summarize`, `count`, `extend`, `take`, `sort` / `order by`, `join`, `distinct` |
| Aggregations | `count()`, `countif()`, `dcount()`, `sum()`, `avg()`, `min()`, `max()`, `make_set()`, `make_list()` |
| String functions | `contains`, `has`, `startswith`, `endswith`, `matches regex`, `tolower`, `toupper`, `strlen`, `split` |
| Time functions | `ago()`, `now()`, `bin()`, `datetime()` (anchored to `2026-05-13T12:00:00Z` for reproducibility) |
| Operators | `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `!in`, `and`, `or`, `not`, `between` |
| UX | CodeMirror 6 editor with KQL syntax highlighting, schema-on-tab, result table with sortable columns, run time and row count |

The full KQL spec lives in [`docs/kql-engine-spec.md`](docs/kql-engine-spec.md).

### 35 incidents across Microsoft + multi-tool

Balanced across **Azure AD Identity Protection**, **Microsoft Defender for Endpoint**, **Microsoft 365 Defender**, **Microsoft Defender for Cloud**, **Microsoft Defender for Office 365**, **Microsoft Entra ID**, **Azure Firewall** and **Sysmon**. Severity mix: 5 Critical · 14 High · 15 Medium · 1 Low. Every incident has:

- A deliberately vague title and product-realistic description
- Tagged entities (IP, user, host, file, URL, etc.) you can pivot on
- A MITRE ATT&CK technique with full detail dialog (tactic, indicators, kill-chain next step)
- A runbook category that maps to a step-by-step playbook
- Four investigation goals you can use as a checklist
- A ground-truth verdict, correct action list and Tier 3 reasoning hidden behind the triage submit

Hidden inside the queue are **two end-to-end attack chains** — Microsoft's reference scenario (impossible travel → password spray → MFA fatigue → Office-to-PowerShell → LSASS dump → persistence → exfil → shadow-copy delete) plus a second 24/7-SOC chain (BEC via Tor → OAuth token theft → privileged role assignment → encoded PowerShell → port-scan recon → ransomware shadow-copy delete). Both are seeded — same chain every time — so they work as teaching artefacts.

### Multi-tool perspective (Sentinel + Rapid7 + ELK + EDR)

Each alert workspace has a four-tab tool selector. The data is scripted but realistic — the same attack rendered in each tool's native format:

- **KQL (Sentinel)** — the primary investigation surface. CodeMirror editor + result grid.
- **Rapid7 InsightIDR** — log search with `key=value` syntax, plus an Asset tab showing host risk score and vuln count.
- **ELK Stack** — Kibana-style Discover view with ECS field names (`event.category`, `source.ip`, `user.name`, `event.outcome`).
- **EDR / Defender** — device summary card per alert.

The point is to build the intuition every Tier 1 needs: the same attack looks different in different tools, and you need to recognise it across all of them.

### Category runbooks

Six step-by-step runbooks — one per category — sit in a collapsible right rail on every alert. Each step has:

- An action sentence
- The KQL (or InsightIDR / ELK / EDR query) you need to run, with one-click Copy
- The expected result
- A green/amber Yes/No decision branch telling you where to go next

Progress is tracked per-alert in `localStorage`. The runbook for an alert is keyed off its `category` field — change it and the rail updates.

### MITRE ATT&CK detail dialog

Click any MITRE badge on an alert to open a deep-dive dialog:

- Tactic + technique name + ID
- What the attacker is doing (plain English, not vendor copy)
- Why it matters
- Common indicators
- Detection queries in three syntaxes (Sentinel KQL, Rapid7, ELK Lucene)
- What comes next in the kill chain
- How this differs from similar techniques

36 techniques covered — every ID present in the alert queue has a full entry.

### Incident report export

After submitting triage, click **Export Report (.md)** to download a SOC-ticket-formatted Markdown file:

```
INCIDENT REPORT
===============
Incident ID:   INC-...-1747237448000
Analyst:       SOC Analyst T1
Date/Time:     ...
Severity:      Critical
Status:        True Positive

ALERT DETAILS
-------------
Rule Name:     Ransomware precursor: Volume shadow copies deleted
...

QUERIES EXECUTED
----------------
  1. [timestamp] (12 rows)
     DeviceProcessEvents | where ...

VERDICT
-------
True Positive
Confidence: 95%
...
```

The report is also copied to the clipboard and persisted server-side to `/api/incident-reports`.

### Tool stack switcher

Settings has a tool-stack dropdown. The default is the Nightshift stack (Sentinel + Rapid7 + ELK + Defender, fully wired). A second `Splunk + CrowdStrike` stack ships as a preview — selecting it relabels the panels and shows a Coming-soon overlay on the third-party tabs. The architecture is designed so you can add more stacks by editing `client/src/data/toolStacks.json`.

### KQL tutorial track

Four short lessons that take roughly 45 minutes total. You can do them in order or skip ahead.

| Lesson | What you'll learn |
|---|---|
| 1 — The basics | Tables, pipes, the four-line shape of every KQL query |
| 2 — The four operators you'll use every shift | `where`, `project`, `summarize`, `count` — ≈ 80 % of all real SOC queries |
| 3 — Pivoting between entities | Following an IP into `SigninLogs`, then `DeviceProcessEvents`, then `OfficeActivity` |
| 4 — Hunting patterns | Password spray, beacon detection, impossible travel, mass deletion bucketing |

Every lesson has runnable examples that work against the lab's log tables.

### Triage, dashboard and hunt notebook

- **Three-pane alert workspace + runbook rail.** Alert summary on the left, tool tabs (Sentinel/Rapid7/ELK/EDR) in the middle, triage / notebook on the right, runbook rail beyond that.
- **Hunt notebook.** Scratchpad per alert. Save queries, paste findings, link entities. Survives reloads (SQLite-backed).
- **Dashboard.** Triages, accuracy %, incorrect count, hints used, queries-per-alert, tutorial progress, alerts-by-severity / -by-product, triage outcomes.
- **Frozen time.** Every `now()` / `ago()` in the engine resolves to `2026-05-13T12:00:00Z`, so your queries return the same rows on day 1 and day 30.

### Voice (optional)

Morgan's lines speak through ElevenLabs if you paste an API key and voice ID into Settings. The voice toggle in the sidebar lets you mute / unmute on the fly. The Test Voice button in Settings gives you a precise error message if the key, the voice ID or the network is wrong.

## Tool stack

The default Nightshift stack mirrors a real 24/7 enterprise SOC:

| Layer | Product |
|---|---|
| SIEM | Microsoft Sentinel (KQL) |
| XDR | Rapid7 InsightIDR |
| Log platform | ELK Stack |
| EDR | Microsoft Defender for Endpoint |
| NGAV | Microsoft Defender Antivirus |
| IDPS | Azure Firewall IDPS |
| Ticketing | ServiceNow |

This is the stack the panels, runbooks and reports are built around. Switching to the Splunk/CrowdStrike preview shows you the relabel pattern but the panels don't have populated data.

## Screenshots

**Briefing — start of shift**

![Briefing page with stats, Morgan welcome, get-started buttons and voice toggle](docs/screenshots/01-briefing.png)

**Alert queue — 35 incidents**

![Alert queue showing critical and high alerts across Defender, Azure AD, Sysmon, Azure Firewall](docs/screenshots/02-queue.png)

**Alert workspace — investigation in progress**

![Alert detail with KQL query running, result table populated, triage panel ready](docs/screenshots/09-alert-investigation.png)

**Alert workspace — post-triage feedback**

![Alert detail showing correct triage verdict with Morgan's Tier 3 reasoning](docs/screenshots/08-alert-detail.png)

**KQL tutorial — Lesson 2**

![Lesson 2 explaining where, project, summarize, count with runnable examples](docs/screenshots/04-lesson.png)

**Mentor chat — Morgan Reyes**

![Mentor chat with canned prompts and free-text input to ask Morgan anything](docs/screenshots/05-mentor.png)

**Dashboard — shift performance**

![Dashboard with triage accuracy, hints used, alerts by severity and product, tutorial progress](docs/screenshots/06-dashboard.png)

**Settings — voice + tool stack**

![Settings page with ElevenLabs key, voice ID, tool stack selector and troubleshooting hints](docs/screenshots/07-settings.png)

## Getting started

### Prerequisites

- Node 20+
- npm 10+
- On Windows: Visual Studio Build Tools with the "Desktop development with C++" workload — required so `better-sqlite3` can compile its native bindings during `npm install`. See [node-gyp's Windows install guide](https://github.com/nodejs/node-gyp#on-windows).

### Run locally

```bash
git clone https://github.com/richard-skerritt/sentinel-soc-tier1-lab.git
cd sentinel-soc-tier1-lab
npm install
npm run dev          # dev server on http://localhost:5000
```

Then open <http://localhost:5000>.

### Production build

```bash
npm run build                  # client → dist/public/, server → dist/index.cjs
NODE_ENV=production node dist/index.cjs
```

### Optional: enable Morgan's voice

1. Get an API key from [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys).
2. Pick a voice from [Voice Lab](https://elevenlabs.io/app/voice-lab) and copy its **ID** (not its name). Free-tier sample voices like Rachel (`21m00Tcm4TlvDq8ikWAM`) work out of the box.
3. Open **Settings** in the lab, paste both, hit **Save settings**, then **Test voice**.

## Project structure

```
.
├── client/                       Vite + React + Tailwind + shadcn/ui frontend
│   └── src/
│       ├── components/
│       │   ├── RunbookPanel.tsx        Collapsible right-rail runbook
│       │   ├── Rapid7Panel.tsx         InsightIDR log search + asset tab
│       │   ├── ElkPanel.tsx            Kibana Discover-style table
│       │   ├── MitreDetailDialog.tsx   Click-through MITRE technique dialog
│       │   └── …                       Layout, MorganBubble, KQL editor, etc.
│       ├── data/
│       │   ├── alerts.json             35 incidents with category + MITRE
│       │   ├── runbooks.json           6 category playbooks (6–8 steps each)
│       │   ├── mitre_map.json          36 MITRE techniques with detection queries
│       │   ├── rapid7_responses.json   Scripted InsightIDR results per alert
│       │   ├── elk_responses.json      Scripted ELK events per alert
│       │   ├── toolStacks.json         Tool stack configurations
│       │   ├── mentor.json             Morgan Reyes dialogue + behaviour
│       │   └── tutorial.json           Four KQL lessons
│       ├── lib/
│       │   ├── kql/                    Tokeniser, parser, evaluator
│       │   ├── exportIncident.ts       SOC-ticket markdown export
│       │   ├── toolStack.ts            Active stack helpers
│       │   └── voice.ts                ElevenLabs client
│       └── pages/                      Briefing, Queue, AlertDetail, Learn, Mentor, Dashboard, Settings
├── server/                       Express API + SQLite (Drizzle ORM)
│   ├── data/logs/                10 log tables (~8 500 events)
│   └── routes.ts                 /api/logs, /api/triage, /api/voice, /api/incident-reports, /api/tool-stack
├── shared/                       Drizzle schema shared between client and server
├── script/                       Re-runnable data generators (alerts, logs, tool responses)
├── docs/
│   ├── kql-engine-spec.md
│   └── screenshots/
├── .env.example
├── LICENSE
├── CLAUDE.md                     Guidance for Claude Code agents
└── README.md
```

## Tech stack

- **Frontend** — React 18, Vite, Tailwind, shadcn/ui, Wouter (hash routing), CodeMirror 6, Recharts, lucide-react
- **Backend** — Express, Drizzle ORM, better-sqlite3
- **KQL engine** — original tokeniser + parser + evaluator, no third-party query libraries
- **Voice** — ElevenLabs Turbo v2.5, sequential play queue, in-memory mute state
- **Build** — single `npm run build` step produces `dist/public` (client) and `dist/index.cjs` (server)

## What this is — and isn't

This is a **simulator**, not real Microsoft Sentinel, Rapid7 InsightIDR or ELK. The KQL it runs is a faithful subset of Kusto. The Rapid7 and ELK panels return hand-authored data — the format is correct, the engines aren't real.

If you want to practise against the genuine product, Microsoft publishes an [official Sentinel training lab on GitHub](https://github.com/Azure/Azure-Sentinel/tree/master/Training) that deploys into your own Azure subscription. Rapid7 and Elastic both have free trial / cloud-free tiers. Nightshift is what you use **before** any of those — when you haven't got the subscription, the licence, or the confidence yet.

## Disclaimer

Built as a personal study tool for the Tier 1 SOC analyst path. No affiliation with Microsoft, Rapid7, Elastic, ElevenLabs or any commercial training vendor. All alert text, log data, the Morgan Reyes persona and both embedded attack chains are original fiction.

## License

MIT — see [LICENSE](LICENSE).
