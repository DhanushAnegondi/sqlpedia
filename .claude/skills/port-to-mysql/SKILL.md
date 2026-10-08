---
name: port-to-mysql
description: Port PostgreSQL reference solutions from a problem set's solutions.sql to MySQL 8.0 dialect in mysql/<set-id>/solutions.sql, keeping markers, approaches and TRAP blocks. Use when importing a new set, or when a MySQL solution is wrong or missing.
---

# Port solutions to MySQL 8.0

Target: MySQL Community Server 8.0.39, default collation `utf8mb4_0900_ai_ci`.

## Steps
1. Read the source `solutions.sql` block by block (`-- @Q<n>` to the next marker) and the
   matching question + expected output in `QUESTIONS.md`.
2. Write the port to `mysql/<set-id>/solutions.sql` with the same markers (`-- @Q5a`),
   same `-- (a)` / `-- (b)` approach labels, same `-- @noeq`, and keep `-- TRAP` blocks
   (ported, so they still demonstrate the trap — or note that MySQL behaves differently).
3. Keep the source's comments; reword only where the MySQL behavior differs.
4. Where the question asks for a feature MySQL lacks (e.g. "use PERCENTILE_CONT"), port the
   alternative approach and add a `dialect_note_md` for that problem in
   `sets-meta/<set-id>.json`.
5. Grep the port for leftovers: `::`, `||`, `DATE_TRUNC`, `FILTER (`, `PERCENTILE_`,
   `generate_series`, `DISTINCT ON`, `ILIKE`, `NULLS FIRST`, `NULLS LAST`, ` USING `,
   `INTERVAL '`, `STRING_AGG`, `EXTRACT(EPOCH`.
6. Ask the user to run the trickiest ports in Workbench (after `setup.sql`) and compare to the
   expected table; log what they confirmed in the ledger. Never claim a port is verified
   unless it was run.

## Translation table
| PostgreSQL | MySQL 8.0 |
|---|---|
| `DATE_TRUNC('month', d)` | `DATE_FORMAT(d, '%Y-%m-01')` (string, matches `2025-01-01` expected) or `CAST(DATE_FORMAT(d, '%Y-%m-01') AS DATE)` |
| `d1 - d2` (days) | `DATEDIFF(d1, d2)` |
| `d + INTERVAL '30 days'` | `d + INTERVAL 30 DAY` / `DATE_ADD(d, INTERVAL 30 DAY)` |
| `PERCENTILE_CONT(0.5) WITHIN GROUP (…)` | `ROW_NUMBER()` + `COUNT(*) OVER ()`, average the middle one or two rows |
| `generate_series(a, b, '1 day')` | `WITH RECURSIVE cal AS (SELECT a AS d UNION ALL SELECT d + INTERVAL 1 DAY FROM cal WHERE d < b)` (depth limit 1000 by default) |
| `COUNT(*) FILTER (WHERE c)` | `SUM(CASE WHEN c THEN 1 ELSE 0 END)` or `SUM(c)` |
| `SUM(x) FILTER (WHERE c)` | `SUM(CASE WHEN c THEN x END)` |
| `a \|\| b` | `CONCAT(a, b)` (`\|\|` is logical OR in MySQL) |
| `x::numeric`, `x::text` | `CAST(x AS DECIMAL(10,2))`, `CAST(x AS CHAR)` (targets: SIGNED, UNSIGNED, DECIMAL, CHAR, DATE, DATETIME, DOUBLE) |
| `DISTINCT ON (k) … ORDER BY k, t DESC` | `ROW_NUMBER() OVER (PARTITION BY k ORDER BY t DESC) = 1` in a derived table |
| `ORDER BY x NULLS LAST` | `ORDER BY x IS NULL, x` |
| `DELETE FROM t a USING t b WHERE …` | `DELETE a FROM t a JOIN t b ON …` |
| `STRING_AGG(x, ', ')` | `GROUP_CONCAT(x SEPARATOR ', ')` |
| `ILIKE` | `LIKE` (default collation is already case-insensitive) |
| Recursive CTE building a string | `CAST(name AS CHAR(500))` in the anchor, or MySQL truncates / errors "Data too long" |
| `int / int` truncates | `/` returns DECIMAL in MySQL; use `DIV` for integer division |
| `LIMIT` inside `IN (subquery)` | Not supported; wrap in a derived table |
| Subquery on the table being deleted | Wrap in a derived table (`SELECT … FROM (SELECT …) t`); if error 1093 persists, the optimizer merged it — add `/*+ NO_MERGE(t) */` |

## Behavior differences to flag in dialect notes
- Default collation is case- and accent-insensitive: `GROUP BY email` already merges
  `ALICE@mail.com` and `alice@mail.com`, so "plain GROUP BY misses it" traps don't reproduce.
  Use `BINARY email` or `COLLATE utf8mb4_bin` to show the case-sensitive behavior.
- `NOT IN` with NULLs, default `RANGE` window frame, `LEFT JOIN` + `WHERE` filter traps
  behave the same as Postgres.
- `ROUND()` on DECIMAL rounds half away from zero (same as Postgres numeric); on DOUBLE
  (e.g. `AVG` of a float expression) it may round half to even — cast to DECIMAL first when a
  1-dp expected value ends in 5.
