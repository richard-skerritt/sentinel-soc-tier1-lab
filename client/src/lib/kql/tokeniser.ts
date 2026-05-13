// KQL tokeniser — emits a stream of tokens that the parser consumes.

export type TokenType =
  | "ident"
  | "number"
  | "string"
  | "timespan"
  | "operator"
  | "pipe"
  | "lparen"
  | "rparen"
  | "comma"
  | "dotdot"
  | "comment"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const MULTI_CHAR_OPERATORS = [
  "==",
  "!=",
  ">=",
  "<=",
];

const SINGLE_OPERATORS = "=<>+-*/";

export function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const N = text.length;

  while (i < N) {
    const c = text[i];

    // Whitespace
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // Comments — // until newline
    if (c === "/" && text[i + 1] === "/") {
      const start = i;
      while (i < N && text[i] !== "\n") i++;
      tokens.push({ type: "comment", value: text.slice(start, i), pos: start });
      continue;
    }

    // Pipe
    if (c === "|") {
      tokens.push({ type: "pipe", value: "|", pos: i });
      i++;
      continue;
    }

    // Parens, comma
    if (c === "(") {
      tokens.push({ type: "lparen", value: "(", pos: i });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: ")", pos: i });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ type: "comma", value: ",", pos: i });
      i++;
      continue;
    }

    // Range ..
    if (c === "." && text[i + 1] === ".") {
      tokens.push({ type: "dotdot", value: "..", pos: i });
      i += 2;
      continue;
    }

    // Strings — " or '
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      let value = "";
      while (i < N && text[i] !== quote) {
        if (text[i] === "\\" && i + 1 < N) {
          const next = text[i + 1];
          if (next === "n") value += "\n";
          else if (next === "t") value += "\t";
          else if (next === "r") value += "\r";
          else value += next;
          i += 2;
        } else {
          value += text[i];
          i++;
        }
      }
      i++; // closing quote
      tokens.push({ type: "string", value, pos: start });
      continue;
    }

    // Numbers (and timespan literals)
    if ((c >= "0" && c <= "9") || (c === "-" && text[i + 1] >= "0" && text[i + 1] <= "9")) {
      const start = i;
      if (c === "-") i++;
      while (i < N && ((text[i] >= "0" && text[i] <= "9") || text[i] === ".")) {
        i++;
      }
      // timespan suffix?
      if (i < N && /[a-zA-Z]/.test(text[i])) {
        // could be timespan: ms, s, m, h, d
        const suffStart = i;
        while (i < N && /[a-zA-Z]/.test(text[i])) i++;
        const suffix = text.slice(suffStart, i);
        if (["ms", "s", "m", "h", "d"].includes(suffix)) {
          tokens.push({ type: "timespan", value: text.slice(start, i), pos: start });
          continue;
        } else {
          // not a timespan — rewind and treat as number then identifier
          i = suffStart;
          tokens.push({ type: "number", value: text.slice(start, i), pos: start });
          continue;
        }
      }
      tokens.push({ type: "number", value: text.slice(start, i), pos: start });
      continue;
    }

    // Multi-char operators
    let matched = false;
    for (const op of MULTI_CHAR_OPERATORS) {
      if (text.startsWith(op, i)) {
        tokens.push({ type: "operator", value: op, pos: i });
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Single-char operators
    if (SINGLE_OPERATORS.includes(c)) {
      tokens.push({ type: "operator", value: c, pos: i });
      i++;
      continue;
    }

    // Identifiers (and tilde-suffixed idents like in~, !in~)
    if (/[a-zA-Z_!]/.test(c)) {
      const start = i;
      if (c === "!") i++;
      while (i < N && /[a-zA-Z0-9_]/.test(text[i])) i++;
      // allow trailing ~ for case-insensitive ops
      if (i < N && text[i] === "~") i++;
      const value = text.slice(start, i);
      if (value.length === 1 && value === "!") {
        tokens.push({ type: "operator", value: "!", pos: start });
      } else {
        tokens.push({ type: "ident", value, pos: start });
      }
      continue;
    }

    // Unknown char — skip
    i++;
  }

  tokens.push({ type: "eof", value: "", pos: N });
  return tokens.filter((t) => t.type !== "comment");
}
