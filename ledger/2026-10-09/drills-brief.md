# Worker brief — Interview topic drills collection

Project: `F:\Personal\Projects\SQL` (SQLpedia, static SQL interview-practice site). Read `CLAUDE.md`,
`content/SCHEMA.md` (section 1, problem collections) and `ledger/lessons.md` first. Look at
`content/collections/basics/part-3.json` (problem B025) and `content/collections/patterns/part-b.json` (P101) for the
exact JSON shape and tone.

The user is preparing for SQL interviews and asked for focused drills, topic by topic: joins, window functions
(every sub-topic), value functions, CTEs and recursive CTEs, 2-3 problems per sub-topic. Each problem drills ONE
sub-topic, reads like a real interview question, and plants the classic trap for that sub-topic. Within a section,
problems go Easy -> Medium -> Hard.

## File you write
`content/collections/drills/part-N.json` = `{ "problems": [ ... ] }` — only your part. IDs, titles, section,
difficulty and the sub-topic each problem drills are fixed in the spec table you are given. You may polish a title,
but keep the ID, the section and the sub-topic. Slugs: kebab-case of the final title, unique.

Each problem follows SCHEMA.md section 1, plus `"section": "<section name>"` (spelled exactly as given).

Rules:
- `topics`: 1-3 tags from the SCHEMA.md vocabulary only (e.g. Joins, Self-joins, Anti-joins, Window functions,
  Ranking, Top N per group, Running totals, Rolling windows, Value functions, Period comparisons, NTILE, CTEs,
  Recursive CTEs, Hierarchies, Gaps and islands, Dates, NULL handling, Aggregation, Statistics ...).
- Statement: 2-5 sentences in an interview voice, a realistic business ask. Say exactly which columns (in `code`),
  rounding, and the sort order. Do not name the technique the problem drills (no "use LAG", "use a recursive CTE",
  "use a LEFT JOIN") — the user must recognise the pattern, as in an interview. Saying what MySQL lacks
  (e.g. "MySQL has no FULL OUTER JOIN") is fine.
- Tables: 5-15 rows each. DOMAINS (user request, overrides older guidance): fresh, recognisable consumer-tech and
  big-company data — a Twitter-style app (tweets, likes, retweets, follows, hashtags), a Netflix-style streaming
  service (titles, genres, watch history, ratings, profiles), an Amazon-style marketplace (orders, sellers, reviews,
  Prime, returns, deliveries), an Outlook-style mailbox (emails, folders, meetings, calendar invites, rules),
  Instagram-style posts (posts, stories, comments, reels, followers), banks (accounts, transactions, cards, loans,
  fraud flags), online games (players, matches, levels, in-game purchases, leaderboards), plus Spotify-style music,
  Uber-style rides, YouTube-style videos, LinkedIn-style connections, Airbnb-style stays, Microsoft Teams chats,
  Xbox achievements. Use the setting as flavour ("a Twitter-style app", "the streaming team at a Netflix-like
  company"); table/column names should read like that product (tweets, watch_history, mailbox_rules ...). Real
  movie / song / game titles are fine as values; user names and handles must be invented. Each problem in a part
  uses a different setting where possible — no two adjacent problems from the same product. Plant the edge cases the sub-topic tests:
  NULLs, ties, duplicates, missing dates, same-day events, boundary values.
- `hints_md`: 2 hints, from gentle to stronger. They may point at what to notice in the data or name the pattern
  family, never the composed query.
- `notes_md`: interview memory joggers, these headings in bold:
  **Pattern:** (family name + when an interviewer reaches for it), **Shape:** (approach in words, no SQL),
  **Syntax:** (facts about one clause or function — its arguments, defaults, frame — with a tiny generic snippet
  like `LAG(expr, offset, default) OVER (PARTITION BY p ORDER BY o)`; never the composed answer, never a template
  of the answer with placeholder names), **Trap:** (the classic mistake), **Interview follow-up:** (one question an
  interviewer typically asks next, e.g. "how would you do it without a window function?").
- `solutions`: 1-3 approaches. Where a sensible alternative exists (window vs self-join, NOT EXISTS vs LEFT JOIN,
  CTE vs subquery), give it — interviewers ask for alternatives. `explain_md` 1-3 sentences on why it works.
- `traps`: 1-2 classic wrong queries for that sub-topic that return a DIFFERENT row set on the planted data.
  The judge compares unordered multisets with 0.005 numeric tolerance, so a sort-only mistake or a "forgot to
  round" mistake is judged correct — plant data so the trap changes rows or values by more than that.
- Every query ends with an ORDER BY that fully orders the output (tie-break on an id) unless one row.
- MySQL 8.0 dialect, plain ASCII, types INT, BIGINT, DECIMAL(p,s), VARCHAR(n), DATE, DATETIME, BOOLEAN only.
  No REGEXP, variables, temp tables, stored procedures. Recursive CTEs: `WITH RECURSIVE`, and remember MySQL
  sizes a string column from the anchor member. Window functions that only exist in MySQL (NTH_VALUE, RANGE with
  INTERVAL) are fine; if the problem is MySQL-specific put a one-line `dialect_note_md` that warns about the
  difference without giving the fix.
- `expected: null` — never typed. Then from the project root run:
  `python scripts/verify/fill_expected.py content/collections/drills/part-N.json`
  `node scripts/verify/content_check.mjs content/collections/drills/part-N.json`
  Both must be clean (solutions agree, traps differ, engine passes). Fix your SQL or data until they are.
  If the browser engine (site/js/engine/translate.js) cannot handle a valid MySQL construct, do NOT edit the
  translator; keep the construct and report the exact failing SQL + error in your final message.
- Original wording, names and data only. Never copy LeetCode / DataLemur / StrataScratch text, names or data.
- Do not edit any other file. Do not commit. Do not start or stop MySQL (running on 127.0.0.1:33079).

Return only: the file path, the IDs / titles / difficulty, the final output lines of both check commands, and any
engine gaps (failing SQL + error).

## Collection layout (for reference)
`content/collections/drills/_meta.json` lists part-1..part-7. Sections, in order:
1. Joins: inner and outer (T101-T112)
2. Joins: self, anti, semi and range (T113-T124)
3. Window functions: ranking (T201-T215)
4. Window functions: aggregates and frames (T301-T315)
5. Value functions (T401-T415)
6. CTEs (T501-T512)
7. Recursive CTEs (T601-T612)

## Spec tables

### Part 1 — section "Joins: inner and outer"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T101 | Easy | Orders with customer names | INNER JOIN; an orphan order (customer missing) is dropped — statement says only orders with a known customer |
| T102 | Easy | Revenue by product category | INNER JOIN across three tables (items -> products -> categories) + GROUP BY |
| T103 | Medium | Stock value by store and SKU | Join on a composite key (store_id, sku); trap joins on sku only and fans out |
| T104 | Easy | Headcount for every department | LEFT JOIN keep-all incl. 0; trap COUNT(*) gives 1 for empty departments |
| T105 | Medium | Customers and their 2025 orders | LEFT JOIN with the date filter in ON vs WHERE; trap WHERE drops customers with no 2025 orders |
| T106 | Medium | Patients, visits and prescriptions | LEFT JOIN chain; trap: a later INNER JOIN silently drops the unmatched rows |
| T107 | Easy | Every course with its enrolments | RIGHT JOIN (and the equivalent LEFT JOIN as second solution) |
| T108 | Medium | Budget versus actual per cost centre | FULL OUTER JOIN emulation in MySQL (either side may be missing; show 0 / NULL as stated) |
| T109 | Hard | Reconcile two warehouse counts | Full outer comparison with status 'only_system', 'only_count', 'mismatch', 'match' (return only non-match) |
| T110 | Easy | Every size and colour combination | CROSS JOIN |
| T111 | Medium | Zero-filled sales by store and month | CROSS JOIN of stores x months + LEFT JOIN facts, 0 where none |
| T112 | Hard | Orders and payments per customer | Join fan-out: summing two child tables in one join inflates totals; pre-aggregate each side |

### Part 2 — section "Joins: self, anti, semi and range"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T113 | Easy | Employees and their managers | Self-join; LEFT self-join keeps the CEO with NULL manager |
| T114 | Medium | Colleagues hired the same year | Self-join pairs in the same department; trap without a.id < b.id gives self-pairs and mirrored duplicates |
| T115 | Medium | Warmer than the day before | Self-join on date = previous calendar day; a missing day must not count as "previous" |
| T116 | Easy | Products never ordered | Anti-join (LEFT JOIN ... IS NULL and NOT EXISTS) |
| T117 | Medium | Shoppers not on the blocklist | NOT IN with a NULL in the subquery returns nothing; NOT EXISTS is safe |
| T118 | Medium | Accounts with no recent login | Anti-join with a date condition inside the join, fixed reference date given in the statement |
| T119 | Easy | Customers with a big order | Semi-join (EXISTS / IN); trap: plain JOIN repeats customers with several big orders |
| T120 | Medium | Members who took both classes | Two semi-joins / GROUP BY HAVING; trap: WHERE class = 'A' AND class = 'B' on one row |
| T121 | Medium | Grade every exam score | Range join to a bands table with BETWEEN min and max |
| T122 | Medium | Price at the time of order | Range join to a price history with valid_from / valid_to (NULL valid_to = current price) |
| T123 | Hard | Double-booked rooms | Self range join for overlapping intervals (a.start < b.end AND b.start < a.end), back-to-back is not an overlap |
| T124 | Hard | Mutual friends | Friendships stored once per pair; symmetrise (UNION ALL) then self-join to count mutual friends for each pair |

### Part 3 — section "Window functions: ranking"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T201 | Easy | Number each customer's orders | ROW_NUMBER with PARTITION BY and a tie-breaker |
| T202 | Easy | Three ways to rank a leaderboard | ROW_NUMBER vs RANK vs DENSE_RANK side by side on ties |
| T203 | Easy | Gold, silver, bronze per event | DENSE_RANK top 3 with ties sharing a medal |
| T204 | Medium | Top two earners per department | Top N per group with ties included; trap ROW_NUMBER drops a tied earner |
| T205 | Medium | Third-highest distinct fare | Nth highest distinct value overall; NULL (one row) when it doesn't exist; trap: duplicates |
| T206 | Medium | Keep the latest record per email | Deduplication with ROW_NUMBER = 1, deterministic tie-break |
| T207 | Medium | First purchase and what was bought | First row per group; trap MIN(date) join returns two rows on a same-day tie |
| T208 | Medium | Rank products by revenue within category | Ranking over an aggregate (window over GROUP BY result) |
| T209 | Medium | Leaderboard movers | Rank in week 1 vs rank in week 2 per player, positions gained |
| T210 | Easy | Split runners into pace groups | NTILE(4) |
| T211 | Medium | Uneven buckets | NTILE with a row count not divisible by n — which buckets get the extra rows; bucket min/max |
| T212 | Medium | Salary percentile within department | PERCENT_RANK, rounded |
| T213 | Medium | Top quarter of students | CUME_DIST; ties at the boundary matter |
| T214 | Hard | Top three with a tie-breaker | Ranking on two keys (score DESC, finish_time ASC) per group |
| T215 | Hard | Longest login streak | Islands with date minus ROW_NUMBER; duplicate logins on one day must be removed first |

### Part 4 — section "Window functions: aggregates and frames"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T301 | Easy | Region share of total revenue | SUM() OVER () for a percent of total |
| T302 | Easy | Paid above the department average | AVG() OVER (PARTITION BY); filtering on a window needs an outer query (trap would be a wrong-result variant, not a syntax error) |
| T303 | Medium | Orders from repeat customers | COUNT(*) OVER (PARTITION BY) keeping detail rows |
| T304 | Medium | Price versus the cheapest in category | MIN() / MAX() OVER partition |
| T305 | Easy | Cumulative sign-ups | Running total over dates |
| T306 | Medium | Running total that resets each month | Running total partitioned by month |
| T307 | Medium | Running total with same-day rows | Default RANGE frame adds tied dates together; ROWS frame with an id tie-break is per row |
| T308 | Medium | Three-day moving average of steps | ROWS BETWEEN 2 PRECEDING AND CURRENT ROW; first rows average fewer days |
| T309 | Medium | Centred moving average | ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING |
| T310 | Hard | Seven calendar-day rolling sum | RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW with missing days; trap ROWS 6 PRECEDING |
| T311 | Medium | Days that set a new record | Running MAX over the preceding rows only (UNBOUNDED PRECEDING AND 1 PRECEDING) |
| T312 | Medium | Cumulative share of revenue | Running SUM / total, ordered by revenue desc (Pareto) |
| T313 | Hard | New customers per day, cumulative | Mark first orders, then running sum of new customers |
| T314 | Hard | Day each fundraiser hit its goal | Running total crossing a per-partition threshold, first such day |
| T315 | Hard | Rolling average rating alerts | Cumulative average after each review; flag the reviews where it first falls below a threshold |

### Part 5 — section "Value functions"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T401 | Easy | Day-over-day visitor change | LAG |
| T402 | Easy | Days until the next appointment | LEAD per patient, NULL for the last one |
| T403 | Medium | Sales versus three months earlier | LAG with an offset argument |
| T404 | Medium | Subscriber change from zero | LAG with a default value (first month compared with 0) |
| T405 | Medium | Price change log | LAG per product; keep only rows where the price changed (first row excluded or included as stated) |
| T406 | Medium | Turn change events into validity ranges | LEAD to build valid_from / valid_to (next start minus a day, NULL for current) |
| T407 | Medium | Month-over-month growth percent | LAG + NULLIF for a zero previous month |
| T408 | Easy | Gap to the top salary | FIRST_VALUE per department |
| T409 | Medium | Final status on every row | LAST_VALUE needs a full frame; default frame returns the current row |
| T410 | Medium | Entry and exit page per session | FIRST_VALUE and LAST_VALUE together |
| T411 | Medium | Second product each customer bought | NTH_VALUE(…, 2) with the right frame; NULL for one-purchase customers |
| T412 | Hard | Winning margin per contest | Winner and runner-up via NTH_VALUE / FIRST_VALUE; ties at the top |
| T413 | Hard | Local peaks | LAG and LEAD together: value above both neighbours; ends excluded |
| T414 | Hard | Three months of rising spend | LAG(…,1) and LAG(…,2); a missing month breaks the streak |
| T415 | Hard | Gaps in insurance cover | LEAD per person: gap between end and next start, only gaps of one day or more |

### Part 6 — section "CTEs"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T501 | Easy | Big spenders | One CTE for per-customer totals, then filter |
| T502 | Easy | Average orders per customer | Aggregate of an aggregate; trap AVG over raw rows |
| T503 | Medium | Best month of each year | Chained CTEs (monthly totals -> rank or max per year) |
| T504 | Medium | Months above the typical month | CTE referenced twice (detail and its average) |
| T505 | Medium | Month versus previous month without windows | CTE self-join on a month index |
| T506 | Medium | Two latest orders per customer | Window inside a CTE, filter outside |
| T507 | Medium | Sign-up to paid funnel | CTE per funnel step, counts and conversion rates |
| T508 | Medium | Departments and their active projects | CTE + LEFT JOIN with zero fill |
| T509 | Hard | Spend grew every year | Chained CTEs: yearly spend, compare with previous year, keep customers with no decline |
| T510 | Hard | Most common companion product | Pair counts in a CTE, then the top partner per product with a tie rule |
| T511 | Hard | First-week activation rate by cohort | Cohort CTE + activity CTE joined on a date window |
| T512 | Hard | Top category per month and its share | Three chained CTEs: monthly category totals, monthly totals, rank |

### Part 7 — section "Recursive CTEs"
| ID | Diff | Title | Sub-topic and the planted trap |
|---|---|---|---|
| T601 | Easy | Count from one to ten | Number series (anchor + step + stop condition) |
| T602 | Easy | Bookings for every day of the week | Date spine for a fixed range, zero-fill |
| T603 | Medium | Missing invoice numbers | Generate 1..max and anti-join |
| T604 | Medium | Everyone under a manager | Descendants with level |
| T605 | Medium | Category breadcrumbs | Path string ("Home > Electronics > Phones"); anchor string width trap |
| T606 | Medium | Chain of command | Ancestors upward from a given employee to the top |
| T607 | Hard | Total salary under each manager | Ancestor-descendant pairs, then aggregate (direct and indirect) |
| T608 | Hard | Parts needed to build one bike | Bill of materials: multiply quantities down the tree |
| T609 | Hard | Cheapest route with at most two stops | Graph walk with path and cycle guard |
| T610 | Medium | Nightly hotel occupancy | Expand each stay into one row per night, then count |
| T611 | Hard | Split tags into rows | Comma-separated string to rows |
| T612 | Hard | Referral loops | Cycle detection with a visited path |
