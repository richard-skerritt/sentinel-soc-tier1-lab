// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { parse } from "./parser";
import { evaluate, RunResult, FROZEN_NOW } from "./evaluator";

export { FROZEN_NOW };

export function runQuery(text: string, tables: Record<string, any[]>): RunResult {
  const start = performance.now();
  try {
    const pipeline = parse(text);
    return evaluate(pipeline, tables);
  } catch (e: any) {
    return {
      columns: [],
      rows: [],
      error: e.message || String(e),
      executionMs: performance.now() - start,
      totalRows: 0,
      displayedRows: 0,
    };
  }
}
