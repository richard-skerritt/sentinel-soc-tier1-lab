# KQL Engine — Implementation Spec

A simplified but real KQL-compatible query engine that runs over the JSON log datasets. Implemented client-side in TypeScript for instant query response.

## Supported syntax

```
<TableName>
| where <predicate> [and|or <predicate>]*
| project <col1>, <col2> [= <expr>]
| extend <col> = <expr>
| summarize <agg> [, <agg>]* [by <col1>, <col2>, ...]
| sort by <col> [asc|desc]
| order by <col> [asc|desc]
| top <N> by <col> [asc|desc]
| take <N>
| limit <N>
| count
| distinct <col>
```

### Predicates supported
- `col == "value"` / `col == number`
- `col != "value"`
- `col > N` / `col >= N` / `col < N` / `col <= N`
- `col contains "x"` (case-insensitive substring)
- `col has "x"` (case-insensitive whole-word/token match — implement as `\b<x>\b` regex case-insensitive)
- `col has_any (a, b, c)`
- `col has_all (a, b, c)`
- `col startswith "x"`
- `col endswith "x"`
- `col matches regex "pattern"`
- `col in (a, b, c)` / `col !in (a, b, c)`
- `col in~ (a, b, c)` (case-insensitive `in`)
- `col between (X .. Y)`
- `not(<predicate>)`
- `isempty(col)` / `isnotempty(col)`

### Aggregations (in summarize)
- `count()`
- `count() as Alias` or `Alias = count()`
- `dcount(col)` — distinct count
- `countif(predicate)`
- `sum(col)`
- `avg(col)`
- `min(col)` / `max(col)`
- `make_list(col)` / `make_set(col)`

### Functions (in extend / predicates / project)
- `ago(timespan)` — returns `Date.now() - parseTimespan(ts)`. Treat the dataset's "current time" as **2026-05-13T12:00:00Z** (frozen). So `ago(1h)` = `2026-05-13T11:00:00Z`.
- `now()` — same frozen time.
- `bin(col, timespan)` — bucket a timestamp to nearest timespan.
- `datetime(iso)` — parse an ISO timestamp literal.
- `strlen(col)`
- `tolower(col)` / `toupper(col)`
- `extract(regex, capture_group, col)`
- `parse_json(col)`
- `iff(predicate, then, else)`

### Timespan literals
- `1h`, `30m`, `5s`, `2d`, `7d`, `1ms`

### Comments
- `// line comment`

## Reference data
Load tables from `/api/logs/:tableName` (server reads `/home/user/workspace/sentinel-lab-v2/logs/<Name>.json`). Cache in memory client-side after first fetch.

## Parser approach
1. **Tokenise** — handle strings (`"..."`), numbers, identifiers, operators, punctuation, comments, timespan literals, pipe separator.
2. **Parse pipeline** — each `|` segment is an operator. Build a list of operator AST nodes.
3. **Evaluate** in order: start with `rows = table`, apply each operator transform.

## Implementation hint
Build as ~600 LOC in `client/src/lib/kql/` split:
- `tokeniser.ts`
- `parser.ts`
- `evaluator.ts`
- `functions.ts`
- `index.ts` — exports `runQuery(text: string, tables: Record<string, any[]>): { columns: string[]; rows: any[]; error?: string }`.

## Error messages
Mirror real KQL errors but plain-English:
- `Unknown table 'Foo'. Available: SigninLogs, DeviceProcessEvents, ...`
- `Unknown operator '|select' at character 23. Did you mean '|project'?`
- `Column 'IPAdresses' not found. Did you mean 'IPAddress'?` (Levenshtein <=2 suggestion)

## Result shape
```ts
{
  columns: ["TimeGenerated", "UserPrincipalName", "IPAddress"],
  rows: [
    { TimeGenerated: "...", UserPrincipalName: "...", IPAddress: "..." },
    ...
  ],
  executionMs: 12,
  totalRows: 1840,
  displayedRows: 100   // cap display at 1000 unless 'take' explicit
}
```

## UI binding
- KQL editor: Monaco or CodeMirror 6, dark theme, with simple syntax highlighting (keywords cyan, strings green, numbers amber, comments dim).
- "Run query" button (Ctrl/Cmd+Enter).
- Results table below — sortable columns, virtual-scroll for >100 rows.
- Show executionMs + totalRows in footer.
- Clickable cell values for pivoting: clicking a cell value opens "Pivot on this value" menu offering pre-filled queries against related tables.

## Test queries (must all run correctly)
- `SigninLogs | where IPAddress == "45.83.193.150" | summarize Attempts=count(), Users=dcount(UserPrincipalName), Successes=countif(ResultType == "0") by IPAddress`
- `DeviceProcessEvents | where InitiatingProcessFileName in~ ("WINWORD.EXE", "EXCEL.EXE") | where FileName has "powershell"`
- `OfficeActivity | where Operation == "FileDeleted" | summarize Count=count() by UserId, bin(TimeGenerated, 5m) | where Count > 100`
- `DeviceNetworkEvents | where RemoteIP == "185.220.101.42" | summarize Beacons=count(), TotalSent=sum(BytesSent) by bin(Timestamp, 5m) | sort by Timestamp asc`
- `SigninLogs | where UserPrincipalName == "j.harrington@contoso.com" | where TimeGenerated > ago(6h) | project TimeGenerated, IPAddress, City, ResultType | sort by TimeGenerated asc`
