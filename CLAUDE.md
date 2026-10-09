# SQLpedia — build brief

A static SQL interview-practice site (GitHub Pages: https://dhanushanegondi.github.io/sqlpedia/).
Problems come with their own tables and a DataLemur-style workspace — tabs Question / Solution / Notes /
Submissions on the left, an editor with Run and Submit on the right. SQL runs in the browser (DuckDB-WASM)
through a translator that accepts MySQL 8.0 or SQL Server syntax. A Handbook explains every topic with
annotated syntax and runnable examples. Progress lives in the browser.

This file is the contract. Global rules (ledger, loop, model tiers) come from `~/.claude/CLAUDE.md`.
Task board: `ledger/TASKS.md`. Content formats: `content/SCHEMA.md`. Project skills: `.claude/skills/`.

## What "done" means (current phase)
- [x] Workspace: Question (statement, tables, expected output, hints, MySQL note), Solution (reveal-gated,
      approaches, common wrong answers, Postgres original for ShopLite), Notes (memory joggers, related
      Handbook pages, checklist), Submissions (history, load into editor, mark solved / attempted / undo).
- [x] Editor: MySQL / SQL Server switch, drafts saved per problem and dialect, Ctrl+Enter run,
      Ctrl+Shift+Enter submit, verdict with missing / unexpected row diff, resizable split.
- [x] Library: rail (collection, status) + filter bar (difficulty toggles, topic dropdown, multi-select), section
      headings inside a collection — no clutter.
- [x] Handbook: 29 pages in 5 groups, dialect switch, every argument annotated, editable runnable examples,
      outputs verified on MySQL 8.0.
- [x] Home, Progress (heatmap, streaks, by collection / difficulty, log, export / import), dataset pages
      for ShopLite / Campus.
- [x] Every reference solution and every handbook example passes on real MySQL and in the browser engine.
- [ ] Reviewer pass findings applied; deployed.

## Two versions
- New site at `/sqlpedia/` (`site/`), classic Wikipedia-skin site at `/sqlpedia/classic/` (`site/classic/`,
  restored from commit 3f3bb4f). They link to each other.
- The classic site reads the legacy set files that `scripts/build_content.mjs` copies to `site/classic/data/`
  (ShopLite + Campus only) and stores progress under `sqlpedia.classic.v1` (it copies `sqlpedia.v1` once on first
  visit, never writes it — its older store would drop the new site's submissions).
- The classic site is frozen: fix bugs there only if asked; new features go to the new site.

## Content
| Collection | Source | Problems | Tables |
|---|---|---|---|
| SQL Basics | `content/collections/basics/` (_meta + part-1..4, `section` per problem) | 48 | own per problem |
| Interview Patterns | `content/collections/patterns/` (_meta + part-a/b/c) | 48 | own per problem |
| Apple SDE – Data prep | `content/collections/apple.json` (from `Apple_prep/.sql_cheatsheet_validation/validated_bank.json` via `scripts/authoring/import_apple_bank.py`) | 60 | own per problem |
| Campus | `sets/campus/` (MySQL-native, `## Topic N` sections) | 31 | shared dataset |
| ShopLite | `starter_pac/` (read-only; Postgres originals, ports in `mysql/shoplite/`) | 30 | shared dataset |

Handbook: `content/handbook/<page>.json` + shared tables `content/handbook/_dataset.json`.

Rules:
- Expected outputs are never typed. `python scripts/verify/fill_expected.py <file>` runs the SQL on a
  throwaway MySQL 8.0.39 (127.0.0.1:33079) and writes `expected` back. Then
  `node scripts/verify/content_check.mjs <file>` runs MySQL and T-SQL through the browser engine.
- Anything visible before Reveal (statement, hints, notes, MySQL notes, starter query) may warn about a
  difference or name the pattern family, never the solution technique. (lessons.md)
- Original wording only — never copy DataLemur / LeetCode questions, names or data.
- Source sets (`starter_pac/`, `sets/<id>/`) are read-only; ShopLite/Campus parsing rules are in
  `scripts/import.mjs` (sections `## Tier X — …` or `## Topic N — …`, `### Q<n> · title`, `<details>` folds,
  `-- @Q<n>` solution markers, `-- TRAP`, `-- @noeq`).

## Build and verify
```
npm run import     # scripts/import.mjs (legacy sets -> .build/legacy) + scripts/build_content.mjs -> site/data/
npm run serve      # http://localhost:8130
npm run verify     # real MySQL (verify_mysql.py) + engine (engine_check.mjs) for ShopLite / Campus
```
`site/data/` (catalog.json, c/<collection>.json, h/<page>.json) is generated, gitignored, and rebuilt by the
GitHub Actions workflow on every push to `main`.

Throwaway MySQL for verification (never the user's MySQL80 service):
`mysqld --no-defaults --initialize-insecure --datadir=<dir>` once, then
`mysqld --no-defaults --datadir=<dir> --port=33079 --bind-address=127.0.0.1 --mysqlx=OFF`.

## Architecture
```
site/
  index.html                 shell: top bar (Problems, Handbook, Progress), search, streak, theme
  css/app.css                design tokens (light/dark), app shell, workspace, handbook reading layout
  js/app.js                  hash router, search, theme, copy
  js/data.js                 catalog / collection / handbook loaders, topic families
  js/state.js                progress store (localStorage "sqlpedia.v1")
  js/util.js                 esc, md (fences, tables, lists), SQL highlighter, dataTable, icons, dates
  js/ui/editor.js            textarea + highlight overlay editor
  js/engine/translate.js     MySQL / T-SQL -> DuckDB (raises TranslateError for unsupported syntax)
  js/engine/duck.js          duckdb-wasm 1.32.0 loader, fresh schema per run, Arrow -> MySQL-style strings
  js/engine/judge.js         multiset compare with numeric tolerance
  js/engine/fixtures.js      per-problem tables -> DDL + INSERT
  js/views/                  home, library, workspace, handbook, progress, dataset, common
```
Routes: `#/`, `#/problems?c=&topic=&d=&s=&q=`, `#/p/<collection>/<slug>[/solution|notes|submissions]`,
`#/handbook`, `#/handbook/<page>[#section]`, `#/handbook/dataset`, `#/data/<collection>`, `#/progress`.

### Engine notes
- Session settings mimic MySQL / SQL Server: NULLs sort lowest, case-insensitive comparisons and LIKE.
- DATE + INTERVAL returns a TIMESTAMP in DuckDB; all-midnight timestamp columns display as dates.
- SQL Server is emulated: integer ÷ integer and AVG of ints return decimals (real SQL Server truncates) —
  shown as a note in the UI. Known unsupported: REGEXP, PATINDEX, variables / temp tables, multi-table
  DELETE, named time zones, TOP ... PERCENT.
- When a writer or user hits a gap, fix it in `translate.js` and re-run `engine_check.mjs` + `content_check.mjs`.

### Progress store
`{ version: 1, problems: { "<collection>/<id>": { status, completed_at, revealed, note, answer_sql,
history: [{ at, action }], submissions: [{ at, verdict, dialect, sql, ms }] } }, days: { "YYYY-MM-DD":
{ completed: [key], attempted: [key] } } }`. Local-time day keys. Streak = consecutive days with any
practice. Normalised on load and import. Testing must never write to a real user's store — call the
engine directly or snapshot / restore localStorage.

## Design
Clean app shell (system sans, one blue accent, difficulty colours only on pills, light / dark tokens) and a
calm Wikipedia-style reading layout for the Handbook (serif headings, left page nav, right section TOC).
WCAG AA, visible focus, keyboard reachable, reduced motion respected, no page overflow at 375px.
CDN: only `mermaid@10.9.1` and `@duckdb/duckdb-wasm@1.32.0` from jsdelivr, exact versions.

## Hard rules
- Never show a solution before the user asks (Reveal).
- Source sets read-only; generated data never hand-edited.
- No backend; only the two pinned CDN libraries.
- Commit or push only when the user asks. Sentence-case headings; no emoji in committed files.
