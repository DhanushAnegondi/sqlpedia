# Changes — 2026-10-07

- `sets/campus/` (setup.sql, solutions.sql, QUESTIONS.md) + `sets-meta/campus.json` + `scripts/authoring/gen_campus.py` — new MySQL-native set. Why: user asked for more problems, university domain, pattern-grouped.
- `scripts/import.mjs` — `## Topic N` sections (group_kind), MySQL-native sets (no mysql/ port -> source is MySQL, no Postgres fold).
- `site/js/*` — groupLabel/groupNoun; All-problems Section filter keyed set:tier; Set column; Postgres fold hidden when empty; dataset page de-ShopLite'd.
- Reviewer fixes: non-spoiler dialect notes (shoplite), state normalize() on load/import, escaped action/status, mermaid fallback escaped, copy double-click, heatmap tab stops, search highlight per segment.

- `site/` — full static app: Vector 2022 skin, hash router, problem article (statement, infobox, MySQL note, schema, input data, expected output, hints, practice bar, reveal-gated solutions w/ traps + Postgres original, see also, navbox, categories), dataset page with mermaid ER, all-problems with filters, categories, search, progress (heatmap, streaks, by-tier, log, export/import), main page. Why: PLAN.md phases 2-5.
- `CLAUDE.md` — contract synced to built data shape (lc_ref string, intro_md, noeq, nullable, store history/revealed, days {completed, attempted}, built-in highlighter instead of highlight.js).

- `mysql/shoplite/solutions.sql` — MySQL 8.0 ports. Notable: DATE_TRUNC->DATE_FORMAT, date-date->DATEDIFF, Q19 rn in separate CTE + DATE_SUB, Q20 two median approaches, Q27 +INTERVAL 30 DAY (date+30 is numeric in MySQL), Q28 recursive calendar, Q30 CAST CHAR(500)+CONCAT, Q4 safe-updates note.
- `sets-meta/shoplite.json` — tags + dialect notes.
- `scripts/import.mjs` — parser per CLAUDE.md rules; hard-fails on unplaced blocks. lc_ref is a string (Q19 is '180 / 601').
- `package.json`, `.claude/launch.json` (sqlpedia, port 8130).

- `CLAUDE.md` — build brief; final scope: static Wikipedia-skin reading site, MySQL 8.0 solutions, manual completion tracker. Why: user runs queries in Workbench, wants a viewing platform.
- `PLAN.md` — 7 phases with model tier, skills, done-checks.
- `.claude/skills/port-to-mysql` — Postgres -> MySQL 8.0 translation table + verification rule. Why: source solutions are Postgres.
- `.claude/skills/add-problem-set` — repeatable flow for future sets.
- `.claude/skills/verify-site` — browser verification checklist.
