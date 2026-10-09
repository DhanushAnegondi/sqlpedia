# Changes — 2026-10-09 (session 2)

## Plan
1. [Sonnet x4] Write content/collections/basics/part-1..4.json (12 problems each, B001-B048), verify on real MySQL + engine.
2. [lead] Build: optional `section` per problem; display order basics first; home/library pick it up.
3. [lead] Library: in-collection filter bar (difficulty toggles, topic toggles) + section headers.
4. [Sonnet reviewer] Review basics content against reviewer-brief (spoilers, determinism, beginner level).
5. [lead] npm run import, content_check, browser verify, update CLAUDE.md + TASKS.md.

## Done
- build_content.mjs: problems carry optional `section` (own-table collections + catalog summaries); display order basics first.
- home.js: basics first in "Start here"; collections grid auto-fills (5 collections).
- library.js: rail = Collection + Status; new filter bar above the list = difficulty toggles (multi, `d=Easy,Medium`)
  + Topics dropdown (families, multi, `topic=A,B`, OR semantics), facet counts exclude their own filter, Reset link;
  section headings with solved count when a collection has sections; scroll + focus kept while filtering.
  Old single-value links (`?topic=X`, `?d=Easy`) still work.
- app.css: .fbar / .ftog / .tpanel / .plist-sec / .g-coll.
- content/collections/basics/ (_meta + part-1..4): 48 beginner problems B001-B048, 8 sections, 36 Easy / 12 Medium.
  Verified: real MySQL 48/48 0 issues, engine 0 issues, strict build clean; legacy verify unchanged.
- Reviewer FAIL (Notes **Syntax:** lines were solution skeletons in 19 problems) -> replaced with generic syntax facts
  (B009 B012 B018 B019 B021 B023 B024 B026 B027 B031 B032 B034-B041). Re-verified. B048 section left as is.
