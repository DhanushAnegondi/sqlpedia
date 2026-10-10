# SQLpedia — task board

Single source of truth for what is done and what is left. Updated as work happens.
Newest status first in each section. Last updated: 2026-10-08 (session paused at user request).

How to resume: read this file, then `ledger/<latest date>/handoff.md`, then continue the first
unchecked item in "Pending". The throwaway MySQL used for verification starts with
`mysqld --no-defaults --datadir=<scratchpad>/mysql/data --port=33079 --bind-address=127.0.0.1 --mysqlx=OFF`
(if the scratchpad is gone: `mysqld --no-defaults --initialize-insecure --datadir=<new dir>` first).

## Goal of the current phase (redesign, requested 2026-10-08)
- DataLemur-style problem workspace: tabs Question / Solution / Notes / Submissions, editor with Run + Submit.
- In-browser SQL engine (DuckDB-WASM + MySQL / SQL Server translator), checked against real MySQL.
- New collections: Interview Patterns (original, per-question tables) and Apple SDE–Data prep (60).
- Handbook: one page per topic, annotated syntax, MySQL / SQL Server switch, runnable examples.
- Clean app look (top nav, decluttered), Handbook in a calm reading layout. Remove "See also" and the big navbox.

## Completed
- [x] 2026-10-09 Interview topic drills collection (93, T101-T612, 7 sections: joins inner/outer, joins self/anti/semi/range,
      ranking, aggregates and frames, value functions, CTEs, recursive CTEs), product-style settings. Verified real MySQL +
      node engine + in-browser WASM. Reviewer pass pending. Not committed.
- [x] 2026-10-09 SQL Basics collection (48, B001-B048, 8 sections) — user found the set too hard / window-heavy.
      Verified real MySQL + engine; reviewer FAIL on Notes spoilers -> fixed. Library filter bar (difficulty toggles,
      topic dropdown, multi-select) + section headings. Not committed yet.
- [x] 2026-10-09 Two versions (user request): classic Wikipedia site kept at /classic/ (site/classic/, own progress key,
      one-time copy of shared progress), new site at /. Cross-links both ways. Committed and pushed.
- [x] 2026-10-09 Reviewer pass (FAIL -> fixed): approach notes moved behind a fold; translator now matches MySQL for
      backslash escapes, || (= OR), WEEK mode 1, YEARWEEK mode 0, division by zero (NULL), SUBSTRING FROM/FOR, and
      T-SQL DATEDIFF(week); wrong-dialect syntax is rejected (DATEADD in MySQL, LIMIT / GROUP_CONCAT in SQL Server,
      ::, FILTER, QUALIFY, DATE_TRUNC ...). Router sequence guard + focus move, editor focus ring, tab arrow keys,
      handbook spy rebind, safe markdown links, error submissions = attempts, undo drops its submission.
      Re-verified: 230/230 solutions, 464 MySQL + 455 SQL Server handbook examples in the browser engine; real MySQL 0 issues.
- [x] 2026-10-09 New UI built (shell, library, workspace, handbook, progress, dataset pages). In the real browser
      engine: 230/230 reference solutions accepted, 461 MySQL + 452 SQL Server handbook examples pass (rest are
      documented SQL Server differences). No console errors; no page overflow at 1440px or 375px.
- [x] 2026-10-09 All writers finished. Verified on real MySQL (0 issues): Interview Patterns 48 (parts A/B/C), Apple 60,
      29 handbook pages / 534 examples. Browser engine: all pass; only 4 documented SQL Server differences remain.
- [x] 2026-10-09 Translator: text dates in date functions, SUBSTRING(s,0,n), CONVERT(DATE,'..',style), DATETRUNC(iso_week),
      GROUP_CONCAT(DISTINCT x ORDER BY x), TOP n WITH TIES (QUALIFY RANK()).
- [x] v1 site (Wikipedia skin), ShopLite 30 + Campus 31, tracker, deployed to GitHub Pages
      (https://dhanushanegondi.github.io/sqlpedia/, repo DhanushAnegondi/sqlpedia) — 2026-10-07/08
- [x] Real-MySQL verification: `scripts/verify/verify_mysql.py` — ShopLite 40/40, Campus 38/38 answers pass; all traps differ
- [x] Browser engine translator `site/js/engine/translate.js` (MySQL + T-SQL -> DuckDB) + `fixtures.js`
- [x] Engine check `scripts/verify/engine_check.mjs` — all 78 legacy answers pass through the translator
- [x] Content format spec `content/SCHEMA.md`; handbook shared dataset `content/handbook/_dataset.json`
- [x] Verifier `scripts/verify/fill_expected.py` (fills expected from real MySQL) + `scripts/verify/content_check.mjs` (engine, both dialects)
- [x] Apple bank -> `content/collections/apple.json` (60) — 60/60 on real MySQL and in the engine
- [x] Data build `scripts/build_content.mjs` -> `site/data/catalog.json`, `c/<id>.json`, `h/<id>.json`
- [x] Engine wrapper `site/js/engine/duck.js` (duckdb-wasm 1.32.0, fresh schema per run) and `judge.js`
- [x] New stylesheet `site/css/app.css`
- [x] Handbook pages: query-order, filtering (verified)
- [x] Patterns part B `content/collections/patterns/part-b.json` (16 window-function problems, verified)
- [x] Patterns part C `content/collections/patterns/part-c.json` (16 advanced / data-engineering problems, verified)
- [x] Handbook window pages: window-basics, window-frames, aggregate-windows, running-totals, rolling-windows, ranking (72 examples, verified)
- [x] Translator fixes from writer reports: INTERVAL with any expression (column, function, window), TIMESTAMPDIFF on text dates, PERIOD_DIFF/PERIOD_ADD, T-SQL recursive CTE without RECURSIVE, OPTION (MAXRECURSION) stripped — all legacy + content checks still pass
- [x] Rewritten `site/js/util.js` for the new UI (markdown with fences/tables/headings, dataTable, icons) — NOTE: old views still import the old helpers (wikitable etc.), so the current site/ is mid-migration and will not run until the new views exist

## In progress

## Pending
- [x] New UI: `site/index.html` shell (top nav: Problems, Handbook, Progress; search; theme)
- [x] Store: add submissions per problem to `site/js/state.js` (keep version 1, normalise old data)
- [x] Views: home (continue card, collections, handbook sections, mini heatmap)
- [x] Views: problem library (collections + topic families rail, difficulty/status filters, clean list)
- [x] Views: problem workspace (tabs, editor, Run, Submit, verdict + row diff, resizable split)
- [x] Views: handbook index + page (left page nav, right TOC, dialect switch, runnable examples)
- [x] Views: progress (heatmap, streaks, by collection, submissions log, export/import)
- [x] Views: dataset page for ShopLite / Campus (ER diagram, tables, setup.sql)
- [x] Remove old views (main, problem, set, lists, search, parts) and `css/wiki.css`
- [x] Markdown renderer: fenced code, pipe tables, headings (handbook prose needs them)
- [x] When writers finish: `npm run import`, run `content_check.mjs` on every content file, fix engine gaps
- [x] Browser verification (automated sweep done 2026-10-09; manual click-through by user still welcome): every route, light/dark, 1366px and 375px, Run/Submit, handbook Run in both dialects, console clean
- [x] Update `CLAUDE.md` (contract changed: in-site engine, app shell, collections, handbook) and `PLAN.md`
- [ ] Commit and push (only when the user asks) — GitHub Actions redeploys

## Decisions log
- 2026-10-08 In-browser engine = DuckDB-WASM 1.32.0 + translator; SQL Server results are emulated (integer division / AVG of ints differ — shown as a note).
- 2026-10-08 Look = clean app shell + Wikipedia-style reading for Handbook (user choice).
- 2026-10-08 Notion page not read (window minimised); used `Apple_prep/.sql_cheatsheet_validation/validated_bank.json` instead.
- 2026-10-07 Streak counts any logged practice (completed or attempted).

