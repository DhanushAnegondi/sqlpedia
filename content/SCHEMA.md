# Content formats

Two kinds of authored content live under `content/`. Both are JSON, UTF-8, 2-space indent.
Writers produce SQL and prose; **expected outputs are never typed by hand** — they are filled
by `python scripts/verify/fill_expected.py <file>`, which runs the SQL on a real MySQL 8.0.39
server (127.0.0.1:33079, root, no password) and writes the results back into the file.

General rules for all SQL:
- MySQL 8.0 dialect for `sql` / `mysql` fields. SQL Server (T-SQL, 2019+) for `tsql` fields.
- Every query must be deterministic: always end with an `ORDER BY` that fully orders the
  output (break ties on an id), unless the result is a single row.
- Keep data tiny (3–15 rows per table) but plant the edge cases the question tests:
  NULLs, ties, duplicates, missing dates, same-day events, boundary timestamps.
- Plain ASCII in SQL. Dates as 'YYYY-MM-DD', timestamps as 'YYYY-MM-DD HH:MM:SS'.
- Column types: INT, BIGINT, DECIMAL(p,s), VARCHAR(n), DATE, DATETIME, BOOLEAN only.
- No stored procedures, variables, temp tables, `REGEXP`, or multi-table `DELETE`.
- Original wording only. You may be inspired by public question banks (patterns, topics), but
  never copy a question's text, names or data from DataLemur, LeetCode or any other site.

## 1. Problem collections — `content/collections/<id>.json`

```json
{
  "id": "patterns",
  "title": "Interview Patterns",
  "description_md": "One paragraph.",
  "problems": [
    {
      "id": "P001",
      "slug": "kebab-case-title",
      "title": "Short title",
      "difficulty": "Easy | Medium | Hard",
      "topics": ["Window functions", "Ranking"],
      "statement_md": "What to return, column names in `code`, the sort order. 2-5 sentences.",
      "tables": [
        {
          "name": "orders",
          "description_md": "One row per order. `coupon` may be NULL.",
          "columns": [ { "name": "order_id", "type": "INT" }, { "name": "amount", "type": "DECIMAL(10,2)" } ],
          "rows": [ [1, 20.5], [2, null] ]
        }
      ],
      "hints_md": ["A nudge, not the answer."],
      "notes_md": "Memory joggers for the Notes tab: which pattern family this is, the shape of the approach in words, syntax reminders (with tiny generic snippets), the classic trap. Must NOT contain the full solution query.",
      "solutions": [
        { "label": "Window function", "explain_md": "Why it works, 1-3 sentences.", "sql": "SELECT ... ORDER BY ...;" },
        { "label": "Self-join", "explain_md": "...", "sql": "..." }
      ],
      "traps": [
        { "explain_md": "What goes wrong and why.", "sql": "the common wrong query" }
      ],
      "expected": null
    }
  ]
}
```

- `topics` use this vocabulary (reuse, don't invent near-duplicates): Filtering, Sorting,
  Aggregation, Conditional aggregation, Joins, Self-joins, Anti-joins, Set operations,
  Subqueries, CTEs, Recursive CTEs, NULL handling, String functions, Numeric functions,
  Dates, Window functions, Ranking, Top N per group, Running totals, Rolling windows,
  Value functions, Period comparisons, NTILE, Gaps and islands, Sessionization,
  Deduplication, Pivoting, Cohorts, Funnels, Relational division, Data quality,
  Reconciliation, Incremental loads, Slowly changing dimensions, Hierarchies, Statistics.
- All `solutions` must return the same rows; `traps` must return something different.
- `expected` stays `null`; the verifier fills it.

## 2. Handbook pages — `content/handbook/<page-id>.json`

```json
{
  "id": "window-frames",
  "title": "Window frames",
  "group": "Window functions",
  "order": 2,
  "summary_md": "One or two sentences: what this page lets you do.",
  "sections": [
    {
      "id": "rows-vs-range",
      "heading": "ROWS vs RANGE",
      "body_md": "Explanation. Short paragraphs and bullet lists.",
      "syntax": {
        "mysql": "SUM(expr) OVER (PARTITION BY p ORDER BY o ROWS BETWEEN n PRECEDING AND CURRENT ROW)",
        "tsql": "same, or the SQL Server form"
      },
      "args": [
        { "name": "expr", "meaning": "The value being summed." },
        { "name": "n PRECEDING", "meaning": "How many rows before the current row to include." }
      ],
      "examples": [
        {
          "id": "rows-frame-3",
          "title": "3-row moving sum",
          "explain_md": "What to notice in the output.",
          "uses_dataset": true,
          "tables": [],
          "mysql": "SELECT ... ORDER BY ...;",
          "tsql": "SELECT ... ORDER BY ...;",
          "dialect_note_md": "Only when MySQL and SQL Server differ in syntax or result.",
          "expected": null
        }
      ],
      "pitfalls_md": ["Optional list of gotchas."]
    }
  ]
}
```

- `uses_dataset: true` means the example runs against the shared handbook dataset in
  `content/handbook/_dataset.json` (read it first; don't change it). Otherwise put the
  example's own tiny tables in `tables` (same shape as collections) or use only literals
  (`SELECT SUBSTRING('interview', 2, 4) AS piece;`).
- Every function you introduce gets a `syntax` block and an `args` entry per positional
  argument, saying exactly what each position means, in order.
- `tsql` is required unless the feature does not exist in SQL Server; then set it to
  `null` and say so in `dialect_note_md`.
- `expected` stays `null`; the verifier fills it from MySQL.

## Self-check before you finish

```bash
python scripts/verify/fill_expected.py content/collections/<id>.json   # or a handbook page
node scripts/verify/content_check.mjs content/collections/<id>.json     # browser-engine check
```

The first must report no errors (and all solutions agreeing, all traps differing). The second
runs MySQL and T-SQL through the in-browser engine; fix your SQL if MySQL fails there. A T-SQL
mismatch that is a real SQL Server difference (e.g. integer division) must be explained in
`dialect_note_md`; otherwise simplify the T-SQL.
