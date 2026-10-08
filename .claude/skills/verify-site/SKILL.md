---
name: verify-site
description: Serve SQLpedia and verify it in the built-in browser - every route, both themes, desktop and phone width, tracker round-trip, console clean. Use after any UI change and before closing a phase.
---

# Verify the site

1. Re-run the importer for every set so `site/data/` is current.
2. Start the server with `preview_start` name `sqlpedia` (port 8130).
3. At 1280px, light theme, visit: `#/`, a dataset page, `#/all` (try each filter), a tier
   category, a tag category, `#/search?q=window`, `#/random`, `#/progress`, and problem pages
   Q1, Q5 (two parts), Q10, Q25 (wide table), Q30.
4. On each problem page check: no raw Markdown or pipes, expected table matches
   `QUESTIONS.md`, hints collapse, solutions hidden until Reveal, copy buttons copy exact SQL,
   mermaid diagram renders.
5. Repeat the main page, Q25 and progress at dark theme, and at 375px (mobile preset): no
   page-level horizontal scroll, sidebar becomes a menu, tables scroll inside their box.
6. Tracker: mark Q1 completed with a note, confirm heatmap cell, streak, infobox status and
   all-pages filter update; reload, confirm it persisted; export, clear storage via
   `localStorage.clear()`, import, confirm restored; then restore the user's real state.
7. `read_console_messages` with onlyErrors on every page: must be empty.
8. Reset the viewport to desktop. Report each check as pass/fail with evidence; log failures
   to `ledger/<today>/errors.md`.

Never wipe the user's real progress without exporting it first.
