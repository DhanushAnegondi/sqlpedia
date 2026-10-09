# Logs — 2026-10-08

- Deployed to GitHub Pages: repo DhanushAnegondi/sqlpedia (public, user choice), Pages build_type=workflow, `.github/workflows/deploy.yml` runs `npm run import` then publishes `site/`. First run green; live site verified (both sets, console clean). `site/data/` is gitignored and built in CI.
- Redesign request (DataLemur-style problem pane, Handbook, Apple bank, new pattern collection, in-browser engine). User chose: in-browser engine + clean app/wiki look.
- Notion page not read (window minimised); used local `Apple_prep/.sql_cheatsheet_validation/validated_bank.json` (60 problems, MySQL-verified earlier).
- Throwaway MySQL 8.0.39 on 127.0.0.1:33079 (scratchpad datadir, --initialize-insecure). `scripts/verify/verify_mysql.py`: ShopLite 40/40 + Campus 38/38 answers PASS on real MySQL; all traps differ.
- `site/js/engine/translate.js` (MySQL/T-SQL -> DuckDB) + `scripts/verify/engine_check.mjs`: all 78 answers PASS through translator + DuckDB CLI. duckdb-wasm pinned 1.32.0.
- Session interrupted mid-redesign; writers resumed via SendMessage (only query-order + filtering handbook pages had landed). Throwaway MySQL kept running (pid from 17:28).
- Apple bank -> content/collections/apple.json (60): fill_expected 0 issues on real MySQL; engine 60/60 after adding YEARWEEK mode 3 + CONVERT_TZ offsets.
- scripts/build_content.mjs: legacy sets (.build/legacy) + collections + handbook -> site/data/catalog.json, c/<id>.json, h/<id>.json.
- Patterns part B + C and 6 window handbook pages landed (verified). Translator gaps reported by writers fixed (INTERVAL expressions, TIMESTAMPDIFF text args, PERIOD_DIFF, T-SQL recursive CTE, OPTION hints); checks re-run clean.
- Created ledger/TASKS.md (task board) at user request. Session paused at user request (usage limit); handoff refreshed.

- Handbook pages written and verified (fill_expected 0 issues, content_check 0 mysql issues): subqueries, ctes, recursive-ctes, deduplication, pivot-unpivot. Engine gap: T-SQL recursive CTEs (no RECURSIVE keyword) fail in the browser engine; kept valid SQL Server syntax. fill_expected can report a transient "no result set" when parallel agents share the MySQL server; rerun.
- 2026-10-09 Resumed after limit. All writers done; full sweep on real MySQL (0 issues) and engine. Translator gaps fixed (text dates, SUBSTRING 0, CONVERT style, DATETRUNC iso_week, GROUP_CONCAT DISTINCT ORDER BY, TOP WITH TIES). Duplicate slug fixed (P213).
- New UI written and verified in the browser (230/230 solutions accepted via WASM; handbook both dialects). Mobile overflow fixes. Accidentally recorded a test submission in the user's localStorage — removed, lesson logged. CLAUDE.md rewritten for the new contract; PLAN.md now points to TASKS.md. Reviewer agent running.
- 2026-10-09 Reviewer FAIL items fixed (notes fold, translator fidelity + dialect rejection, router/a11y/state bugs). Browser sweep clean. Awaiting user go-ahead to commit/push.
- 2026-10-09 User approved push, then asked to keep both versions. Classic restored to site/classic/ (from 3f3bb4f), separate progress key, data copied by build_content.mjs, cross-links. Verified locally, then committed and pushed.
