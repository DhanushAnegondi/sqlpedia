# SQLpedia — implementation plan

Companion to `CLAUDE.md` (the contract). Each phase lists tasks, the model tier per the
global rules, the skills to load, and the check that closes it. Run phases in order; each
phase ends with a reviewer pass (loaded with `ledger/reviewer-brief.md`) and a ledger update.

## Phase 0 — scaffold
- `package.json` (no dependencies needed; `"type": "module"`, scripts `import`, `serve`).
- `.claude/launch.json` entry `sqlpedia`: `python -m http.server 8130 --directory site`.
- Empty `site/` skeleton, `sets/`, `mysql/`, `sets-meta/`.
- Tier: Haiku. Skills: none.
- Done when: `npm run serve` serves a placeholder page.

## Phase 1 — content pipeline
1. `scripts/import.mjs <source-dir> <set-id>` — parse `QUESTIONS.md`, `setup.sql`,
   `solutions.sql` per the parse rules in `CLAUDE.md`; merge `mysql/<set-id>/solutions.sql`
   and `sets-meta/<set-id>.json`; write `site/data/<set-id>.json` and rebuild `index.json`.
   Fail loudly (non-zero exit, message naming the problem id) on any unparsed block, a
   problem with no expected output and no `@noeq`, or a MySQL port missing a marker.
   Tier: Sonnet.
2. `mysql/shoplite/solutions.sql` — port all 30 (+5a/5b) from Postgres. Tier: Sonnet;
   Opus for Q19, Q20, Q28, Q30 if the first port looks wrong. Skill: `port-to-mysql`,
   `data:sql-queries`.
3. `sets-meta/shoplite.json` — tags + dialect notes from the question text. Tier: Sonnet.
- Done when: import exits 0; JSON has 30 problems, Q5 has parts a/b, Q4 keeps its
  "rows to delete" table and the "11 customers left" note, 4 tables with 13/8/38/54 rows.
- User check (optional, recommended): run `starter_pac/setup.sql` and a few ports in
  Workbench (Q11, Q20, Q28, Q30), confirm they match the expected output.

## Phase 2 — shell (Vector 2022 skin)
- Port tokens, header, sidebar ("Main menu"), sticky TOC, wikitable, notice boxes, light/dark
  toggle from `wikistyle-demo` / `dhanuspedia`.
- Hash router: `#/`, `#/set/<id>`, `#/p/<set>/<slug>`, `#/category/<name>`, `#/all`,
  `#/random`, `#/progress`, `#/search?q=`.
- Header: logo + name, search box, section dropdown (sets -> tiers -> topics, Progress,
  Random), theme toggle.
- Tier: Sonnet. Skills: `impeccable` (shape), `website/library/03-layout-systems`,
  `05-typography-color`, `09-responsive-foundations`.
- Done when: every route renders a stub inside the skin at 1280px and 375px, both themes.

## Phase 3 — content pages
- Problem article (all sections in `CLAUDE.md` "Problem page"), infobox, hatnote, copy
  buttons, reveal-gated solutions with highlight.js, trap callouts, Postgres original fold,
  prev/next navbox.
- Dataset article with mermaid ER diagram and all tables.
- Main page, category pages, all-pages list with filters, search, random.
- Tier: Sonnet (problem article: Sonnet with an Opus review). Skills: `impeccable`,
  `website/library/08-ui-states-feedback` (empty / copied / revealed states).
- Done when: all 30 problems render with no raw Markdown, expected tables match the source,
  copy buttons put exact SQL on the clipboard.

## Phase 4 — practice tracker
- `state.js`: store contract from `CLAUDE.md`, try/catch, export/import.
- Status bar on each problem: Mark completed (form: answer SQL, note), Mark attempted, undo.
- Progress page: heatmap, current/longest streak, solved per set and tier, recent
  completions list, export/import.
- Status shown in infobox, all-pages list (filter), category lists, main page.
- Tier: Sonnet. Skills: `dataviz` (heatmap color steps, tooltip, legend), `emil-design-eng`
  (small feedback details, kept MediaWiki-flat).
- Done when: completing a problem updates heatmap, streak and lists without reload; data
  survives reload; export -> clear storage -> import restores everything.

## Phase 5 — polish and audit
- Responsive pass (sidebar collapses to a menu button, tables scroll horizontally inside
  their own container, no page-level horizontal scroll at 375px).
- Accessibility: contrast both themes, focus rings, keyboard path through dropdown, TOC,
  reveal, copy, mark-completed form.
- Tier: Sonnet. Skills: `web-design-guidelines` (audit), `impeccable` (harden).
- Done when: audit findings fixed or logged with reason.

## Phase 6 — verification and handoff
- `verify-site` skill: serve, walk every route, both themes, two widths, console clean.
- `code-review` on the whole tree.
- `handoff` to close the session.
- Tier: Sonnet (reviewer Opus for the final pass).

## Later (not v1)
- Adding sets: `add-problem-set` skill.
- Running SQL inside the site (local MySQL via a small Node server) — deliberately out of
  scope; the user runs queries in Workbench.
