// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
// KQL parser — builds an AST from token stream.

import { Token, tokenise } from "./tokeniser";

export type Expr =
  | { kind: "lit"; value: string | number | boolean | null; raw?: string }
  | { kind: "timespan"; ms: number; raw: string }
  | { kind: "col"; name: string }
  | { kind: "call"; name: string; args: Expr[] }
  | { kind: "bin"; op: string; left: Expr; right: Expr }
  | { kind: "unary"; op: string; expr: Expr }
  | { kind: "list"; items: Expr[] }
  | { kind: "between"; lo: Expr; hi: Expr }
  | { kind: "not"; expr: Expr };

export type Operator =
  | { kind: "table"; name: string }
  | { kind: "where"; pred: Expr }
  | { kind: "project"; cols: { name: string; expr?: Expr }[] }
  | { kind: "extend"; cols: { name: string; expr: Expr }[] }
  | {
      kind: "summarize";
      aggs: { name: string; expr: Expr }[];
      by: { name: string; expr?: Expr }[];
    }
  | { kind: "sort"; cols: { expr: Expr; dir: "asc" | "desc" }[] }
  | { kind: "top"; n: number; col: Expr; dir: "asc" | "desc" }
  | { kind: "take"; n: number }
  | { kind: "count" }
  | { kind: "distinct"; cols: string[] };

export interface Pipeline {
  table: string;
  ops: Operator[];
}

const TIMESPAN_RE = /^(-?\d+(?:\.\d+)?)(ms|s|m|h|d)$/;
export function parseTimespan(raw: string): number {
  const m = raw.match(TIMESPAN_RE);
  if (!m) throw new Error("Bad timespan: " + raw);
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 3600 * 1000;
    case "d":
      return n * 86400 * 1000;
  }
  return n;
}

class Parser {
  tokens: Token[];
  i = 0;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  peek(off = 0): Token {
    return this.tokens[this.i + off];
  }
  next(): Token {
    return this.tokens[this.i++];
  }
  expect(type: string, value?: string): Token {
    const t = this.tokens[this.i];
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? " '" + value + "'" : ""} but got ${t.type} '${t.value}' at char ${t.pos}`,
      );
    }
    this.i++;
    return t;
  }
  isIdent(values: string[]): boolean {
    const t = this.peek();
    return t.type === "ident" && values.includes(t.value.toLowerCase());
  }

  parsePipeline(): Pipeline {
    const t = this.expect("ident");
    const pipeline: Pipeline = { table: t.value, ops: [{ kind: "table", name: t.value }] };
    while (this.peek().type === "pipe") {
      this.next(); // consume |
      pipeline.ops.push(this.parseOperator());
    }
    return pipeline;
  }

  parseOperator(): Operator {
    const t = this.peek();
    if (t.type !== "ident") {
      throw new Error(`Expected operator name after | at char ${t.pos}`);
    }
    const opName = t.value.toLowerCase();
    this.next();
    switch (opName) {
      case "where":
      case "filter":
        return { kind: "where", pred: this.parseExpr() };
      case "project":
        return { kind: "project", cols: this.parseColList() };
      case "extend":
        return { kind: "extend", cols: this.parseExtendList() };
      case "summarize":
        return this.parseSummarize();
      case "sort":
      case "order": {
        // sort by col [asc|desc]
        if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "by") {
          this.next();
        }
        const cols: { expr: Expr; dir: "asc" | "desc" }[] = [];
        while (true) {
          const expr = this.parseExpr();
          let dir: "asc" | "desc" = "desc";
          if (this.peek().type === "ident") {
            const v = this.peek().value.toLowerCase();
            if (v === "asc" || v === "desc") {
              dir = v as "asc" | "desc";
              this.next();
            }
          }
          cols.push({ expr, dir });
          if (this.peek().type === "comma") {
            this.next();
            continue;
          }
          break;
        }
        return { kind: "sort", cols };
      }
      case "top": {
        const n = parseInt(this.expect("number").value, 10);
        if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "by") this.next();
        const col = this.parseExpr();
        let dir: "asc" | "desc" = "desc";
        if (this.peek().type === "ident") {
          const v = this.peek().value.toLowerCase();
          if (v === "asc" || v === "desc") {
            dir = v as any;
            this.next();
          }
        }
        return { kind: "top", n, col, dir };
      }
      case "take":
      case "limit": {
        const n = parseInt(this.expect("number").value, 10);
        return { kind: "take", n };
      }
      case "count":
        return { kind: "count" };
      case "distinct": {
        const cols: string[] = [];
        cols.push(this.expect("ident").value);
        while (this.peek().type === "comma") {
          this.next();
          cols.push(this.expect("ident").value);
        }
        return { kind: "distinct", cols };
      }
      default:
        throw new Error(
          `Unknown operator '|${opName}' at char ${t.pos}. Did you mean '|project' or '|where'?`,
        );
    }
  }

  parseColList(): { name: string; expr?: Expr }[] {
    const cols: { name: string; expr?: Expr }[] = [];
    while (true) {
      const nameTok = this.expect("ident");
      let expr: Expr | undefined;
      if (this.peek().type === "operator" && this.peek().value === "=") {
        this.next();
        expr = this.parseExpr();
      }
      cols.push({ name: nameTok.value, expr });
      if (this.peek().type === "comma") {
        this.next();
        continue;
      }
      break;
    }
    return cols;
  }

  parseExtendList(): { name: string; expr: Expr }[] {
    const cols: { name: string; expr: Expr }[] = [];
    while (true) {
      const nameTok = this.expect("ident");
      this.expect("operator", "=");
      const expr = this.parseExpr();
      cols.push({ name: nameTok.value, expr });
      if (this.peek().type === "comma") {
        this.next();
        continue;
      }
      break;
    }
    return cols;
  }

  parseSummarize(): Operator {
    // summarize <aggList> [by <colList>]
    const aggs: { name: string; expr: Expr }[] = [];
    while (true) {
      // can be: Alias = agg()  OR  agg() as Alias  OR  agg()
      const startIdx = this.i;
      if (this.peek().type === "ident" && this.peek(1).type === "operator" && this.peek(1).value === "=") {
        const aliasName = this.next().value;
        this.next(); // =
        const expr = this.parseExpr();
        aggs.push({ name: aliasName, expr });
      } else {
        const expr = this.parseExpr();
        let name = this.aggDefaultName(expr);
        if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "as") {
          this.next();
          name = this.expect("ident").value;
        }
        aggs.push({ name, expr });
      }
      if (this.peek().type === "comma") {
        this.next();
        continue;
      }
      break;
    }
    let by: { name: string; expr?: Expr }[] = [];
    if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "by") {
      this.next();
      while (true) {
        // each by-key can be: name | name = expr | expr (named after fn)
        const startIdx = this.i;
        if (
          this.peek().type === "ident" &&
          this.peek(1).type === "operator" &&
          this.peek(1).value === "="
        ) {
          const name = this.next().value;
          this.next();
          const expr = this.parseExpr();
          by.push({ name, expr });
        } else {
          const expr = this.parseExpr();
          // name = either col name, or generated
          let name: string;
          if (expr.kind === "col") name = expr.name;
          else if (expr.kind === "call") name = this.callKey(expr);
          else name = "expr" + by.length;
          by.push({ name, expr: expr.kind === "col" ? undefined : expr });
        }
        if (this.peek().type === "comma") {
          this.next();
          continue;
        }
        break;
      }
    }
    return { kind: "summarize", aggs, by };
  }

  callKey(e: Expr): string {
    if (e.kind === "call") {
      const colArgs = e.args.filter((a) => a.kind === "col") as any[];
      if (colArgs.length > 0) return colArgs[0].name;
      return e.name;
    }
    return "expr";
  }

  aggDefaultName(e: Expr): string {
    if (e.kind === "call") {
      const fn = e.name.toLowerCase();
      if (fn === "count") return "Count";
      if (e.args.length > 0 && e.args[0].kind === "col") {
        const col = (e.args[0] as any).name;
        return fn + "_" + col;
      }
      return fn;
    }
    return "result";
  }

  // ===== Expressions =====
  parseExpr(): Expr {
    return this.parseOr();
  }
  parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peek().type === "ident" && this.peek().value.toLowerCase() === "or") {
      this.next();
      const right = this.parseAnd();
      left = { kind: "bin", op: "or", left, right };
    }
    return left;
  }
  parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peek().type === "ident" && this.peek().value.toLowerCase() === "and") {
      this.next();
      const right = this.parseNot();
      left = { kind: "bin", op: "and", left, right };
    }
    return left;
  }
  parseNot(): Expr {
    if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "not") {
      this.next();
      // not(expr) or not expr
      let expr: Expr;
      if (this.peek().type === "lparen") {
        this.next();
        expr = this.parseExpr();
        this.expect("rparen");
      } else {
        expr = this.parseComparison();
      }
      return { kind: "not", expr };
    }
    return this.parseComparison();
  }
  parseComparison(): Expr {
    const left = this.parseAddSub();
    const t = this.peek();
    // binary operators
    if (t.type === "operator") {
      const op = t.value;
      if (["==", "!=", ">=", "<=", "=", ">", "<"].includes(op)) {
        this.next();
        const right = this.parseAddSub();
        return { kind: "bin", op: op === "=" ? "==" : op, left, right };
      }
    }
    if (t.type === "ident") {
      const kw = t.value.toLowerCase();
      const wordOps = [
        "contains",
        "!contains",
        "has",
        "has_any",
        "has_all",
        "!has",
        "startswith",
        "endswith",
        "matches",
        "in",
        "!in",
        "in~",
        "!in~",
        "between",
      ];
      if (wordOps.includes(kw)) {
        this.next();
        if (kw === "matches") {
          // matches regex "..."
          if (this.peek().type === "ident" && this.peek().value.toLowerCase() === "regex") {
            this.next();
          }
          const right = this.parsePrimary();
          return { kind: "bin", op: "matches", left, right };
        }
        if (kw === "between") {
          // between (lo .. hi)
          this.expect("lparen");
          const lo = this.parseAddSub();
          this.expect("dotdot");
          const hi = this.parseAddSub();
          this.expect("rparen");
          return { kind: "bin", op: "between", left, right: { kind: "between", lo, hi } };
        }
        if (kw === "in" || kw === "!in" || kw === "in~" || kw === "!in~") {
          this.expect("lparen");
          const items: Expr[] = [];
          if (this.peek().type !== "rparen") {
            items.push(this.parseAddSub());
            while (this.peek().type === "comma") {
              this.next();
              items.push(this.parseAddSub());
            }
          }
          this.expect("rparen");
          return { kind: "bin", op: kw, left, right: { kind: "list", items } };
        }
        if (kw === "has_any" || kw === "has_all") {
          this.expect("lparen");
          const items: Expr[] = [];
          if (this.peek().type !== "rparen") {
            items.push(this.parseAddSub());
            while (this.peek().type === "comma") {
              this.next();
              items.push(this.parseAddSub());
            }
          }
          this.expect("rparen");
          return { kind: "bin", op: kw, left, right: { kind: "list", items } };
        }
        const right = this.parseAddSub();
        return { kind: "bin", op: kw, left, right };
      }
    }
    return left;
  }
  parseAddSub(): Expr {
    let left = this.parseMulDiv();
    while (this.peek().type === "operator" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      left = { kind: "bin", op, left, right };
    }
    return left;
  }
  parseMulDiv(): Expr {
    let left = this.parsePrimary();
    while (this.peek().type === "operator" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const right = this.parsePrimary();
      left = { kind: "bin", op, left, right };
    }
    return left;
  }
  parsePrimary(): Expr {
    const t = this.peek();
    if (t.type === "lparen") {
      this.next();
      const e = this.parseExpr();
      this.expect("rparen");
      return e;
    }
    if (t.type === "string") {
      this.next();
      return { kind: "lit", value: t.value };
    }
    if (t.type === "number") {
      this.next();
      return { kind: "lit", value: parseFloat(t.value), raw: t.value };
    }
    if (t.type === "timespan") {
      this.next();
      return { kind: "timespan", ms: parseTimespan(t.value), raw: t.value };
    }
    if (t.type === "ident") {
      this.next();
      if (this.peek().type === "lparen") {
        this.next();
        const args: Expr[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseExpr());
          while (this.peek().type === "comma") {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.expect("rparen");
        return { kind: "call", name: t.value, args };
      }
      // special idents
      const low = t.value.toLowerCase();
      if (low === "true") return { kind: "lit", value: true };
      if (low === "false") return { kind: "lit", value: false };
      if (low === "null") return { kind: "lit", value: null };
      return { kind: "col", name: t.value };
    }
    throw new Error(`Unexpected token '${t.value}' at char ${t.pos}`);
  }
}

export function parse(text: string): Pipeline {
  const tokens = tokenise(text);
  const parser = new Parser(tokens);
  return parser.parsePipeline();
}
