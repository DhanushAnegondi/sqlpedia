# Reviewer brief — SQLpedia (redesign, 2026-10-09)

Project: static SQL interview-practice site (GitHub Pages). App shell + DataLemur-style problem workspace
(tabs Question / Solution / Notes / Submissions; editor with Run / Submit), Handbook of runnable examples with a
MySQL / SQL Server switch, progress tracker in localStorage. SQL runs in the browser on DuckDB-WASM through a
MySQL / T-SQL translator (`site/js/engine/translate.js`). Content: 4 collections (patterns 48, apple 60, campus 31,
shoplite 30) and 29 handbook pages; expected outputs come from real MySQL 8.0.39 (`scripts/verify/fill_expected.py`).

## Checks
- Spoilers: nothing visible before Reveal (statement, hints, notes, MySQL notes, starter query) states the solution technique. Notes may name the pattern family and generic syntax, never the full query.
- Content fidelity: Apple problems match `F:\Personal\Projects\Apple_prep\.sql_cheatsheet_validation\validated_bank.json`; ShopLite/Campus unchanged from their sources. No copied DataLemur/LeetCode wording in `content/collections/patterns/`.
- Engine correctness: translator rules produce MySQL / SQL Server semantics (argument order of DATEDIFF/CHARINDEX/LOCATE, CONCAT NULL behaviour, NULL sort order, LOG base, DAYOFWEEK numbering, integer division note). Anything unsupported must raise TranslateError, not silently differ.
- Judge: order-insensitive multiset compare, numeric tolerance, NULL handling, empty-result case, column-count mismatch.
- Security: everything rendered from content or user input goes through `esc`/`md`; no innerHTML of raw SQL results; localStorage import normalised.
- State: Submit Accepted marks solved; wrong answer = attempted; undo correct per day; local dates; old saves still load.
- UX: decluttered (no "See also", no big navbox); works at 375px with no page overflow; keyboard reachable tabs, split, editor shortcuts; dark mode tokens consistent.
- CDN: only mermaid@10.9.1 and @duckdb/duckdb-wasm@1.32.0 (jsdelivr), pinned.
