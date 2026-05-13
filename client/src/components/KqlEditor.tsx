import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage, LanguageSupport, syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";

const KQL_KEYWORDS = [
  "where",
  "project",
  "extend",
  "summarize",
  "by",
  "sort",
  "order",
  "asc",
  "desc",
  "take",
  "limit",
  "top",
  "count",
  "distinct",
  "and",
  "or",
  "not",
  "in",
  "contains",
  "has",
  "has_any",
  "has_all",
  "startswith",
  "endswith",
  "matches",
  "regex",
  "between",
  "as",
  "isempty",
  "isnotempty",
  "true",
  "false",
  "null",
];

const KQL_FUNCTIONS = [
  "count",
  "dcount",
  "countif",
  "sum",
  "avg",
  "min",
  "max",
  "make_list",
  "make_set",
  "ago",
  "now",
  "bin",
  "datetime",
  "strlen",
  "tolower",
  "toupper",
  "extract",
  "parse_json",
  "iff",
  "iif",
  "tostring",
  "toint",
  "todouble",
];

const kqlMode = StreamLanguage.define({
  name: "kql",
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    // line comment
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    // strings
    if (stream.match(/^"([^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^'([^'\\]|\\.)*'/)) return "string";
    // timespan
    if (stream.match(/^-?\d+(\.\d+)?(ms|s|m|h|d)\b/)) return "atom";
    // numbers
    if (stream.match(/^-?\d+(\.\d+)?/)) return "number";
    // pipe
    if (stream.match("|")) return "operator";
    // operators
    if (stream.match(/^(==|!=|>=|<=|!in~|!in|in~|in|=|>|<|\+|-|\*|\/|!)/)) return "operator";
    // word
    const m = stream.match(/^[A-Za-z_][A-Za-z0-9_]*~?/);
    if (m) {
      const word = (m as RegExpMatchArray)[0].toLowerCase().replace(/~$/, "");
      if (KQL_KEYWORDS.includes(word)) return "keyword";
      if (KQL_FUNCTIONS.includes(word)) return "builtin";
      return "variableName";
    }
    stream.next();
    return null;
  },
});

const kqlHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#67e8f9" },
  { tag: t.string, color: "#86efac" },
  { tag: t.number, color: "#fbbf24" },
  { tag: t.atom, color: "#fbbf24" },
  { tag: t.comment, color: "#64748b", fontStyle: "italic" },
  { tag: t.operator, color: "#fbbf24" },
  { tag: t.standard(t.variableName), color: "#e2e8f0" },
  { tag: t.function(t.variableName), color: "#a78bfa" },
]);

interface KqlEditorProps {
  value: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  minHeight?: string;
  readOnly?: boolean;
}

export function KqlEditor({ value, onChange, onRun, minHeight = "120px", readOnly = false }: KqlEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onRunRef.current = onRun;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!ref.current) return;
    const view = new EditorView({
      parent: ref.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          indentOnInput(),
          highlightActiveLine(),
          new LanguageSupport(kqlMode),
          syntaxHighlighting(kqlHighlight),
          oneDark,
          EditorView.lineWrapping,
          EditorView.theme({
            "&": { fontSize: "13px", minHeight, background: "#0b1220" },
            ".cm-scroller": { fontFamily: "'JetBrains Mono', monospace" },
            ".cm-gutters": { background: "#0b1220", color: "#475569", border: "none" },
            ".cm-content": { caretColor: "#67e8f9" },
            ".cm-activeLine": { background: "rgba(103, 232, 249, 0.05)" },
            ".cm-activeLineGutter": { background: "rgba(103, 232, 249, 0.05)" },
          }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            {
              key: "Mod-Enter",
              run: () => {
                onRunRef.current?.();
                return true;
              },
            },
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              onChangeRef.current?.(u.state.doc.toString());
            }
          }),
          EditorView.editable.of(!readOnly),
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep external value in sync (e.g. when switching alerts)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={ref} className="kql-editor" data-testid="kql-editor" />;
}
