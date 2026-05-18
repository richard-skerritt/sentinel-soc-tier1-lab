// Copyright © 2026 Richard Skerritt. All rights reserved.
// See LICENSE for permitted use terms.
import { useMemo, useState, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  columns: string[];
  rows: any[];
  maxHeight?: number;
  onCellClick?: (col: string, value: any, row: any) => void;
  emptyMessage?: string;
  variant?: "default" | "azure";
}

export function ResultsTable({
  columns,
  rows,
  maxHeight = 320,
  onCellClick,
  emptyMessage = "No rows",
  variant = "default",
}: Props) {
  const isAzure = variant === "azure";
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const out = [...rows].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const an = typeof av === "number" ? av : Date.parse(av);
      const bn = typeof bv === "number" ? bv : Date.parse(bv);
      if (!isNaN(an) && !isNaN(bn)) return sort.dir === "asc" ? an - bn : bn - an;
      const sa = String(av);
      const sb = String(bv);
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return out;
  }, [rows, sort]);

  if (!columns?.length) {
    return (
      <div className="text-xs text-muted-foreground py-4 text-center bg-background/50 border border-border rounded">
        {emptyMessage}
      </div>
    );
  }

  if (isAzure) {
    return (
      <div
        className="border border-[#1f2d4a] rounded overflow-auto scrollbar-thin"
        style={{ maxHeight, backgroundColor: "#0b1120" }}
      >
        <table className="w-full text-xs mono">
          <thead
            className="sticky top-0 z-10 border-b border-[#1f2d4a]"
            style={{ backgroundColor: "#0e1527" }}
          >
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  onClick={() => {
                    if (sort?.col === c) setSort({ col: c, dir: sort.dir === "asc" ? "desc" : "asc" });
                    else setSort({ col: c, dir: "asc" });
                  }}
                  className="text-left px-3 py-2 cursor-pointer hover:bg-[#1a2436] select-none whitespace-nowrap text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "#8a9ab5" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {c}
                    {sort?.col === c && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-6 text-[#8a9ab5]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.slice(0, 1000).map((row, i) => (
                <tr key={i} className="border-b border-[#1f2d4a]/60 hover:bg-[#1a2436] text-[#cbd5e1]">
                  {columns.map((c) => {
                    const v = row[c];
                    const txt = renderCell(v);
                    return (
                      <td
                        key={c}
                        onClick={() => onCellClick?.(c, v, row)}
                        className={`px-3 py-1.5 align-top whitespace-nowrap max-w-[400px] truncate ${
                          onCellClick ? "cursor-pointer hover:text-[#4faaff]" : ""
                        }`}
                        title={String(v ?? "")}
                        data-testid={`cell-${c}-${i}`}
                      >
                        {txt}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      className="border border-border rounded overflow-auto scrollbar-thin bg-background"
      style={{ maxHeight }}
    >
      <table className="w-full text-xs mono">
        <thead className="sticky top-0 bg-card border-b border-border z-10">
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                onClick={() => {
                  if (sort?.col === c) setSort({ col: c, dir: sort.dir === "asc" ? "desc" : "asc" });
                  else setSort({ col: c, dir: "asc" });
                }}
                className="text-left px-3 py-2 font-semibold text-primary cursor-pointer hover:bg-muted/30 select-none whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1">
                  {c}
                  {sort?.col === c && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.slice(0, 1000).map((row, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/10">
                {columns.map((c) => {
                  const v = row[c];
                  const txt = renderCell(v);
                  return (
                    <td
                      key={c}
                      onClick={() => onCellClick?.(c, v, row)}
                      className={`px-3 py-1.5 align-top whitespace-nowrap max-w-[400px] truncate ${
                        onCellClick ? "cursor-pointer hover:text-primary" : ""
                      }`}
                      title={String(v ?? "")}
                      data-testid={`cell-${c}-${i}`}
                    >
                      {txt}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(v: any): ReactNode {
  if (v == null) return <span className="text-muted-foreground">·</span>;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
