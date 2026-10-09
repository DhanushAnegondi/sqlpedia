# Worker brief — SQL Basics collection

Project: `F:\Personal\Projects\SQL` (SQLpedia, static SQL practice site). Read `CLAUDE.md`, `content/SCHEMA.md`
(section 1, problem collections) and `ledger/lessons.md` first. Look at `content/collections/patterns/part-a.json`
problem P001 and P005 for the exact JSON shape and tone.

The user finds the existing problems too hard (mostly window functions). This new collection is for
beginners: one concept per problem, short statements, small friendly tables (4-10 rows), Easy for most,
a few Medium at the end of a section. No window functions, no recursive CTEs, nothing clever.

## File you write
`content/collections/basics/part-N.json` = `{ "problems": [ ... ] }` (only your part, 12 problems).

Each problem follows SCHEMA.md section 1, plus one extra field:
- `"section": "<section name>"` — given below for each problem; spell it exactly.

Rules:
- IDs and slugs exactly as listed below; slugs kebab-case from the title, unique.
- `topics` only from the SCHEMA.md vocabulary (Filtering, Sorting, Aggregation, Conditional aggregation, Joins,
  Self-joins, Anti-joins, Set operations, Subqueries, CTEs, NULL handling, String functions, Numeric functions, Dates).
- Statement: 2-4 sentences, plain language, says exactly which columns (in `code`) and the sort order.
- Every query ends with an ORDER BY that fully orders the output (tie-break on an id) unless one row.
- `hints_md`: 2 gentle hints; for beginners it is fine to name the clause to look at (e.g. "Which clause filters
  groups rather than rows?"), but never write the answer query.
- `notes_md`: memory joggers — **Concept:**, **Shape:** (in words), **Syntax:** (tiny generic snippet, not the
  answer), **Watch out:** (the classic beginner mistake). Must not contain the solution query.
- `solutions`: 1-2 approaches with `explain_md` written for a beginner (what each clause does).
- `traps`: 1 common beginner mistake that returns a DIFFERENT result on the planted data (plant the data so it does:
  e.g. a NULL, a duplicate, a tie, a boundary value). `explain_md` says why it is wrong.
- `expected: null` — never typed. Then run, from the project root:
  `python scripts/verify/fill_expected.py content/collections/basics/part-N.json`
  `node scripts/verify/content_check.mjs content/collections/basics/part-N.json`
  Both must be clean (solutions agree, traps differ, engine passes). Fix your SQL/data until they are.
- Original wording, names and data only. Never copy LeetCode / DataLemur / W3Schools text.
- Varied, realistic small domains (cafe, library, gym, bookshop, school, delivery, cinema, clinic, garden centre ...).
- Plain ASCII in SQL, MySQL 8.0 dialect. Types INT, DECIMAL(p,s), VARCHAR(n), DATE, DATETIME, BOOLEAN only.
- MySQL-only syntax that the in-browser engine handles is fine (LIMIT, CONCAT, DATEDIFF, YEAR(), IFNULL).
- Do not edit any other file. Do not commit. Do not start or stop MySQL (it is running on 127.0.0.1:33079).

Return only: the file path, the 12 IDs/titles with difficulty, and the final output lines of both check commands.
