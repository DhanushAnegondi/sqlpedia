# Lessons

- 2026-10-07 — Pre-reveal text leaked answers: MySQL dialect notes named the exact fix (e.g. `+ INTERVAL 30 DAY`, `CAST(... AS CHAR(500))`). Anything visible before Reveal (statement, hints, notes, dialect notes) may warn about a difference but must not state the solution technique. Reviewers check this explicitly.
- 2026-10-07 — Hard-coded dataset assumptions (table names, "four tables", one dataset's column in a caption) broke when a second set arrived. UI text must derive from data.
- 2026-10-08 — Expected outputs are only trusted when produced by executing the reference query (real MySQL via scripts/verify/fill_expected.py), never typed.
- 2026-10-09 — Testing through the UI (clicking Submit) wrote a submission into the user's real progress store. Test the engine by importing modules directly, or snapshot and restore localStorage around UI tests.
