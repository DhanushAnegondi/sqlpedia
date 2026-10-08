---
name: add-problem-set
description: Add a new SQL problem set (QUESTIONS.md + setup.sql + solutions.sql) to SQLpedia - place it, port solutions to MySQL, write the meta sidecar, import, and verify the pages render. Use when the user hands over a new batch of SQL questions.
---

# Add a problem set

## Steps
1. Pick a short kebab-case `<set-id>`. Copy the three files into `sets/<set-id>/` unchanged.
   From then on they are read-only.
2. Check the files match the parse rules table in `CLAUDE.md`. If the format differs, extend
   `scripts/import.mjs` (never reformat the source) and add the new rule to that table.
3. Solutions:
   - Postgres source: load the `port-to-mysql` skill, write `mysql/<set-id>/solutions.sql`.
   - MySQL-native source (or a set you author yourself): no port folder. If you are writing
     the questions, follow "Authoring a new MySQL-native set" in `CLAUDE.md` — expected
     outputs must come from executing the queries (DuckDB twin), never typed by hand.
   - Group by `## Tier X — …` for difficulty or `## Topic N — …` for interview patterns.
4. Write `sets-meta/<set-id>.json`: per problem `tags` (from the statement, reuse existing tag
   names where they fit — check other `sets-meta/*.json`) and `dialect_note_md` where needed.
5. Run `node scripts/import.mjs sets/<set-id> <set-id>`, then add it to the `import` script in
   `package.json`. Fix until exit 0.
6. Check the JSON: problem count matches the source, every problem has an expected table or
   `@noeq`, table row counts match the inserts.
7. Load `verify-site` and check the new set's dataset page, three problem pages, category
   and all-pages filters.
8. Ask the user to run `setup.sql` plus a few ports in Workbench; log the result.
9. Log the set in the ledger (`changes.md`) with the problem count.

Existing progress is untouched: tracker keys are `<set-id>/<problem-id>`.
