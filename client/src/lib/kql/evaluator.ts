// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
// KQL evaluator — walks the AST and produces rows.

import { Pipeline, Operator, Expr, parseTimespan } from "./parser";

// Frozen "now"
export const FROZEN_NOW = new Date("2026-05-13T12:00:00Z").getTime();

export interface RunResult {
  columns: string[];
  rows: any[];
  error?: string;
  executionMs: number;
  totalRows: number;
  displayedRows: number;
}

function toDate(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  if (v instanceof Date) return v.getTime();
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

interface EvalCtx {
  row: any;
  rows?: any[]; // for aggregations
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asString(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function evalExpr(e: Expr, ctx: EvalCtx, tables: Record<string, any[]>): any {
  switch (e.kind) {
    case "lit":
      return e.value;
    case "timespan":
      return e.ms;
    case "col":
      return ctx.row ? ctx.row[e.name] ?? null : null;
    case "not":
      return !evalExpr(e.expr, ctx, tables);
    case "unary": {
      const v = evalExpr(e.expr, ctx, tables);
      if (e.op === "-") return -v;
      return v;
    }
    case "list":
      return e.items.map((i) => evalExpr(i, ctx, tables));
    case "between":
      return null; // handled inside `between` op
    case "call":
      return callFn(e.name, e.args, ctx, tables);
    case "bin": {
      const op = e.op;
      // Special: between
      if (op === "between") {
        const lv = evalExpr(e.left, ctx, tables);
        const r: any = e.right;
        const lo = evalExpr(r.lo, ctx, tables);
        const hi = evalExpr(r.hi, ctx, tables);
        // numeric or date
        const lvN = typeof lv === "number" ? lv : toDate(lv);
        const loN = typeof lo === "number" ? lo : toDate(lo);
        const hiN = typeof hi === "number" ? hi : toDate(hi);
        if (lvN == null || loN == null || hiN == null) return false;
        return lvN >= loN && lvN <= hiN;
      }
      if (op === "and") return evalExpr(e.left, ctx, tables) && evalExpr(e.right, ctx, tables);
      if (op === "or") return evalExpr(e.left, ctx, tables) || evalExpr(e.right, ctx, tables);

      const lv = evalExpr(e.left, ctx, tables);
      const rv = evalExpr(e.right, ctx, tables);

      switch (op) {
        case "==":
          return looseEq(lv, rv);
        case "!=":
          return !looseEq(lv, rv);
        case ">":
          return compareGt(lv, rv);
        case ">=":
          return compareGt(lv, rv) || looseEq(lv, rv);
        case "<":
          return compareGt(rv, lv);
        case "<=":
          return compareGt(rv, lv) || looseEq(lv, rv);
        case "+":
          if (typeof lv === "number" && typeof rv === "number") return lv + rv;
          return asString(lv) + asString(rv);
        case "-":
          return (lv as number) - (rv as number);
        case "*":
          return (lv as number) * (rv as number);
        case "/":
          return (lv as number) / (rv as number);
        case "contains":
          return asString(lv).toLowerCase().includes(asString(rv).toLowerCase());
        case "!contains":
          return !asString(lv).toLowerCase().includes(asString(rv).toLowerCase());
        case "has": {
          const pat = new RegExp(`\\b${escapeRegex(asString(rv))}\\b`, "i");
          return pat.test(asString(lv));
        }
        case "!has": {
          const pat = new RegExp(`\\b${escapeRegex(asString(rv))}\\b`, "i");
          return !pat.test(asString(lv));
        }
        case "has_any": {
          const s = asString(lv);
          for (const item of rv as any[]) {
            const pat = new RegExp(`\\b${escapeRegex(asString(item))}\\b`, "i");
            if (pat.test(s)) return true;
          }
          return false;
        }
        case "has_all": {
          const s = asString(lv);
          for (const item of rv as any[]) {
            const pat = new RegExp(`\\b${escapeRegex(asString(item))}\\b`, "i");
            if (!pat.test(s)) return false;
          }
          return true;
        }
        case "startswith":
          return asString(lv).toLowerCase().startsWith(asString(rv).toLowerCase());
        case "endswith":
          return asString(lv).toLowerCase().endsWith(asString(rv).toLowerCase());
        case "matches": {
          const re = new RegExp(asString(rv));
          return re.test(asString(lv));
        }
        case "in":
          return (rv as any[]).some((x) => looseEq(lv, x));
        case "!in":
          return !(rv as any[]).some((x) => looseEq(lv, x));
        case "in~":
          return (rv as any[]).some((x) => asString(lv).toLowerCase() === asString(x).toLowerCase());
        case "!in~":
          return !(rv as any[]).some((x) => asString(lv).toLowerCase() === asString(x).toLowerCase());
      }
      return null;
    }
  }
}

function looseEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a === "number" && typeof b === "string") return a === parseFloat(b);
  if (typeof b === "number" && typeof a === "string") return b === parseFloat(a);
  // Try date compare
  if (typeof a === "string" && typeof b === "string" && /\d{4}-\d{2}/.test(a) && /\d{4}-\d{2}/.test(b)) {
    return Date.parse(a) === Date.parse(b);
  }
  return String(a) === String(b);
}

function compareGt(a: any, b: any): boolean {
  // numeric compare
  if (typeof a === "number" && typeof b === "number") return a > b;
  // dates
  const ad = toDate(a);
  const bd = toDate(b);
  if (ad != null && bd != null) return ad > bd;
  // numeric strings
  const an = parseFloat(a);
  const bn = parseFloat(b);
  if (!isNaN(an) && !isNaN(bn)) return an > bn;
  return String(a) > String(b);
}

function callFn(name: string, args: Expr[], ctx: EvalCtx, tables: Record<string, any[]>): any {
  const fn = name.toLowerCase();
  // Aggregation functions handled by summarize, but allow simple invocation otherwise
  switch (fn) {
    case "now":
      return FROZEN_NOW;
    case "ago": {
      const a = args[0];
      let ms = 0;
      if (a.kind === "timespan") ms = a.ms;
      else if (a.kind === "lit" && typeof a.value === "string") ms = parseTimespan(a.value);
      else ms = evalExpr(a, ctx, tables);
      return FROZEN_NOW - ms;
    }
    case "datetime": {
      const a = evalExpr(args[0], ctx, tables);
      if (typeof a === "number") return a;
      return Date.parse(String(a));
    }
    case "bin": {
      const v = evalExpr(args[0], ctx, tables);
      let span = 0;
      const a1 = args[1];
      if (a1.kind === "timespan") span = a1.ms;
      else span = evalExpr(a1, ctx, tables);
      const d = toDate(v);
      if (d == null) return null;
      const bucket = Math.floor(d / span) * span;
      return new Date(bucket).toISOString();
    }
    case "strlen": {
      const v = evalExpr(args[0], ctx, tables);
      return asString(v).length;
    }
    case "tolower":
      return asString(evalExpr(args[0], ctx, tables)).toLowerCase();
    case "toupper":
      return asString(evalExpr(args[0], ctx, tables)).toUpperCase();
    case "extract": {
      const pat = asString(evalExpr(args[0], ctx, tables));
      const grp = evalExpr(args[1], ctx, tables);
      const v = asString(evalExpr(args[2], ctx, tables));
      const re = new RegExp(pat);
      const m = v.match(re);
      if (!m) return null;
      return m[grp as number] ?? null;
    }
    case "parse_json": {
      const v = evalExpr(args[0], ctx, tables);
      if (typeof v === "object") return v;
      try {
        return JSON.parse(asString(v));
      } catch {
        return null;
      }
    }
    case "iff":
    case "iif": {
      const cond = evalExpr(args[0], ctx, tables);
      return cond ? evalExpr(args[1], ctx, tables) : evalExpr(args[2], ctx, tables);
    }
    case "isempty": {
      const v = evalExpr(args[0], ctx, tables);
      return v == null || v === "";
    }
    case "isnotempty": {
      const v = evalExpr(args[0], ctx, tables);
      return v != null && v !== "";
    }
    case "tostring":
      return asString(evalExpr(args[0], ctx, tables));
    case "toint":
    case "tolong":
    case "todouble":
    case "toreal": {
      const v = evalExpr(args[0], ctx, tables);
      return typeof v === "number" ? v : parseFloat(asString(v));
    }
    case "count": {
      // standalone — when not in summarize. Returns row count via ctx.rows
      return ctx.rows ? ctx.rows.length : 1;
    }
  }
  // unknown — try as ident column reference fallback
  return null;
}

// Aggregations evaluated on a group of rows
function evalAgg(name: string, args: Expr[], rows: any[], tables: Record<string, any[]>): any {
  const fn = name.toLowerCase();
  switch (fn) {
    case "count":
      return rows.length;
    case "countif": {
      let c = 0;
      for (const r of rows) {
        if (evalExpr(args[0], { row: r }, tables)) c++;
      }
      return c;
    }
    case "dcount": {
      const s = new Set<any>();
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (v != null) s.add(v);
      }
      return s.size;
    }
    case "sum": {
      let s = 0;
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (typeof v === "number") s += v;
        else if (v != null && !isNaN(parseFloat(v))) s += parseFloat(v);
      }
      return s;
    }
    case "avg": {
      let s = 0;
      let n = 0;
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (typeof v === "number") {
          s += v;
          n++;
        } else if (v != null && !isNaN(parseFloat(v))) {
          s += parseFloat(v);
          n++;
        }
      }
      return n === 0 ? 0 : s / n;
    }
    case "min": {
      let m: any = null;
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (v != null && (m === null || compareGt(m, v))) m = v;
      }
      return m;
    }
    case "max": {
      let m: any = null;
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (v != null && (m === null || compareGt(v, m))) m = v;
      }
      return m;
    }
    case "make_list": {
      const a: any[] = [];
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (v != null) a.push(v);
      }
      return a;
    }
    case "make_set": {
      const s = new Set<any>();
      for (const r of rows) {
        const v = evalExpr(args[0], { row: r }, tables);
        if (v != null) s.add(v);
      }
      return Array.from(s);
    }
  }
  return null;
}

function applyOperator(
  op: Operator,
  rows: any[],
  columns: string[],
  tables: Record<string, any[]>,
): { rows: any[]; columns: string[] } {
  switch (op.kind) {
    case "table":
      return { rows, columns };
    case "where": {
      const next = rows.filter((r) => !!evalExpr(op.pred, { row: r }, tables));
      return { rows: next, columns };
    }
    case "project": {
      const newCols = op.cols.map((c) => c.name);
      const next = rows.map((r) => {
        const nr: any = {};
        for (const c of op.cols) {
          nr[c.name] = c.expr ? evalExpr(c.expr, { row: r }, tables) : r[c.name] ?? null;
        }
        return nr;
      });
      return { rows: next, columns: newCols };
    }
    case "extend": {
      const newCols = [...columns];
      for (const c of op.cols) if (!newCols.includes(c.name)) newCols.push(c.name);
      const next = rows.map((r) => {
        const nr = { ...r };
        for (const c of op.cols) nr[c.name] = evalExpr(c.expr, { row: r }, tables);
        return nr;
      });
      return { rows: next, columns: newCols };
    }
    case "summarize": {
      // group rows by `by` keys
      const byKeys: { name: string; expr?: Expr }[] = op.by;
      const groups = new Map<string, { keyVals: Record<string, any>; rows: any[] }>();
      for (const r of rows) {
        const keyVals: Record<string, any> = {};
        for (const b of byKeys) {
          keyVals[b.name] = b.expr ? evalExpr(b.expr, { row: r }, tables) : r[b.name] ?? null;
        }
        const key = JSON.stringify(byKeys.map((b) => keyVals[b.name]));
        if (!groups.has(key)) groups.set(key, { keyVals, rows: [] });
        groups.get(key)!.rows.push(r);
      }
      const outCols = [...byKeys.map((b) => b.name), ...op.aggs.map((a) => a.name)];
      const outRows: any[] = [];
      for (const g of Array.from(groups.values())) {
        const o: any = { ...g.keyVals };
        for (const agg of op.aggs) {
          if (agg.expr.kind !== "call") {
            o[agg.name] = evalExpr(agg.expr, { row: g.rows[0], rows: g.rows }, tables);
          } else {
            o[agg.name] = evalAgg(agg.expr.name, agg.expr.args, g.rows, tables);
          }
        }
        outRows.push(o);
      }
      // If no `by`, single row of aggs
      if (byKeys.length === 0 && rows.length >= 0) {
        const o: any = {};
        for (const agg of op.aggs) {
          if (agg.expr.kind !== "call") {
            o[agg.name] = evalExpr(agg.expr, { row: rows[0] ?? {}, rows }, tables);
          } else {
            o[agg.name] = evalAgg(agg.expr.name, agg.expr.args, rows, tables);
          }
        }
        return { rows: [o], columns: op.aggs.map((a) => a.name) };
      }
      return { rows: outRows, columns: outCols };
    }
    case "sort": {
      const next = [...rows].sort((a, b) => {
        for (const c of op.cols) {
          const av = evalExpr(c.expr, { row: a }, tables);
          const bv = evalExpr(c.expr, { row: b }, tables);
          if (looseEq(av, bv)) continue;
          const gt = compareGt(av, bv);
          if (c.dir === "desc") return gt ? -1 : 1;
          return gt ? 1 : -1;
        }
        return 0;
      });
      return { rows: next, columns };
    }
    case "top": {
      const sorted = [...rows].sort((a, b) => {
        const av = evalExpr(op.col, { row: a }, tables);
        const bv = evalExpr(op.col, { row: b }, tables);
        if (looseEq(av, bv)) return 0;
        const gt = compareGt(av, bv);
        if (op.dir === "desc") return gt ? -1 : 1;
        return gt ? 1 : -1;
      });
      return { rows: sorted.slice(0, op.n), columns };
    }
    case "take":
      return { rows: rows.slice(0, op.n), columns };
    case "count":
      return { rows: [{ Count: rows.length }], columns: ["Count"] };
    case "distinct": {
      const seen = new Set<string>();
      const next: any[] = [];
      for (const r of rows) {
        const key = JSON.stringify(op.cols.map((c) => r[c]));
        if (!seen.has(key)) {
          seen.add(key);
          const nr: any = {};
          for (const c of op.cols) nr[c] = r[c];
          next.push(nr);
        }
      }
      return { rows: next, columns: op.cols };
    }
  }
  return { rows, columns };
}

export function evaluate(pipeline: Pipeline, tables: Record<string, any[]>): RunResult {
  const start = performance.now();
  // Look up table case-insensitively
  let tableName = pipeline.table;
  if (!(tableName in tables)) {
    const lower = tableName.toLowerCase();
    const match = Object.keys(tables).find((t) => t.toLowerCase() === lower);
    if (match) tableName = match;
    else {
      const avail = Object.keys(tables).join(", ");
      // suggestion
      const candidates = Object.keys(tables)
        .map((t) => ({ t, d: levenshtein(t.toLowerCase(), lower) }))
        .sort((a, b) => a.d - b.d);
      const hint = candidates.length && candidates[0].d <= 3 ? ` Did you mean '${candidates[0].t}'?` : "";
      return {
        columns: [],
        rows: [],
        error: `Unknown table '${pipeline.table}'.${hint} Available: ${avail}`,
        executionMs: 0,
        totalRows: 0,
        displayedRows: 0,
      };
    }
  }

  let rows = tables[tableName].slice();
  let columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  try {
    for (let i = 1; i < pipeline.ops.length; i++) {
      const r = applyOperator(pipeline.ops[i], rows, columns, tables);
      rows = r.rows;
      columns = r.columns;
    }
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

  const totalRows = rows.length;
  const cap = 1000;
  const displayed = rows.slice(0, cap);
  return {
    columns,
    rows: displayed,
    executionMs: performance.now() - start,
    totalRows,
    displayedRows: displayed.length,
  };
}
