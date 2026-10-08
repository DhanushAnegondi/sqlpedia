# SQLpedia — build brief

A local website that looks and behaves like Wikipedia (Vector 2022 skin), where every article
is a SQL interview problem. It is a reading platform: statement, schema, input data and
expected output rendered properly, plus a LeetCode-style practice tracker. Queries are
written and run by the user in MySQL Workbench against their local MySQL 8.0 — the site does
not execute SQL.

This file is the contract for every build session. Global rules (ledger, loop, model tiers)
come from `~/.claude/CLAUDE.md`. Phased build: `PLAN.md`. Project skills: `.claude/skills/`.

## Why this exists
- Problem sets arrive as Markdown (`starter_pac/QUESTIONS.md`). Reading pipes and dashes in an
  editor is unpleasant. The site turns each question into a clean article with real tables.
- Sets today: **ShopLite** (`starter_pac/`, 30 problems, difficulty tiers, Postgres originals
  ported to MySQL) and **Campus** (`sets/campus/`, 31 problems, university domain, grouped by
  interview pattern, authored natively in MySQL 8.0). Adding a set must be "drop a folder,
  run one command", never editing app code.

## Definition of done (v1)
- [ ] Wikipedia look: Vector 2022 layout, typography, colors, light and dark mode.
- [ ] Section navigation: left "Main menu" sidebar plus a section dropdown in the header
      (sets, tiers, topics, Progress, Random problem). Works at phone width.
- [ ] Problem article: statement, schema, input data, expected output, hints, solutions —
      rendered as proper tables and diagrams, never Markdown pipes or ASCII lines.
- [ ] Copy buttons for the dataset `setup.sql` and every solution, so pasting into Workbench
      is one click.
- [ ] Solutions shown in MySQL 8.0 dialect (ported from the Postgres originals), hidden until
      revealed.
- [ ] Practice tracker: "Mark as completed" per problem (optional pasted answer + note),
      activity heatmap of practice days, current and longest streak, solved count per set and
      tier, per-problem status.
- [ ] Adding a second set needs zero changes to app code.
- [ ] Verified in a served browser session: every page, both themes, 1280px and 375px,
      console clean.

## Environment (verified 2026-10-07)
- MySQL Community Server 8.0.39 (service `MySQL80`), Workbench and MySQL Shell 8.0 — the
  user's execution environment. Node 24.16.0 (importer only), Python 3.11 (static server).
- MySQL 8.0 has window functions, `WITH RECURSIVE`, `LATERAL`; it lacks `PERCENTILE_CONT`,
  `generate_series`, `FILTER`, `DATE_TRUNC`, `DISTINCT ON`, and `||` means OR.

## Source content (read-only)
`starter_pac/` is set 1 ("ShopLite"). Never edit these files; parse them.

| File | Holds | Parse rules |
|---|---|---|
| `QUESTIONS.md` | Intro, ER diagram (mermaid), table summary, conventions, planted traps, "do these 10 first", questions grouped in sections | Section = `## Tier X — …` (difficulty) or `## Topic N — …` (pattern); the word sets the set's `group_kind`, and the UI labels Topic sections by their title. Problem = `### Q<n> · <title>` + optional `` `≈ LC <n>` ``. Statement = text until the first `<details>`. `<summary>Hint</summary>` = hint. `<summary>Expected…</summary>` = expected output; may repeat (`Expected (a)`, `Expected (b)`). Prose after a table inside the fold = note. `NULL` cell = SQL NULL. |
| `setup.sql` | DDL + inserts, 4 tables | Runs as-is in MySQL. Parse `CREATE TABLE` for schema (column, type, PK/FK, inline `--` comment as note) and `INSERT` rows for the input-data tables. |
| `solutions.sql` | PostgreSQL solutions keyed `-- @Q1` … `-- @Q30`, parts `-- @Q5a/b` | Block = marker to next marker. Approaches split on `-- (a)` / `-- (b)`. `-- @noeq` = DML/no single result (Q4). `-- TRAP` = common wrong answer (callout, never the answer). Shown only as a collapsed "PostgreSQL original". |

MySQL versions of Postgres solutions live in `mysql/<set-id>/solutions.sql`, same markers,
written with the `port-to-mysql` skill. A set with no `mysql/<set-id>/` folder is
**MySQL-native**: its own `solutions.sql` is the MySQL answer and there is no Postgres fold.

### Authoring a new MySQL-native set
- Write `setup.sql` and `solutions.sql` (MySQL 8.0) in `sets/<set-id>/`, plus a generator
  like `scripts/authoring/gen_campus.py` holding statements, hints and a DuckDB twin of each
  reference query. The generator runs the twins on `setup.sql` and writes `QUESTIONS.md`,
  so every expected table comes from execution, never from hand-typing.
- Keep the twin logically identical to the MySQL answer; only dialect differs (`DATEDIFF` →
  date subtraction, `GROUP_CONCAT` → `string_agg`, `DATE_SUB(d, INTERVAL n DAY)` → `d - n`).
  Cast rounded values to DECIMAL so they print like MySQL (`3.70`, not `3.7`).
- Check rounding at .x5 boundaries by hand: MySQL rounds DECIMAL exactly, DuckDB rounds DOUBLE.

## Architecture
Static site, no framework, no build step, no backend. Node runs only the importer.

```
SQL/
  CLAUDE.md  PLAN.md  package.json
  starter_pac/                  source set 1, ShopLite (read-only)
  sets/campus/                  set 2, Campus (MySQL-native)
  sets/<set-id>/                future sets, same 3 files
  scripts/authoring/            generators that compute expected outputs (DuckDB)
  mysql/<set-id>/solutions.sql  MySQL ports
  sets-meta/<set-id>.json       tags, dialect notes per problem (hand-written)
  scripts/import.mjs            source + port + meta -> site/data/<set-id>.json + index.json
  site/
    index.html                  single page, hash router
    css/wiki.css                Vector 2022 tokens + components
    js/app.js (router + shell) data.js state.js util.js mermaid.js
    js/views/ main.js problem.js set.js lists.js progress.js search.js parts.js
    data/                       generated, never hand-edited
  .claude/launch.json  .claude/skills/
  ledger/
```

Run: `python -m http.server 8130 --directory site` -> `http://localhost:8130`
(`.claude/launch.json` entry `sqlpedia`). Import all sets: `npm run import`.

### Generated data contract (do not drift)
`site/data/<set-id>.json`:
```
{ id, title, full_title, description_md, conventions_md, planted_traps[], essentials[],
  setup_sql, er_mermaid,
  tables: [{ name, columns: [{ name, type, pk, fk ("table.col"|null), nullable, note }], rows[][] }],
  problems: [{
    id ("Q1"), slug, number, title, tier, tier_title, lc_ref (string|null, e.g. "180 / 601"),
    statement_md, dialect_note_md (string|null), tables_used[], tags[], hints_md[],
    parts: [{ label ("" | "a" | "b"), expected: { columns[], rows[][] } | null, intro_md, note_md }],
    solutions: [{ part, noeq, intro_md, mysql: [{ label, sql, comment_md }],
                  traps: [{ label, sql, comment_md }], postgres_original }]
  }] }
```
`site/data/index.json`: `{ sets: [{ id, title, full_title, problem_count, tiers: [{ id, title }] }] }`.
Cell values are strings exactly as written in `QUESTIONS.md` / `setup.sql`; SQL NULL is `null`.
- `tables_used` = tables named in the MySQL solution SQL.
- `tags`, `dialect_note_md` come from `sets-meta/<set-id>.json`, written from the question
  text only. Dialect notes cover where the Postgres wording doesn't hold in MySQL (Q20
  `PERCENTILE_CONT`, Q28 `generate_series`, Q3/Q4 case-insensitive default collation, Q2
  `LIMIT` inside subqueries).
- `essentials` from the "Short on time? Do these N first" line.

### Practice tracker
- localStorage key `sqlpedia.v1`: `{ version: 1, problems: { "<set>/<id>": { status
  ("new"|"attempted"|"solved"), completed_at, answer_sql, note, revealed, history: [{ at,
  action ("completed"|"practiced"|"attempted"), note }] } }, days: { "YYYY-MM-DD": {
  completed: [key], attempted: [key] } } }`. Appearance prefs live in `sqlpedia.appearance`.
- "Practised again today" on a completed problem logs another practice (spaced review).
- "Mark as completed" opens a small form: optional pasted query, optional note. "Mark as
  attempted" exists too. Undo allowed.
- Day keys in local time, never UTC. Streak = consecutive days with any logged practice
  (completed or attempted); the current streak still counts if today is empty but yesterday isn't.
- Progress page: export JSON (download) and import (confirm before replace). Banner warns
  that clearing browser data deletes progress — export regularly. Every storage access in
  try/catch; the site renders fine with storage unavailable.

## Pages (Wikipedia mapping)
| Wikipedia | SQLpedia |
|---|---|
| Main Page | Featured problem (next unsolved essential), "Did you know…" (planted traps), "In the news" (streak, last completed), set portals |
| Article | Problem page |
| Tabs Article / Talk, Read / View history | Problem / Solutions (reveal-gated); History = your completions of this problem |
| Infobox | Set, tier, LC equivalent (plain text), tables used, tags, status, essential badge |
| Table of contents (sticky) | Statement, Schema, Input data, Expected output, Hints, Solutions |
| Category pages | One per tier and per tag |
| Special:AllPages | All problems, filter by set / tier / tag / status |
| Special:Random | Random unsolved problem |
| Special:MyContributions | Progress page |
| Dataset article | Per set: description, ER diagram, every table in full, conventions, traps, copyable `setup.sql` |
| Search box | Client-side over titles, tags, statement text |

Problem page:
- Hatnote: set conventions in one line + link to the dataset article + "Copy setup.sql".
- Lead = the statement, then the infobox (floats right on desktop; after the statement on
  phones so the question is the first thing read), then the MySQL note.
- Schema: one wikitable per used table (column, type, key, note) and the ER diagram.
- Input data: each used table as a collapsible wikitable (collapsed if over 15 rows), row
  count in the caption. NULL cells visibly marked (the planted traps are listed on the dataset
  page).
- Expected output: wikitable per part, note underneath.
- Hints: collapsed "show" boxes.
- Solutions: hidden until "Reveal" (confirm). MySQL approaches with copy buttons; traps as
  warning callouts; Postgres original collapsed.
- Status bar with Mark completed / attempted; prev / next navbox at the bottom.

## Design
Fidelity to Wikipedia beats taste. Don't turn it into a SaaS app.
- Port from `F:\Personal\Projects\wikistyle-demo\index.html` (self-contained Vector 2022
  clone) and `F:\Personal\Projects\dhanuspedia\src\assets\css\wiki.css` + layouts.
- Fonts: `sans-serif` body, Linux Libertine/Georgia serif headings, monospace code; content
  width ~46em.
- Own name and simple logo; never the Wikipedia wordmark, globe or the word "Wikipedia".
- New components (tracker bar, heatmap, copy buttons) look native to MediaWiki: flat,
  `#a2a9b1` borders, `#eaecf0` fills, `#3366cc` links, notice-box styling.
- SQL syntax highlighting: the built-in tokenizer in `site/js/util.js` (no library).
- Mermaid `10.9.1` from jsdelivr, lazy-loaded only on pages with a diagram, themed light and
  dark; falls back to the diagram source if offline.
- Heatmap: 53x7 grid, last 12 months, 4 steps of Wikipedia blue, tooltips, keyboard reachable.
- WCAG AA both themes, visible focus, keyboard reachable, reduced motion respected.
- CDN libraries from cdnjs or jsdelivr with exact pinned versions only. Today: mermaid only.

## Skills
Phase-by-phase mapping is in `PLAN.md`.
- Project (`.claude/skills/`): `port-to-mysql`, `add-problem-set`, `verify-site`.
- Design (`F:\Personal\Projects\frontend_designs\`): `skills/01-taste-and-craft/impeccable`,
  `skills/05-audit-and-redesign/web-design-guidelines`, `.claude/skills/emil-design-eng`,
  `website/library/` folders 03, 05, 08, 09.
- Installed: `data:sql-queries` (dialect help), `dataviz` (heatmap), `run` /
  `anthropic-skills:built-in-browser` (verification), `code-review`, `handoff`.
- Skip taste skills that fight a faithful clone (gpt-taste, high-end-visual-design,
  industrial-brutalist-ui, minimalist-ui).

## Reviewer must check
- Expected outputs match `QUESTIONS.md` cell for cell (spot-check 5, plus Q5, Q10, Q14, Q30).
- No content invented: titles, statements, numbers, LC refs from the source files.
- MySQL ports: no Postgres-only syntax left (`::`, `||`, `DATE_TRUNC`, `FILTER`,
  `PERCENTILE_CONT`, `generate_series`, `DISTINCT ON`, `USING` deletes). Ideally the user has
  run them in Workbench and confirmed the expected output (log the result in the ledger).
- Wikipedia fidelity at 1280px and 375px, light and dark; no brand assets.
- Heatmap local dates; streak correct across a missed day; export -> clear -> import restores.
- Console clean on every page; every CDN URL pinned.

## Hard rules
- Source sets are read-only. Generated JSON is never hand-edited — fix the importer.
- Solutions shown as the answer are MySQL 8.0; Postgres only as the collapsed original.
- No backend, no network calls besides pinned CDN libraries.
- Never show a solution before the user asks.
- Sentence-case headings, no emoji in committed files.
