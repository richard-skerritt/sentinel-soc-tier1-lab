import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Per-alert triage state (one row per alert)
export const triages = sqliteTable("triages", {
  alertId: text("alertId").primaryKey(),
  verdict: text("verdict").notNull(),
  actions: text("actions").notNull(), // JSON array
  notes: text("notes"),
  submittedAt: integer("submittedAt").notNull(),
  correct: integer("correct").notNull(), // 0/1
  partial: integer("partial").notNull(), // 0/1
});
export const insertTriageSchema = createInsertSchema(triages);
export type Triage = typeof triages.$inferSelect;

// Tutorial progress (one row per lesson completion)
export const tutorialProgress = sqliteTable("tutorialProgress", {
  lessonId: text("lessonId").primaryKey(),
  completedAt: integer("completedAt").notNull(),
});

// Hint count per alert
export const hintUsage = sqliteTable("hintUsage", {
  alertId: text("alertId").primaryKey(),
  hintCount: integer("hintCount").notNull(),
});

// Notebook per alert
export const notebooks = sqliteTable("notebooks", {
  alertId: text("alertId").primaryKey(),
  notes: text("notes"),
  savedQueries: text("savedQueries"), // JSON
});

// Query history
export const queryHistory = sqliteTable("queryHistory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alertId"),
  query: text("query").notNull(),
  runAt: integer("runAt").notNull(),
  resultRows: integer("resultRows").notNull(),
});

// User settings
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  value: text("value"),
});
