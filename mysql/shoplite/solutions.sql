-- =====================================================================
-- ShopLite - MySQL 8.0 ports of the 30 solutions in starter_pac/solutions.sql
-- Target: MySQL Community Server 8.0.39, default collation utf8mb4_0900_ai_ci.
-- Run starter_pac/setup.sql first. Convention: revenue / spend = completed orders only.
-- Lines marked TRAP are the common wrong answer, kept so you can run it and see why.
-- =====================================================================


-- =====================================================================
-- TIER A - asked in almost every screen
-- =====================================================================

-- @Q1  Second highest order amount
-- (a) MAX below the MAX. Returns NULL on its own when no second value exists.
SELECT MAX(amount) AS second_highest
FROM orders
WHERE status = 'completed'
  AND amount < (SELECT MAX(amount) FROM orders WHERE status = 'completed');

-- (b) DENSE_RANK. Wrapping it in a scalar subquery turns "no row" into NULL.
SELECT (
    SELECT DISTINCT amount
    FROM (SELECT amount, DENSE_RANK() OVER (ORDER BY amount DESC) AS rnk
          FROM orders
          WHERE status = 'completed') r
    WHERE rnk = 2
) AS second_highest;


-- @Q2  Nth highest order amount (N = 3)
-- (a) DENSE_RANK - ties share a rank, so rank N is the Nth distinct value.
SELECT (
    SELECT DISTINCT amount
    FROM (SELECT amount, DENSE_RANK() OVER (ORDER BY amount DESC) AS rnk
          FROM orders
          WHERE status = 'completed') r
    WHERE rnk = 3
) AS nth_highest;

-- (b) LIMIT / OFFSET over DISTINCT values (OFFSET N-1).
-- LIMIT is allowed in a scalar subquery; MySQL only rejects it inside IN / ANY / ALL / SOME.
SELECT (
    SELECT DISTINCT amount
    FROM orders
    WHERE status = 'completed'
    ORDER BY amount DESC
    LIMIT 1 OFFSET 2
) AS nth_highest;


-- @Q3  Duplicate emails (case-insensitive)
-- MySQL's default collation already compares case-insensitively, so even a plain
-- GROUP BY email merges ALICE@ and alice@. It does not trim spaces, and LOWER(TRIM())
-- is what works on every engine - write it explicitly.
SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS accounts
FROM customers
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
ORDER BY email;


-- @Q4  Delete duplicate accounts, keep the lowest customer_id
-- @noeq
-- Step 1: always preview what you are about to delete.
SELECT customer_id, email
FROM (SELECT customer_id, email,
             ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY customer_id) AS rn
      FROM customers) t
WHERE rn > 1
ORDER BY customer_id;

-- Step 2: delete. MySQL can't select from the table it deletes from (error 1093), so the
-- subquery goes through a derived table. A window function stops the optimizer merging it.
-- If Workbench stops this with error 1175, run SET SQL_SAFE_UPDATES = 0; first.
DELETE FROM customers
WHERE customer_id IN (
    SELECT customer_id
    FROM (SELECT customer_id,
                 ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY customer_id) AS rn
          FROM customers) t
    WHERE rn > 1
);
-- MySQL alternative (the LC 196 self-join style, multi-table DELETE):
--   DELETE c1 FROM customers c1
--   JOIN customers c2 ON LOWER(c1.email) = LOWER(c2.email) AND c1.customer_id > c2.customer_id;

-- Step 3: check
SELECT COUNT(*) AS customers_left FROM customers;


-- @Q5a  Customers who never placed an order
-- (a) LEFT JOIN anti-join
SELECT c.customer_id, c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id;

-- (b) NOT EXISTS - same result, usually the same plan
SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.customer_id;


-- @Q5b  Customers who never referred anyone (the NOT IN trap)
-- TRAP: referred_by contains NULLs, so "x NOT IN (..., NULL)" is never TRUE and this returns 0 rows.
SELECT customer_id, name
FROM customers
WHERE customer_id NOT IN (SELECT referred_by FROM customers);

-- Correct: NOT EXISTS is NULL-safe (or add WHERE referred_by IS NOT NULL inside the NOT IN).
SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM customers r WHERE r.referred_by = c.customer_id)
ORDER BY c.customer_id;


-- @Q6  Every customer with completed-order count and spend, including zero
-- TRAP: filtering the right table in WHERE turns the LEFT JOIN into an INNER JOIN (9 rows, not 13).
SELECT c.customer_id, c.name, COUNT(o.order_id) AS orders, COALESCE(SUM(o.amount), 0) AS total_spend
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
GROUP BY c.customer_id, c.name
ORDER BY c.customer_id;

-- Correct: the filter on the right table belongs in the ON clause.
SELECT c.customer_id,
       c.name,
       COUNT(o.order_id)          AS orders,       -- COUNT(col) skips the NULLs from unmatched rows
       COALESCE(SUM(o.amount), 0) AS total_spend
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
                  AND o.status = 'completed'
GROUP BY c.customer_id, c.name
ORDER BY total_spend DESC, c.customer_id;


-- @Q7  Customers with 4 or more completed orders
-- Conditions on aggregates go in HAVING, not WHERE.
SELECT customer_id, COUNT(*) AS orders
FROM orders
WHERE status = 'completed'
GROUP BY customer_id
HAVING COUNT(*) >= 4
ORDER BY orders DESC, customer_id;


-- @Q8  Highest-spending customer in each city (keep ties)
-- (a) RANK (not ROW_NUMBER) so tied customers both come back.
WITH spend AS (
    SELECT c.city, c.customer_id, c.name, SUM(o.amount) AS total_spend
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    WHERE o.status = 'completed'
    GROUP BY c.city, c.customer_id, c.name
),
ranked AS (
    SELECT spend.*, RANK() OVER (PARTITION BY city ORDER BY total_spend DESC) AS rnk
    FROM spend
)
SELECT city, customer_id, name, total_spend
FROM ranked
WHERE rnk = 1
ORDER BY city, customer_id;

-- (b) No window functions: join back to the max per city (the LC 184 classic).
WITH spend AS (
    SELECT c.city, c.customer_id, c.name, SUM(o.amount) AS total_spend
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    WHERE o.status = 'completed'
    GROUP BY c.city, c.customer_id, c.name
)
SELECT s.city, s.customer_id, s.name, s.total_spend
FROM spend s
JOIN (SELECT city, MAX(total_spend) AS max_spend FROM spend GROUP BY city) m
  ON m.city = s.city AND m.max_spend = s.total_spend
ORDER BY s.city, s.customer_id;


-- @Q9  Top 2 products by revenue in each category
-- DENSE_RANK: "top 2 revenue values". Grocery only has one product that ever sold.
WITH rev AS (
    SELECT p.category, p.product_id, p.product_name, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi
    JOIN orders o   ON o.order_id   = oi.order_id
    JOIN products p ON p.product_id = oi.product_id
    WHERE o.status = 'completed'
    GROUP BY p.category, p.product_id, p.product_name
),
ranked AS (
    SELECT rev.*, DENSE_RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rnk
    FROM rev
)
SELECT category, rnk, product_name, revenue
FROM ranked
WHERE rnk <= 2
ORDER BY category, rnk, product_name;


-- @Q10  ROW_NUMBER vs RANK vs DENSE_RANK
-- Window results can't be filtered in WHERE of the same SELECT - wrap it.
SELECT order_id, amount, row_num, rnk, dense_rnk
FROM (
    SELECT order_id,
           amount,
           ROW_NUMBER() OVER (ORDER BY amount DESC, order_id) AS row_num,
           RANK()       OVER (ORDER BY amount DESC)           AS rnk,
           DENSE_RANK() OVER (ORDER BY amount DESC)           AS dense_rnk
    FROM orders
    WHERE status = 'completed'
) t
WHERE dense_rnk <= 7
ORDER BY row_num;


-- @Q11  Monthly orders and revenue
-- MySQL has no DATE_TRUNC: format the date to the 1st of its month, cast back to DATE.
-- Conditional aggregation: one pass, several filtered counts.
SELECT CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE)            AS month,
       COUNT(*)                                                     AS orders,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)        AS completed_orders,
       SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END)   AS revenue
FROM orders
GROUP BY CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE)
ORDER BY month;


-- @Q12  Revenue share by category
-- (a) Aggregate first, then a window over the aggregated rows.
WITH cat AS (
    SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi
    JOIN orders o   ON o.order_id   = oi.order_id
    JOIN products p ON p.product_id = oi.product_id
    WHERE o.status = 'completed'
    GROUP BY p.category
)
SELECT category, revenue, ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS pct_of_total
FROM cat
ORDER BY revenue DESC;

-- (b) Same thing in one level: a window over an aggregate, SUM(SUM(x)) OVER ().
SELECT p.category,
       SUM(oi.quantity * oi.unit_price) AS revenue,
       ROUND(100.0 * SUM(oi.quantity * oi.unit_price)
                   / SUM(SUM(oi.quantity * oi.unit_price)) OVER (), 1) AS pct_of_total
FROM order_items oi
JOIN orders o   ON o.order_id   = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY revenue DESC;


-- =====================================================================
-- TIER B - window functions (every data engineering loop)
-- =====================================================================

-- @Q13  Running total of completed orders in March 2025
-- TRAP: ORDER BY order_date alone uses the default RANGE frame, so the two orders on
-- Mar 11 (and the two on Mar 12) get the SAME running total - the whole day at once.
SELECT order_id, order_date, amount,
       SUM(amount) OVER (ORDER BY order_date) AS running_total
FROM orders
WHERE status = 'completed'
  AND order_date >= DATE '2025-03-01' AND order_date < DATE '2025-04-01'
ORDER BY order_date, order_id;

-- Correct: a unique ordering plus an explicit ROWS frame.
SELECT order_id, order_date, amount,
       SUM(amount) OVER (ORDER BY order_date, order_id
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders
WHERE status = 'completed'
  AND order_date >= DATE '2025-03-01' AND order_date < DATE '2025-04-01'
ORDER BY order_date, order_id;


-- @Q14  Month-over-month revenue growth
WITH m AS (
    SELECT CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE) AS month, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'completed'
    GROUP BY CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE)
)
SELECT month,
       revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
                   / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS mom_pct
FROM m
ORDER BY month;


-- @Q15  Latest completed order per customer (one row each)
-- (a) ROW_NUMBER + tie-break: the standard "latest record per key" dedup.
SELECT customer_id, order_id, order_date, amount
FROM (
    SELECT customer_id, order_id, order_date, amount,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
    FROM orders
    WHERE status = 'completed'
) t
WHERE rn = 1
ORDER BY customer_id;

-- (b) Join to MAX(order_date). Same answer here, but it returns 2 rows for a customer
-- with two orders on their latest day - say so in the interview.
SELECT o.customer_id, o.order_id, o.order_date, o.amount
FROM orders o
JOIN (SELECT customer_id, MAX(order_date) AS max_date
      FROM orders
      WHERE status = 'completed'
      GROUP BY customer_id) m
  ON m.customer_id = o.customer_id AND m.max_date = o.order_date
WHERE o.status = 'completed'
ORDER BY o.customer_id;


-- @Q16  Orders bigger than the same customer's previous order
WITH s AS (
    SELECT customer_id, order_id, order_date, amount,
           LAG(amount) OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS prev_amount
    FROM orders
    WHERE status = 'completed'
)
SELECT customer_id, order_id, order_date, prev_amount, amount
FROM s
WHERE amount > prev_amount            -- first orders have prev_amount NULL and drop out
ORDER BY customer_id, order_date, order_id;


-- @Q17  Average days between orders, per customer
-- In MySQL, date - date is NOT a day count; use DATEDIFF(later, earlier).
-- (a) LAG, then average the gaps.
WITH s AS (
    SELECT customer_id, order_date,
           LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS prev_date
    FROM orders
    WHERE status = 'completed'
)
SELECT customer_id,
       COUNT(*)                                       AS gaps,
       ROUND(AVG(DATEDIFF(order_date, prev_date)), 1) AS avg_days_between
FROM s
WHERE prev_date IS NOT NULL
GROUP BY customer_id
ORDER BY avg_days_between, customer_id;

-- (b) Shortcut: the gaps telescope, so the average is (last - first) / (n - 1).
SELECT customer_id,
       COUNT(*) - 1                                                                   AS gaps,
       ROUND(1.0 * DATEDIFF(MAX(order_date), MIN(order_date)) / (COUNT(*) - 1), 1)   AS avg_days_between
FROM orders
WHERE status = 'completed'
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY avg_days_between, customer_id;


-- @Q18  3-month moving average of revenue (full windows only)
-- Compute the window first, filter afterwards - WHERE runs before window functions.
WITH m AS (
    SELECT CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE) AS month, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'completed'
    GROUP BY CAST(DATE_FORMAT(order_date, '%Y-%m-01') AS DATE)
),
w AS (
    SELECT month,
           revenue,
           AVG(revenue) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS ma_3m,
           COUNT(*)     OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS months_in_window
    FROM m
)
SELECT month, revenue, ROUND(ma_3m, 2) AS moving_avg_3m
FROM w
WHERE months_in_window = 3
ORDER BY month;


-- @Q19  Customers who ordered on 3 or more consecutive days (gaps & islands)
-- date - ROW_NUMBER() days is constant inside a run of consecutive dates.
-- DISTINCT dates first: Chloe ordered twice on Mar 11, and without DISTINCT the
-- duplicate shifts the row numbers and splits her streak into two 2-day pieces.
-- MySQL: number the rows in one step, subtract with DATE_SUB(... INTERVAL rn DAY) in the next.
WITH d AS (
    SELECT DISTINCT customer_id, order_date
    FROM orders
    WHERE status = 'completed'
),
n AS (
    SELECT customer_id, order_date,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn
    FROM d
),
g AS (
    SELECT customer_id, order_date,
           DATE_SUB(order_date, INTERVAL rn DAY) AS grp
    FROM n
)
SELECT customer_id,
       MIN(order_date) AS streak_start,
       MAX(order_date) AS streak_end,
       COUNT(*)        AS days
FROM g
GROUP BY customer_id, grp
HAVING COUNT(*) >= 3
ORDER BY customer_id, streak_start;


-- @Q20  Median completed order amount
-- MySQL has no PERCENTILE_CONT / MEDIAN. Number the rows and average the middle one or two.
-- (a) Average the rows between n/2 and n/2 + 1: n=34 -> rows 17 and 18, n=33 -> row 17.
WITH r AS (
    SELECT amount,
           ROW_NUMBER() OVER (ORDER BY amount) AS rn,
           COUNT(*)     OVER ()                AS n
    FROM orders
    WHERE status = 'completed'
)
SELECT ROUND(AVG(amount), 2) AS median_amount
FROM r
WHERE rn BETWEEN n / 2.0 AND n / 2.0 + 1;

-- (b) Same idea with FLOOR / CEIL of (n + 1) / 2: both are 17.5 -> 17 and 18 for n = 34.
WITH r AS (
    SELECT amount,
           ROW_NUMBER() OVER (ORDER BY amount) AS rn,
           COUNT(*)     OVER ()                AS n
    FROM orders
    WHERE status = 'completed'
)
SELECT ROUND(AVG(amount), 2) AS median_amount
FROM r
WHERE rn IN (FLOOR((n + 1) / 2), CEIL((n + 1) / 2));


-- =====================================================================
-- TIER C - senior-level and business logic
-- =====================================================================

-- @Q21  Customers who outspent the customer who referred them
-- Self-join on an aggregated CTE. LEFT JOIN in the CTE so zero-spend people still exist.
WITH spend AS (
    SELECT c.customer_id, c.name, c.referred_by, COALESCE(SUM(o.amount), 0) AS total_spend
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
    GROUP BY c.customer_id, c.name, c.referred_by
)
SELECT s.customer_id, s.name, s.total_spend,
       r.customer_id AS referrer_id, r.name AS referrer_name, r.total_spend AS referrer_spend
FROM spend s
JOIN spend r ON r.customer_id = s.referred_by
WHERE s.total_spend > r.total_spend
ORDER BY s.customer_id;


-- @Q22  Customers who bought every Electronics product (relational division)
-- (a) Count distinct products bought and compare with the size of the category.
SELECT c.customer_id, c.name
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
JOIN products p     ON p.product_id  = oi.product_id
WHERE o.status = 'completed'
  AND p.category = 'Electronics'
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT oi.product_id) = (SELECT COUNT(*) FROM products WHERE category = 'Electronics')
ORDER BY c.customer_id;

-- (b) Double NOT EXISTS: there is no Electronics product this customer has not bought.
SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE p.category = 'Electronics'
      AND NOT EXISTS (SELECT 1
                      FROM orders o
                      JOIN order_items oi ON oi.order_id = o.order_id
                      WHERE o.customer_id = c.customer_id
                        AND o.status = 'completed'
                        AND oi.product_id = p.product_id)
)
ORDER BY c.customer_id;


-- @Q23  Product pairs bought together in 2+ completed orders
-- a.product_id < b.product_id keeps each pair once and drops self-pairs.
WITH basket AS (
    SELECT oi.order_id, oi.product_id
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.status = 'completed'
)
SELECT pa.product_name AS product_a,
       pb.product_name AS product_b,
       COUNT(*)        AS orders_together
FROM basket a
JOIN basket b    ON b.order_id = a.order_id AND a.product_id < b.product_id
JOIN products pa ON pa.product_id = a.product_id
JOIN products pb ON pb.product_id = b.product_id
GROUP BY a.product_id, b.product_id, pa.product_name, pb.product_name
HAVING COUNT(*) >= 2
ORDER BY orders_together DESC, a.product_id, b.product_id;


-- @Q24  Cancellation rate per customer (customers who cancelled at least once)
-- AVG of a 0/1 flag is a rate. MySQL averages integers as DECIMAL, so no int-division trap here.
SELECT customer_id,
       COUNT(*)                                                         AS orders,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)            AS cancelled,
       ROUND(100.0 * AVG(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 1) AS cancel_rate_pct
FROM orders
GROUP BY customer_id
HAVING SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) > 0
ORDER BY cancel_rate_pct DESC, customer_id;


-- @Q25  Pivot: revenue by category (rows) x month (columns)
-- MySQL has no PIVOT keyword: conditional aggregation is the standard way.
SELECT p.category,
       SUM(CASE WHEN MONTH(o.order_date) = 1 THEN oi.quantity * oi.unit_price ELSE 0 END) AS jan,
       SUM(CASE WHEN MONTH(o.order_date) = 2 THEN oi.quantity * oi.unit_price ELSE 0 END) AS feb,
       SUM(CASE WHEN MONTH(o.order_date) = 3 THEN oi.quantity * oi.unit_price ELSE 0 END) AS mar,
       SUM(CASE WHEN MONTH(o.order_date) = 4 THEN oi.quantity * oi.unit_price ELSE 0 END) AS apr,
       SUM(CASE WHEN MONTH(o.order_date) = 5 THEN oi.quantity * oi.unit_price ELSE 0 END) AS may,
       SUM(CASE WHEN MONTH(o.order_date) = 6 THEN oi.quantity * oi.unit_price ELSE 0 END) AS jun,
       SUM(oi.quantity * oi.unit_price)                                                     AS total
FROM order_items oi
JOIN orders o   ON o.order_id   = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY p.category;


-- @Q26  New vs returning customers per month
-- New = this is the month of the customer's first completed order.
WITH c AS (
    SELECT customer_id, order_date
    FROM orders
    WHERE status = 'completed'
),
f AS (
    SELECT customer_id, MIN(order_date) AS first_date
    FROM c
    GROUP BY customer_id
),
m AS (
    SELECT DISTINCT
           CAST(DATE_FORMAT(c.order_date, '%Y-%m-01') AS DATE) AS month,
           c.customer_id,
           CASE WHEN DATE_FORMAT(c.order_date, '%Y-%m') = DATE_FORMAT(f.first_date, '%Y-%m')
                THEN 'new' ELSE 'returning' END                 AS kind
    FROM c
    JOIN f ON f.customer_id = c.customer_id
)
SELECT month,
       COUNT(*)                                            AS active_customers,
       SUM(CASE WHEN kind = 'new'       THEN 1 ELSE 0 END) AS new_customers,
       SUM(CASE WHEN kind = 'returning' THEN 1 ELSE 0 END) AS returning_customers
FROM m
GROUP BY month
ORDER BY month;


-- @Q27  % of buyers whose 2nd order came within 30 days of their 1st
-- MySQL gotcha: first_date + 30 is NOT "30 days later" - it turns the date into the
-- number 20250103 and adds 30. Always use DATE_ADD / + INTERVAL n DAY.
WITH s AS (
    SELECT customer_id, order_date,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS rn
    FROM orders
    WHERE status = 'completed'
),
f AS (
    SELECT customer_id,
           MAX(CASE WHEN rn = 1 THEN order_date END) AS first_date,
           MAX(CASE WHEN rn = 2 THEN order_date END) AS second_date   -- NULL if only one order
    FROM s
    GROUP BY customer_id
)
SELECT COUNT(*)                                                                         AS buyers,
       SUM(CASE WHEN second_date <= first_date + INTERVAL 30 DAY THEN 1 ELSE 0 END)     AS repeated_within_30d,
       ROUND(100.0 * SUM(CASE WHEN second_date <= first_date + INTERVAL 30 DAY THEN 1 ELSE 0 END)
                   / COUNT(*), 1)                                                       AS repeat_rate_pct
FROM f;


-- @Q28  Days with zero completed orders, per month (date spine)
-- You can't GROUP BY days that have no rows - generate every day, then LEFT JOIN.
-- MySQL has no generate_series: a recursive CTE builds the calendar (181 rows, well under
-- the default cte_max_recursion_depth of 1000).
WITH RECURSIVE days AS (
    SELECT DATE '2025-01-01' AS d
    UNION ALL
    SELECT d + INTERVAL 1 DAY FROM days WHERE d < DATE '2025-06-30'
),
active AS (
    SELECT DISTINCT order_date
    FROM orders
    WHERE status = 'completed'
)
SELECT CAST(DATE_FORMAT(days.d, '%Y-%m-01') AS DATE) AS month,
       COUNT(*)                                      AS days_in_month,
       COUNT(active.order_date)                      AS days_with_orders,
       COUNT(*) - COUNT(active.order_date)           AS zero_order_days
FROM days
LEFT JOIN active ON active.order_date = days.d
GROUP BY CAST(DATE_FORMAT(days.d, '%Y-%m-01') AS DATE)
ORDER BY month;


-- @Q29  Customers who spent more than their city's average
-- (a) Window AVG keeps every row (GROUP BY would collapse them).
WITH spend AS (
    SELECT c.city, c.customer_id, c.name, SUM(o.amount) AS total_spend
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    WHERE o.status = 'completed'
    GROUP BY c.city, c.customer_id, c.name
),
x AS (
    SELECT spend.*, AVG(total_spend) OVER (PARTITION BY city) AS city_avg
    FROM spend
)
SELECT city, customer_id, name, total_spend, ROUND(city_avg, 2) AS city_avg
FROM x
WHERE total_spend > city_avg
ORDER BY city, customer_id;

-- (b) Join to a grouped average.
WITH spend AS (
    SELECT c.city, c.customer_id, c.name, SUM(o.amount) AS total_spend
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    WHERE o.status = 'completed'
    GROUP BY c.city, c.customer_id, c.name
)
SELECT s.city, s.customer_id, s.name, s.total_spend, ROUND(a.city_avg, 2) AS city_avg
FROM spend s
JOIN (SELECT city, AVG(total_spend) AS city_avg FROM spend GROUP BY city) a ON a.city = s.city
WHERE s.total_spend > a.city_avg
ORDER BY s.city, s.customer_id;


-- @Q30  Referral chains (recursive CTE)
-- Anchor = customers nobody referred. Each step follows "who did they refer?".
-- MySQL sizes the path column from the anchor row: cast it wide (CHAR(500)), or longer
-- chains fail with "Data too long". || is logical OR in MySQL - concatenate with CONCAT().
-- Real data can contain cycles: add  WHERE ch.depth < 20  to the recursive part as a guard.
WITH RECURSIVE chain AS (
    SELECT customer_id, name, 1 AS depth, CAST(name AS CHAR(500)) AS path
    FROM customers
    WHERE referred_by IS NULL
    UNION ALL
    SELECT c.customer_id, c.name, ch.depth + 1, CONCAT(ch.path, ' > ', c.name)
    FROM customers c
    JOIN chain ch ON c.referred_by = ch.customer_id
)
SELECT customer_id, name, depth, path
FROM chain
WHERE depth >= 2
ORDER BY customer_id;
