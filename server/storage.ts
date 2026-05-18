// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import {
  triages,
  tutorialProgress,
  hintUsage,
  notebooks,
  queryHistory,
  settings,
  incidentReports,
  toolStackPreference,
} from "@shared/schema";
import type { Triage, IncidentReport } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Bootstrap tables (idempotent).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS triages (
    alertId TEXT PRIMARY KEY,
    verdict TEXT NOT NULL,
    actions TEXT NOT NULL,
    notes TEXT,
    submittedAt INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    partial INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tutorialProgress (
    lessonId TEXT PRIMARY KEY,
    completedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS hintUsage (
    alertId TEXT PRIMARY KEY,
    hintCount INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notebooks (
    alertId TEXT PRIMARY KEY,
    notes TEXT,
    savedQueries TEXT
  );
  CREATE TABLE IF NOT EXISTS queryHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alertId TEXT,
    query TEXT NOT NULL,
    runAt INTEGER NOT NULL,
    resultRows INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS incidentReports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alertId TEXT NOT NULL,
    reportContent TEXT NOT NULL,
    exportedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS toolStackPreference (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activeStack TEXT NOT NULL DEFAULT 'nightshift-default',
    updatedAt INTEGER NOT NULL
  );
`);

export interface IStorage {
  // Triage
  getTriage(alertId: string): Triage | undefined;
  saveTriage(t: Triage): Triage;
  listTriages(): Triage[];

  // Tutorial
  listTutorial(): { lessonId: string; completedAt: number }[];
  completeLesson(lessonId: string): void;

  // Hints
  getHintCount(alertId: string): number;
  incrementHint(alertId: string): number;
  listHintUsage(): { alertId: string; hintCount: number }[];

  // Notebook
  getNotebook(alertId: string): { notes: string; savedQueries: any[] };
  saveNotebook(alertId: string, notes: string, savedQueries: any[]): void;

  // Query history
  logQuery(alertId: string | null, query: string, resultRows: number): void;
  listQueryHistory(alertId?: string): any[];
  countQueriesPerAlert(): Record<string, number>;

  // Settings
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  allSettings(): Record<string, string>;

  // Incident reports
  saveIncidentReport(alertId: string, content: string): IncidentReport;
  getLatestIncidentReport(alertId: string): IncidentReport | undefined;

  // Tool stack preference
  getActiveToolStack(): string;
  setActiveToolStack(stackId: string): void;
}

export class DatabaseStorage implements IStorage {
  getTriage(alertId: string) {
    return db.select().from(triages).where(eq(triages.alertId, alertId)).get();
  }
  saveTriage(t: Triage) {
    const existing = this.getTriage(t.alertId);
    if (existing) {
      db.update(triages).set(t).where(eq(triages.alertId, t.alertId)).run();
    } else {
      db.insert(triages).values(t).run();
    }
    return t;
  }
  listTriages() {
    return db.select().from(triages).all();
  }

  listTutorial() {
    return db.select().from(tutorialProgress).all();
  }
  completeLesson(lessonId: string) {
    const existing = db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.lessonId, lessonId))
      .get();
    if (!existing) {
      db.insert(tutorialProgress).values({ lessonId, completedAt: Date.now() }).run();
    }
  }

  getHintCount(alertId: string) {
    const row = db.select().from(hintUsage).where(eq(hintUsage.alertId, alertId)).get();
    return row?.hintCount ?? 0;
  }
  incrementHint(alertId: string) {
    const cur = this.getHintCount(alertId);
    if (cur === 0 && !db.select().from(hintUsage).where(eq(hintUsage.alertId, alertId)).get()) {
      db.insert(hintUsage).values({ alertId, hintCount: 1 }).run();
      return 1;
    }
    db.update(hintUsage).set({ hintCount: cur + 1 }).where(eq(hintUsage.alertId, alertId)).run();
    return cur + 1;
  }
  listHintUsage() {
    return db.select().from(hintUsage).all();
  }

  getNotebook(alertId: string) {
    const r = db.select().from(notebooks).where(eq(notebooks.alertId, alertId)).get();
    if (!r) return { notes: "", savedQueries: [] };
    let sq: any[] = [];
    try {
      sq = r.savedQueries ? JSON.parse(r.savedQueries) : [];
    } catch {
      sq = [];
    }
    return { notes: r.notes ?? "", savedQueries: sq };
  }
  saveNotebook(alertId: string, notes: string, savedQueries: any[]) {
    const existing = db.select().from(notebooks).where(eq(notebooks.alertId, alertId)).get();
    const sq = JSON.stringify(savedQueries);
    if (existing) {
      db.update(notebooks).set({ notes, savedQueries: sq }).where(eq(notebooks.alertId, alertId)).run();
    } else {
      db.insert(notebooks).values({ alertId, notes, savedQueries: sq }).run();
    }
  }

  logQuery(alertId: string | null, query: string, resultRows: number) {
    db.insert(queryHistory)
      .values({ alertId, query, runAt: Date.now(), resultRows })
      .run();
  }
  listQueryHistory(alertId?: string) {
    if (alertId)
      return db.select().from(queryHistory).where(eq(queryHistory.alertId, alertId)).all();
    return db.select().from(queryHistory).all();
  }
  countQueriesPerAlert() {
    const rows = db
      .select({ alertId: queryHistory.alertId, c: sql<number>`count(*)` })
      .from(queryHistory)
      .groupBy(queryHistory.alertId)
      .all() as any[];
    const out: Record<string, number> = {};
    for (const r of rows) if (r.alertId) out[r.alertId] = Number(r.c);
    return out;
  }

  getSetting(key: string) {
    const r = db.select().from(settings).where(eq(settings.id, key)).get();
    return r?.value ?? undefined;
  }
  setSetting(key: string, value: string) {
    const existing = db.select().from(settings).where(eq(settings.id, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.id, key)).run();
    } else {
      db.insert(settings).values({ id: key, value }).run();
    }
  }
  allSettings() {
    const rows = db.select().from(settings).all();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.id] = r.value ?? "";
    return out;
  }

  saveIncidentReport(alertId: string, content: string) {
    const inserted = db
      .insert(incidentReports)
      .values({ alertId, reportContent: content, exportedAt: Date.now() })
      .returning()
      .get();
    return inserted;
  }
  getLatestIncidentReport(alertId: string) {
    const rows = db
      .select()
      .from(incidentReports)
      .where(eq(incidentReports.alertId, alertId))
      .all();
    if (!rows.length) return undefined;
    return rows.sort((a, b) => b.exportedAt - a.exportedAt)[0];
  }

  getActiveToolStack() {
    const rows = db.select().from(toolStackPreference).all();
    if (!rows.length) return "nightshift-default";
    return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0].activeStack;
  }
  setActiveToolStack(stackId: string) {
    db.insert(toolStackPreference)
      .values({ activeStack: stackId, updatedAt: Date.now() })
      .run();
  }
}

export const storage = new DatabaseStorage();
