import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { storage } from "./storage";

const LOG_TABLE_NAMES = [
  "AzureActivity",
  "AzureFirewallNetworkRule",
  "DeviceAlertEvents",
  "DeviceNetworkEvents",
  "DeviceProcessEvents",
  "EmailEvents",
  "OfficeActivity",
  "SigninLogs",
  "SysmonEvent",
  "ThreatIntelligenceIndicator",
];

// Read all log JSON files at startup and cache them in memory.
const logCache: Record<string, any[]> = {};

function loadLogs() {
  // Try the project-relative data dir, then the dist-bundled one
  const candidates = [
    path.resolve(process.cwd(), "server/data/logs"),
    path.resolve(process.cwd(), "dist/server/data/logs"),
    path.resolve(__dirname, "data/logs"),
    path.resolve(__dirname, "../server/data/logs"),
  ];
  let logDir: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      logDir = c;
      break;
    }
  }
  if (!logDir) {
    console.warn("[logs] No log dir found, tried:", candidates);
    return;
  }
  for (const name of LOG_TABLE_NAMES) {
    const p = path.join(logDir, `${name}.json`);
    if (fs.existsSync(p)) {
      try {
        logCache[name] = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch (e) {
        console.error(`[logs] Failed to load ${name}:`, e);
        logCache[name] = [];
      }
    } else {
      logCache[name] = [];
    }
  }
  console.log(
    "[logs] Loaded:",
    Object.entries(logCache)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(", "),
  );
}
loadLogs();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ===== Log tables =====
  app.get("/api/logs", (_req, res) => {
    const summary: Record<string, number> = {};
    for (const [k, v] of Object.entries(logCache)) summary[k] = v.length;
    res.json(summary);
  });
  app.get("/api/logs/:tableName", (req, res) => {
    const name = req.params.tableName;
    if (!(name in logCache)) {
      return res.status(404).json({
        error: `Unknown table '${name}'. Available: ${Object.keys(logCache).join(", ")}`,
      });
    }
    res.json(logCache[name]);
  });

  // ===== Tutorial =====
  app.get("/api/tutorial/progress", (_req, res) => {
    res.json(storage.listTutorial());
  });
  app.post("/api/tutorial/progress", (req, res) => {
    const { lessonId } = req.body;
    if (!lessonId) return res.status(400).json({ error: "lessonId required" });
    storage.completeLesson(lessonId);
    res.json({ ok: true, lessonId });
  });

  // ===== Hints =====
  app.post("/api/triage/hint", (req, res) => {
    const { alertId } = req.body;
    if (!alertId) return res.status(400).json({ error: "alertId required" });
    const count = storage.incrementHint(alertId);
    res.json({ alertId, hintCount: count });
  });
  app.get("/api/triage/hints", (_req, res) => {
    res.json(storage.listHintUsage());
  });

  // ===== Triage =====
  app.get("/api/triage", (_req, res) => {
    res.json(storage.listTriages());
  });
  app.get("/api/triage/:alertId", (req, res) => {
    const t = storage.getTriage(req.params.alertId);
    if (!t) return res.status(404).json({ error: "not found" });
    res.json({ ...t, actions: JSON.parse(t.actions || "[]") });
  });
  app.post("/api/triage/:alertId", (req, res) => {
    const { verdict, actions, notes, correct, partial } = req.body;
    if (!verdict) return res.status(400).json({ error: "verdict required" });
    const saved = storage.saveTriage({
      alertId: req.params.alertId,
      verdict,
      actions: JSON.stringify(actions ?? []),
      notes: notes ?? null,
      submittedAt: Date.now(),
      correct: correct ? 1 : 0,
      partial: partial ? 1 : 0,
    });
    res.json(saved);
  });

  // ===== Notebook =====
  app.get("/api/notebook/:alertId", (req, res) => {
    res.json(storage.getNotebook(req.params.alertId));
  });
  app.post("/api/notebook/:alertId", (req, res) => {
    const { notes, savedQueries } = req.body;
    storage.saveNotebook(req.params.alertId, notes ?? "", savedQueries ?? []);
    res.json({ ok: true });
  });

  // ===== Query history =====
  app.post("/api/queryHistory", (req, res) => {
    const { alertId, query, resultRows } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });
    storage.logQuery(alertId ?? null, query, resultRows ?? 0);
    res.json({ ok: true });
  });
  app.get("/api/queryHistory", (req, res) => {
    const alertId = (req.query.alertId as string) || undefined;
    res.json(storage.listQueryHistory(alertId));
  });
  app.get("/api/queryHistory/perAlert", (_req, res) => {
    res.json(storage.countQueriesPerAlert());
  });

  // ===== Settings =====
  app.get("/api/settings", (_req, res) => {
    res.json(storage.allSettings());
  });
  app.post("/api/settings", (req, res) => {
    const body = req.body || {};
    for (const [k, v] of Object.entries(body)) storage.setSetting(k, String(v));
    res.json({ ok: true });
  });

  // ===== Incident reports =====
  app.post("/api/incident-reports", (req, res) => {
    const { alertId, reportContent } = req.body || {};
    if (!alertId || !reportContent) {
      return res.status(400).json({ error: "alertId and reportContent required" });
    }
    const saved = storage.saveIncidentReport(String(alertId), String(reportContent));
    res.json(saved);
  });
  app.get("/api/incident-reports/:alertId", (req, res) => {
    const r = storage.getLatestIncidentReport(req.params.alertId);
    if (!r) return res.status(404).json({ error: "not found" });
    res.json(r);
  });

  // ===== Tool stack preference =====
  app.get("/api/tool-stack", (_req, res) => {
    res.json({ activeStack: storage.getActiveToolStack() });
  });
  app.post("/api/tool-stack", (req, res) => {
    const { activeStack } = req.body || {};
    if (!activeStack) return res.status(400).json({ error: "activeStack required" });
    storage.setActiveToolStack(String(activeStack));
    res.json({ ok: true, activeStack });
  });

  // ===== Voice (ElevenLabs proxy) =====
  app.post("/api/voice", async (req, res) => {
    const text: string = (req.body?.text || "").toString().slice(0, 2000);
    if (!text.trim()) {
      return res.status(400).json({ error: "text_required" });
    }
    // Pull credentials from stored settings (single source of truth)
    const all = storage.allSettings();
    const apiKey = (req.body?.apiKey as string) || all.elevenLabsKey || "";
    const voiceId = (req.body?.voiceId as string) || all.elevenLabsVoiceId || "";
    if (!apiKey || !voiceId) {
      return res.status(400).json({ error: "voice_not_configured" });
    }
    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        },
      );
      if (!upstream.ok) {
        const errBody = await upstream.text();
        console.error("[voice] ElevenLabs error", upstream.status, errBody.slice(0, 300));
        return res.status(upstream.status).json({
          error: "upstream_error",
          status: upstream.status,
          detail: errBody.slice(0, 500),
        });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch (e: any) {
      console.error("[voice] fetch failed", e);
      res.status(500).json({ error: "fetch_failed", detail: String(e?.message || e) });
    }
  });

  return httpServer;
}
