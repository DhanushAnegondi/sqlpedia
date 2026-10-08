-- =====================================================================
-- Campus - MySQL 8.0 solutions for the 31 questions in QUESTIONS.md
-- Run setup.sql first. Keyed -- @Q1 ... -- @Q31.
-- Lines marked TRAP are the common wrong answer, kept so you can run it and see why.
-- =====================================================================


-- =====================================================================
-- TOPIC 1 - Joins
-- =====================================================================

-- @Q1  Students with their major and advisor
-- TRAP: INNER JOINs drop every student without a major or an advisor (9 rows, not 13).
SELECT s.student_id, s.name, d.dept_name AS major, i.name AS advisor
FROM students s
JOIN departments d ON d.dept_id = s.dept_id
JOIN instructors i ON i.instructor_id = s.advisor_id
ORDER BY s.student_id;

-- Correct: LEFT JOIN keeps every student; COALESCE labels the missing major.
SELECT s.student_id,
       s.name,
       COALESCE(d.dept_name, 'Undeclared') AS major,
       i.name                              AS advisor
FROM students s
LEFT JOIN departments d ON d.dept_id = s.dept_id
LEFT JOIN instructors i ON i.instructor_id = s.advisor_id
ORDER BY s.student_id;


-- @Q2  Courses nobody has enrolled in
-- (a) LEFT JOIN anti-join: keep the courses whose join found nothing.
SELECT c.course_id, c.title
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.course_id
WHERE e.enrollment_id IS NULL
ORDER BY c.course_id;

-- (b) NOT EXISTS - same result, and safe even if the inner column has NULLs.
SELECT c.course_id, c.title
FROM courses c
WHERE NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.course_id)
ORDER BY c.course_id;


-- @Q3  Department headcounts (the fan-out trap)
-- TRAP: two one-to-many joins multiply - Computer Science gets 4 x 5 = 20 of each.
SELECT d.dept_name, COUNT(i.instructor_id) AS instructors, COUNT(s.student_id) AS students
FROM departments d
LEFT JOIN instructors i ON i.dept_id = d.dept_id
LEFT JOIN students s    ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY d.dept_id;

-- (a) Quick fix: COUNT(DISTINCT ...) undoes the multiplication.
SELECT d.dept_name,
       COUNT(DISTINCT i.instructor_id) AS instructors,
       COUNT(DISTINCT s.student_id)    AS students
FROM departments d
LEFT JOIN instructors i ON i.dept_id = d.dept_id
LEFT JOIN students s    ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY d.dept_id;

-- (b) Better at scale: aggregate each side first, then join one row to one row.
SELECT d.dept_name,
       COALESCE(i.n, 0) AS instructors,
       COALESCE(s.n, 0) AS students
FROM departments d
LEFT JOIN (SELECT dept_id, COUNT(*) AS n FROM instructors GROUP BY dept_id) i ON i.dept_id = d.dept_id
LEFT JOIN (SELECT dept_id, COUNT(*) AS n FROM students    GROUP BY dept_id) s ON s.dept_id = d.dept_id
ORDER BY d.dept_id;


-- @Q4  Instructors who out-earn their manager
-- Self-join: the same table twice, once as the employee and once as the manager.
SELECT e.name AS instructor, e.salary, m.name AS manager, m.salary AS manager_salary
FROM instructors e
JOIN instructors m ON m.instructor_id = e.manager_id
WHERE e.salary > m.salary
ORDER BY e.instructor_id;


-- =====================================================================
-- TOPIC 2 - NULL handling and data cleaning
-- =====================================================================

-- @Q5  COUNT(*) vs COUNT(column)
-- COUNT(*) counts rows; COUNT(col) counts non-NULL values of col.
SELECT enroll_year,
       COUNT(*)          AS students,
       COUNT(email)      AS with_email,
       COUNT(gpa)        AS with_gpa,
       COUNT(advisor_id) AS with_advisor
FROM students
GROUP BY enroll_year
ORDER BY enroll_year;


-- @Q6  Course averages and ungraded rows
-- AVG skips NULLs, which is what you want here. COALESCE(score, 0) turns
-- "not graded yet" into "scored zero" and drags the average down.
SELECT course_id,
       COUNT(*)                          AS enrollments,
       COUNT(score)                      AS graded,
       ROUND(AVG(score), 1)              AS avg_score,
       ROUND(AVG(COALESCE(score, 0)), 1) AS avg_if_zero
FROM enrollments
GROUP BY course_id
ORDER BY course_id;


-- @Q7  The NOT IN trap with prerequisites
-- TRAP: prereq_id contains NULLs, so "x NOT IN (..., NULL)" is never TRUE and this returns 0 rows.
SELECT course_id, title
FROM courses
WHERE course_id NOT IN (SELECT prereq_id FROM courses);

-- Correct: NOT EXISTS is NULL-safe (or filter the NULLs out inside the NOT IN).
SELECT c.course_id, c.title
FROM courses c
WHERE NOT EXISTS (SELECT 1 FROM courses x WHERE x.prereq_id = c.course_id)
ORDER BY c.course_id;


-- @Q8  NULLs last in MySQL
-- MySQL treats NULL as the smallest value: first in ASC, last in DESC. There is no NULLS LAST.
-- (a) Sort on "is it NULL?" first: FALSE (0) before TRUE (1).
SELECT student_id, name, gpa
FROM students
ORDER BY gpa IS NULL, gpa, student_id;

-- (b) The old trick: negate and sort DESC. -gpa DESC is gpa ASC, and NULLs stay last in DESC.
SELECT student_id, name, gpa
FROM students
ORDER BY -gpa DESC, student_id;


-- @Q9  Duplicate student accounts
-- TRAP: plain GROUP BY email finds nothing. MySQL's default collation ignores case,
-- but it is NO PAD, so the trailing space in 'julia@uni.edu ' still makes it different.
SELECT email, COUNT(*) AS accounts
FROM students
GROUP BY email
HAVING COUNT(*) > 1;

-- Correct: normalise first. GROUP_CONCAT lists the ids (default separator is a comma).
SELECT LOWER(TRIM(email))                            AS email,
       COUNT(*)                                      AS accounts,
       GROUP_CONCAT(student_id ORDER BY student_id)  AS student_ids
FROM students
WHERE email IS NOT NULL
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;


-- =====================================================================
-- TOPIC 3 - Aggregation and HAVING
-- =====================================================================

-- @Q10  Department GPA report
-- WHERE filters rows before grouping; HAVING filters groups after. AVG and MAX ignore NULL GPAs.
SELECT d.dept_name,
       COUNT(s.gpa)         AS students_with_gpa,
       ROUND(AVG(s.gpa), 2) AS avg_gpa,
       MAX(s.gpa)           AS max_gpa
FROM departments d
JOIN students s ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
HAVING COUNT(s.gpa) >= 2
ORDER BY avg_gpa DESC;


-- @Q11  Grade distribution pivot
-- Conditional aggregation. In MySQL a comparison is 1 or 0, so SUM(score >= 90) also works.
SELECT course_id,
       SUM(CASE WHEN score >= 90 THEN 1 ELSE 0 END)                AS a,
       SUM(CASE WHEN score >= 80 AND score < 90 THEN 1 ELSE 0 END) AS b,
       SUM(CASE WHEN score >= 70 AND score < 80 THEN 1 ELSE 0 END) AS c,
       SUM(CASE WHEN score >= 60 AND score < 70 THEN 1 ELSE 0 END) AS d,
       SUM(CASE WHEN score < 60 THEN 1 ELSE 0 END)                 AS f,
       COUNT(score)                                                AS graded
FROM enrollments
WHERE score IS NOT NULL
GROUP BY course_id
ORDER BY course_id;


-- @Q12  Pass rate per course
-- AVG of a 0/1 flag is a rate. MySQL averages it as DECIMAL, so no integer-division surprise.
SELECT course_id,
       COUNT(*)                                                   AS graded,
       SUM(CASE WHEN score >= 60 THEN 1 ELSE 0 END)               AS passed,
       ROUND(100 * AVG(CASE WHEN score >= 60 THEN 1 ELSE 0 END), 1) AS pass_rate_pct
FROM enrollments
WHERE score IS NOT NULL
GROUP BY course_id
ORDER BY pass_rate_pct, course_id;


-- @Q13  Duplicate enrollments
-- Group by the columns that should be unique; HAVING keeps the groups that aren't.
SELECT student_id,
       course_id,
       term,
       COUNT(*)                                            AS copies,
       GROUP_CONCAT(enrollment_id ORDER BY enrollment_id)  AS enrollment_ids
FROM enrollments
GROUP BY student_id, course_id, term
HAVING COUNT(*) > 1;


-- =====================================================================
-- TOPIC 4 - Subqueries and CTEs
-- =====================================================================

-- @Q14  Second highest salary
-- (a) MAX below the MAX. Returns NULL on its own when there is no second value.
SELECT MAX(salary) AS second_highest_salary
FROM instructors
WHERE salary < (SELECT MAX(salary) FROM instructors);

-- (b) DISTINCT + LIMIT/OFFSET, wrapped in a scalar subquery so "no row" becomes NULL.
SELECT (
    SELECT DISTINCT salary
    FROM instructors
    ORDER BY salary DESC
    LIMIT 1 OFFSET 1
) AS second_highest_salary;


-- @Q15  Above the course average
-- (a) Correlated subquery: the inner query re-runs for each outer row's course.
SELECT e.course_id, e.student_id, e.score,
       (SELECT ROUND(AVG(x.score), 1) FROM enrollments x WHERE x.course_id = e.course_id) AS course_avg
FROM enrollments e
WHERE e.score > (SELECT AVG(x.score) FROM enrollments x WHERE x.course_id = e.course_id)
ORDER BY e.course_id, e.student_id;

-- (b) Window function: compute the course average once per row, then filter outside.
SELECT course_id, student_id, score, ROUND(course_avg, 1) AS course_avg
FROM (
    SELECT course_id, student_id, score,
           AVG(score) OVER (PARTITION BY course_id) AS course_avg
    FROM enrollments
) t
WHERE score > course_avg
ORDER BY course_id, student_id;


-- @Q16  Highest-paid department (keep ties)
-- LIMIT 1 would silently drop a tied department. Compare with the MAX instead.
WITH payroll AS (
    SELECT d.dept_name, SUM(i.salary) AS total_salary
    FROM departments d
    JOIN instructors i ON i.dept_id = d.dept_id
    GROUP BY d.dept_id, d.dept_name
)
SELECT dept_name, total_salary
FROM payroll
WHERE total_salary = (SELECT MAX(total_salary) FROM payroll);


-- @Q17  Passed every Mathematics course (relational division)
-- (a) Count the distinct Mathematics courses passed and compare with how many exist.
SELECT s.student_id, s.name
FROM students s
JOIN enrollments e ON e.student_id = s.student_id
JOIN courses c     ON c.course_id  = e.course_id
WHERE c.dept_id = 20
  AND e.score >= 60
GROUP BY s.student_id, s.name
HAVING COUNT(DISTINCT e.course_id) = (SELECT COUNT(*) FROM courses WHERE dept_id = 20)
ORDER BY s.student_id;

-- (b) Double NOT EXISTS: there is no Mathematics course this student hasn't passed.
SELECT s.student_id, s.name
FROM students s
WHERE NOT EXISTS (
    SELECT 1
    FROM courses c
    WHERE c.dept_id = 20
      AND NOT EXISTS (SELECT 1
                      FROM enrollments e
                      WHERE e.student_id = s.student_id
                        AND e.course_id  = c.course_id
                        AND e.score >= 60)
)
ORDER BY s.student_id;


-- =====================================================================
-- TOPIC 5 - Window functions: ranking
-- =====================================================================

-- @Q18  Top 2 scores per course
-- DENSE_RANK: "the top 2 score values", so tied students share a rank and both come back.
WITH ranked AS (
    SELECT course_id, student_id, score,
           DENSE_RANK() OVER (PARTITION BY course_id ORDER BY score DESC) AS rnk
    FROM enrollments
    WHERE score IS NOT NULL
)
SELECT course_id, rnk, student_id, score
FROM ranked
WHERE rnk <= 2
ORDER BY course_id, rnk, student_id;


-- @Q19  Three rankings side by side
-- ROW_NUMBER never ties; RANK ties then skips; DENSE_RANK ties without gaps.
SELECT dept_id, instructor_id, name, salary,
       ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, instructor_id) AS row_num,
       RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC)                AS rnk,
       DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC)                AS dense_rnk
FROM instructors
ORDER BY dept_id, row_num;


-- @Q20  Nth highest salary
-- (a) DENSE_RANK - rank N is the Nth distinct salary. Change the 3 to change N.
SELECT (
    SELECT DISTINCT salary
    FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM instructors) r
    WHERE rnk = 3
) AS nth_highest_salary;

-- (b) LIMIT / OFFSET over distinct values: OFFSET N-1.
SELECT (
    SELECT DISTINCT salary
    FROM instructors
    ORDER BY salary DESC
    LIMIT 1 OFFSET 2
) AS nth_highest_salary;


-- @Q21  Each student's best course
-- ROW_NUMBER with a full tie-break gives exactly one row per student.
SELECT student_id, course_id, score
FROM (
    SELECT student_id, course_id, score,
           ROW_NUMBER() OVER (PARTITION BY student_id
                              ORDER BY score DESC, enrolled_on, course_id) AS rn
    FROM enrollments
    WHERE score IS NOT NULL
) t
WHERE rn = 1
ORDER BY student_id;


-- =====================================================================
-- TOPIC 6 - Window functions: running totals and offsets
-- =====================================================================

-- @Q22  Running credits per student
-- TRAP: ORDER BY enrolled_on alone uses the default RANGE frame, so two enrollments
-- on the same day get the same running total (both of student 1's 2024-08-20 rows show 8).
SELECT e.student_id, e.course_id, e.enrolled_on, c.credits,
       SUM(c.credits) OVER (PARTITION BY e.student_id ORDER BY e.enrolled_on) AS running_credits
FROM enrollments e
JOIN courses c ON c.course_id = e.course_id
WHERE e.student_id IN (1, 3)
ORDER BY e.student_id, e.enrolled_on, e.course_id;

-- Correct: a unique ordering plus an explicit ROWS frame.
SELECT e.student_id, e.course_id, e.enrolled_on, c.credits,
       SUM(c.credits) OVER (PARTITION BY e.student_id
                            ORDER BY e.enrolled_on, e.course_id
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_credits
FROM enrollments e
JOIN courses c ON c.course_id = e.course_id
WHERE e.student_id IN (1, 3)
ORDER BY e.student_id, e.enrolled_on, e.course_id;


-- @Q23  Score change between terms
-- Aggregate per student and term first, then LAG over the aggregated rows.
-- Order terms by date, not by the term string ('2025-FA' sorts before '2025-SP').
WITH t AS (
    SELECT student_id, term, MIN(enrolled_on) AS term_start, AVG(score) AS avg_score
    FROM enrollments
    WHERE score IS NOT NULL
    GROUP BY student_id, term
),
l AS (
    SELECT student_id, term, avg_score,
           LAG(avg_score) OVER (PARTITION BY student_id ORDER BY term_start) AS prev_avg
    FROM t
)
SELECT student_id, term,
       ROUND(avg_score, 1)            AS avg_score,
       ROUND(prev_avg, 1)             AS prev_avg,
       ROUND(avg_score - prev_avg, 1) AS change_pts
FROM l
WHERE prev_avg IS NOT NULL
ORDER BY student_id;


-- @Q24  Salary share of department
-- Window aggregates keep every row; GROUP BY would collapse them.
SELECT dept_id, name, salary,
       ROUND(AVG(salary) OVER (PARTITION BY dept_id), 2)               AS dept_avg,
       ROUND(100 * salary / SUM(salary) OVER (PARTITION BY dept_id), 1) AS pct_of_dept
FROM instructors
ORDER BY dept_id, salary DESC, instructor_id;


-- @Q25  First and latest course per student
-- TRAP: LAST_VALUE with only ORDER BY uses the frame "start .. current row",
-- so it returns the current row's course, not the last one.
SELECT DISTINCT student_id,
       FIRST_VALUE(course_id) OVER (PARTITION BY student_id ORDER BY enrolled_on, course_id) AS first_course,
       LAST_VALUE(course_id)  OVER (PARTITION BY student_id ORDER BY enrolled_on, course_id) AS latest_course
FROM enrollments
ORDER BY student_id;

-- Correct: widen the frame to the whole partition.
SELECT DISTINCT student_id,
       FIRST_VALUE(course_id) OVER w AS first_course,
       LAST_VALUE(course_id)  OVER w AS latest_course
FROM enrollments
WINDOW w AS (PARTITION BY student_id ORDER BY enrolled_on, course_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
ORDER BY student_id;


-- =====================================================================
-- TOPIC 7 - Dates and gaps-and-islands
-- =====================================================================

-- @Q26  Enrollments per term, in the right order
-- TRAP: ORDER BY term sorts the strings: 2024-FA, 2025-FA, 2025-SP - spring lands after fall.
SELECT term, COUNT(*) AS enrollments
FROM enrollments
GROUP BY term
ORDER BY term;

-- Correct: order by a real date. MIN(enrolled_on) is the term's first day here.
WITH t AS (
    SELECT term, MIN(enrolled_on) AS term_start, COUNT(*) AS enrollments
    FROM enrollments
    GROUP BY term
)
SELECT term,
       enrollments,
       LAG(enrollments) OVER (ORDER BY term_start)               AS prev_enrollments,
       enrollments - LAG(enrollments) OVER (ORDER BY term_start) AS change_count
FROM t
ORDER BY term_start;


-- @Q27  Login streaks of 3 or more days
-- date - ROW_NUMBER() days is constant inside a run of consecutive dates.
-- DISTINCT first: student 3 logged in twice on 2025-03-03, which would shift the numbering.
WITH d AS (
    SELECT DISTINCT student_id, login_date
    FROM portal_logins
),
n AS (
    SELECT student_id, login_date,
           ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY login_date) AS rn
    FROM d
),
g AS (
    SELECT student_id, login_date,
           DATE_SUB(login_date, INTERVAL rn DAY) AS grp
    FROM n
)
SELECT student_id,
       MIN(login_date) AS streak_start,
       MAX(login_date) AS streak_end,
       COUNT(*)        AS days
FROM g
GROUP BY student_id, grp
HAVING COUNT(*) >= 3
ORDER BY student_id, streak_start;


-- @Q28  Next-day retention
-- First login per student, then check for a login exactly one day later.
WITH f AS (
    SELECT student_id, MIN(login_date) AS first_login
    FROM portal_logins
    GROUP BY student_id
)
SELECT COUNT(*) AS students,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM portal_logins p
                             WHERE p.student_id = f.student_id
                               AND p.login_date = f.first_login + INTERVAL 1 DAY)
                THEN 1 ELSE 0 END) AS retained,
       ROUND(SUM(CASE WHEN EXISTS (SELECT 1 FROM portal_logins p
                                   WHERE p.student_id = f.student_id
                                     AND p.login_date = f.first_login + INTERVAL 1 DAY)
                      THEN 1 ELSE 0 END) / COUNT(*), 2) AS fraction
FROM f;


-- @Q29  Inactive students
-- LEFT JOIN keeps students who never logged in; their MAX is NULL and so is DATEDIFF.
-- DATEDIFF(later, earlier) returns whole days. NULLs sort last in DESC, so put them first explicitly.
SELECT s.student_id,
       s.name,
       MAX(p.login_date)                         AS last_login,
       DATEDIFF('2025-03-31', MAX(p.login_date)) AS days_inactive
FROM students s
LEFT JOIN portal_logins p ON p.student_id = s.student_id
GROUP BY s.student_id, s.name
ORDER BY MAX(p.login_date) IS NULL DESC, days_inactive DESC, s.student_id;


-- =====================================================================
-- TOPIC 8 - Recursive CTEs
-- =====================================================================

-- @Q30  Prerequisite chain
-- Anchor = the course itself; each step follows prereq_id one level down.
-- Cast the path wide in the anchor: MySQL sizes the column from the anchor row.
WITH RECURSIVE chain AS (
    SELECT course_id, title, prereq_id, 0 AS depth, CAST(course_id AS CHAR(200)) AS path
    FROM courses
    WHERE course_id = 'CS401'
    UNION ALL
    SELECT c.course_id, c.title, c.prereq_id, ch.depth + 1, CONCAT(ch.path, ' > ', c.course_id)
    FROM courses c
    JOIN chain ch ON c.course_id = ch.prereq_id
)
SELECT depth, course_id, title, path
FROM chain
ORDER BY depth;


-- @Q31  Instructor org chart
-- Anchor = department heads (no manager). Each step adds the people who report to them.
-- Add  WHERE o.level < 20  to the recursive part as a guard if the data could contain a cycle.
WITH RECURSIVE org AS (
    SELECT instructor_id, name, 1 AS level, CAST(name AS CHAR(500)) AS chain
    FROM instructors
    WHERE manager_id IS NULL
    UNION ALL
    SELECT i.instructor_id, i.name, o.level + 1, CONCAT(o.chain, ' > ', i.name)
    FROM instructors i
    JOIN org o ON i.manager_id = o.instructor_id
)
SELECT instructor_id, name, level, chain
FROM org
ORDER BY instructor_id;
