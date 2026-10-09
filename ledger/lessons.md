# Lessons

- 2026-10-07 — Pre-reveal text leaked answers: MySQL dialect notes named the exact fix (e.g. `+ INTERVAL 30 DAY`, `CAST(... AS CHAR(500))`). Anything visible before Reveal (statement, hints, notes, dialect notes) may warn about a difference but must not state the solution technique. Reviewers check this explicitly.
- 2026-10-07 — Hard-coded dataset assumptions (table names, "four tables", one dataset's column in a caption) broke when a second set arrived. UI text must derive from data.
- 2026-10-08 — Expected outputs are only trusted when produced by executing the reference query (real MySQL via scripts/verify/fill_expected.py), never typed.
- 2026-10-09 — Testing through the UI (clicking Submit) wrote a submission into the user's real progress store. Test the engine by importing modules directly, or snapshot and restore localStorage around UI tests.
- 2026-10-09 — Second spoiler leak: writers put the solution skeleton (with placeholder names) in the Notes "Syntax:" line. A generic template of the answer is still the answer. Syntax lines state facts about one clause (what it does, its arguments), never the composed query shape. Brief writers with a bad/good example.
- 2026-10-09 — The judge compares multisets with 0.005 numeric tolerance, so sort-only traps and "forgot to ROUND to 2dp" traps are judged equal to the answer. Plant data so a trap changes the row set or differs by more than the tolerance.
