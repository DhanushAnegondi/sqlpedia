# Logs — 2026-10-09 (session 2)

## Session 3
- New request: separate interview drills on joins, window functions (all sub-topics), value functions, CTEs, recursive CTEs, 2-3 per sub-topic.
- Decision: one new collection `drills` (93 problems, 7 sections = parts) instead of 5 collections, to keep the library rail uncluttered; sections give the per-topic split. Brief: drills-brief.md.
- Throwaway MySQL restarted on 33079. _meta.json written; build ORDER puts drills second.
- User: data must be fresh consumer-tech settings (Twitter, Netflix, Amazon, Outlook, Instagram, banks, games). Brief DOMAINS rule added; all 7 running writers messaged to rework domains.
- Part 1 (T101-T112) and part 2 (T113-T124) done in product settings; lead re-check: real MySQL 0 issues, engine 0 issues each.
- Parts 3 (ranking), 5 (value functions), 6 (CTEs) done; lead re-check engine 0 issues; MySQL clean apart from flaky 'no result set' (see errors.md).
- Writers' generator files collided in the shared scratchpad (g_common.py overwritten); told remaining writers to use private subfolders.
- All 7 parts done (93). Part 7 reordered so Medium T607 (nightly listings) precedes the Hards; IDs renumbered T607-T610. No duplicate slugs/ids.
- Lead sequential re-check: real MySQL 93/93 0 issues; engine 0 issues. Flakiness only under concurrency (writer saw ERROR 2003 10048 = Windows ephemeral port exhaustion).

- New request: separate "SQL Basics" collection (existing problems unchanged) + per-collection filter bar (difficulty, topics).
- Throwaway MySQL started on 33079 (datadir from session 685c4f64 scratchpad).
- Part 4 (B037-B048) written by worker: fill_expected 12 items 0 issues; content_check 0 issues.
- Part 2 (B013-B024) written: fill_expected 0 issues; content_check 0 issues. Note: judge tolerance 0.005 means 'forgot to ROUND' traps can be judged equal; B016 traps use coarser rounding.
- Part 3 (B025-B036) written: fill_expected 0 issues; content_check 0 issues. CASE problems tagged 'Conditional aggregation' (no CASE topic in vocab).
- Part 1 (B001-B012) written: 0 issues both checks (one transient fill_expected error, not reproduced).
- Lead re-ran checks on all 4 parts: real MySQL 48/48 0 issues, engine 0 issues; build 217 problems, no errors.
- Browser: basics library shows 8 section headings, filters work at 1280px and 375px (no overflow), home "Start here" = B001, 5 collection cards in one row, console clean.
- Reviewer (Sonnet) running on basics content.
- Committed d1c2346, pushed to main; Deploy SQLpedia run succeeded; live catalog lists basics (48).
