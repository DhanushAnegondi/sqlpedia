# Generates sets/campus/QUESTIONS.md. Expected outputs come from running DuckDB
# equivalents of the MySQL solutions against sets/campus/setup.sql.
import csv, io, subprocess, sys, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "sets", "campus")).replace("\\", "/")
D1 = lambda x: f"CAST(ROUND({x}, 1) AS DECIMAL(10,1))"
D2 = lambda x: f"CAST(ROUND({x}, 2) AS DECIMAL(10,2))"

def run(sql):
    script = f".read '{ROOT}/setup.sql'\n.mode csv\n.nullvalue NULL\n.headers on\n{sql.strip().rstrip(';')};\n"
    p = subprocess.run(["duckdb"], input=script, capture_output=True, text=True, encoding="utf-8")
    if p.returncode or p.stderr.strip():
        sys.exit(f"DuckDB error:\n{p.stderr}\n--- in ---\n{sql}")
    rows = list(csv.reader(io.StringIO(p.stdout)))
    return rows[0], rows[1:]

def md_table(cols, rows):
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out)

TOPICS = [
 ("1", "Joins"),
 ("2", "NULL handling and data cleaning"),
 ("3", "Aggregation and HAVING"),
 ("4", "Subqueries and CTEs"),
 ("5", "Window functions: ranking"),
 ("6", "Window functions: running totals and offsets"),
 ("7", "Dates and gaps-and-islands"),
 ("8", "Recursive CTEs"),
]

# (topic, number, title, lc, statement, hints[], parts[(label, query, note_after)])
P = []
def q(topic, title, lc, statement, parts, hints=()):
    P.append((topic, len(P) + 1, title, lc, statement, list(hints), parts))

# ---------------- Topic 1: Joins
q("1", "Students with their major and advisor", "175",
  "List all 13 students with their major's department name as `major` and their advisor's name as `advisor`. A student with no major shows `Undeclared`; a student with no advisor shows NULL. Sort by `student_id`.",
  [("", """SELECT s.student_id, s.name, COALESCE(d.dept_name, 'Undeclared') AS major, i.name AS advisor
FROM students s LEFT JOIN departments d ON d.dept_id = s.dept_id
LEFT JOIN instructors i ON i.instructor_id = s.advisor_id ORDER BY s.student_id""", None)],
  ["If you get 9 rows, one of your joins is an INNER JOIN."])
q("1", "Courses nobody has enrolled in", "183",
  "Return `course_id` and `title` of every course with no enrollments at all. Solve it with `LEFT JOIN … IS NULL` and again with `NOT EXISTS`.",
  [("", """SELECT c.course_id, c.title FROM courses c
WHERE NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.course_id) ORDER BY c.course_id""", None)])
q("1", "Department headcounts", None,
  "For every department, including empty ones: the number of instructors and the number of students majoring in it. Sort by `dept_id`. Then explain what goes wrong if you join both tables and use `COUNT`.",
  [("", """SELECT d.dept_name, COUNT(DISTINCT i.instructor_id) AS instructors, COUNT(DISTINCT s.student_id) AS students
FROM departments d LEFT JOIN instructors i ON i.dept_id = d.dept_id LEFT JOIN students s ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name ORDER BY d.dept_id""",
    "Joining both tables and counting gives Computer Science **20** instructors and **20** students: 4 instructor rows × 5 student rows.")],
  ["Two one-to-many joins from the same parent multiply each other."])
q("1", "Instructors who out-earn their manager", "181",
  "Instructors whose salary is higher than their manager's. Show `instructor`, `salary`, `manager`, `manager_salary`, sorted by the instructor's id.",
  [("", """SELECT e.name AS instructor, e.salary, m.name AS manager, m.salary AS manager_salary
FROM instructors e JOIN instructors m ON m.instructor_id = e.manager_id
WHERE e.salary > m.salary ORDER BY e.instructor_id""", None)])

# ---------------- Topic 2: NULLs
q("2", "COUNT(*) vs COUNT(column)", None,
  "Per `enroll_year`: the number of students, and how many of them have an email, a GPA and an advisor. One pass over `students`, sorted by year.",
  [("", """SELECT enroll_year, COUNT(*) AS students, COUNT(email) AS with_email, COUNT(gpa) AS with_gpa,
COUNT(advisor_id) AS with_advisor FROM students GROUP BY enroll_year ORDER BY enroll_year""", None)])
q("2", "Course averages and ungraded rows", None,
  f"Per course that has enrollments: total enrollments, graded enrollments (score not NULL), the average score of graded rows as `avg_score`, and the average if ungraded rows counted as 0 as `avg_if_zero`. Both averages to 1 dp. Sort by `course_id`. Which average is the honest one?",
  [("", f"""SELECT course_id, COUNT(*) AS enrollments, COUNT(score) AS graded, {D1('AVG(score)')} AS avg_score,
{D1('AVG(COALESCE(score, 0))')} AS avg_if_zero FROM enrollments GROUP BY course_id ORDER BY course_id""",
    "CS301 has no graded rows yet, so its `avg_score` is NULL — not 0.")])
q("2", "The NOT IN trap", None,
  "Courses that are not the prerequisite of any other course. Try `NOT IN (SELECT prereq_id FROM courses)` first and explain the result.",
  [("", """SELECT c.course_id, c.title FROM courses c
WHERE NOT EXISTS (SELECT 1 FROM courses x WHERE x.prereq_id = c.course_id) ORDER BY c.course_id""",
    "`NOT IN` returns **0 rows**: `prereq_id` contains NULLs, and `x NOT IN (…, NULL)` is never true.")])
q("2", "NULLs last", None,
  "List students by GPA from lowest to highest, with the students who have no GPA yet at the end, then by `student_id`. MySQL has no `NULLS LAST` — find two ways.",
  [("", "SELECT student_id, name, gpa FROM students ORDER BY gpa ASC NULLS LAST, student_id", None)],
  ["In MySQL, NULL sorts as the smallest value: first in ascending order, last in descending order."])
q("2", "Duplicate student accounts", "182",
  "Emails used by more than one student, treating case and surrounding spaces as irrelevant. Show the normalised email, the number of accounts and the student ids as a comma-separated list in ascending order (`student_ids`).",
  [("", """SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS accounts, string_agg(CAST(student_id AS VARCHAR), ',' ORDER BY student_id) AS student_ids
FROM students WHERE email IS NOT NULL GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1""",
    "A plain `GROUP BY email` finds **nothing**: one of the two emails ends in a space.")],
  ["MySQL's `GROUP_CONCAT(col ORDER BY col)` builds the list."])

# ---------------- Topic 3: Aggregation
q("3", "Department GPA report", None,
  "For departments with at least 2 students who have a GPA: the number of those students, the average GPA (2 dp) and the highest GPA. Sort by average GPA, highest first.",
  [("", f"""SELECT d.dept_name, COUNT(s.gpa) AS students_with_gpa, {D2('AVG(s.gpa)')} AS avg_gpa, MAX(s.gpa) AS max_gpa
FROM departments d JOIN students s ON s.dept_id = d.dept_id GROUP BY d.dept_id, d.dept_name
HAVING COUNT(s.gpa) >= 2 ORDER BY avg_gpa DESC""", None)])
q("3", "Grade distribution pivot", "1179",
  "For each course with graded rows, count the grades as columns: `a` (90+), `b` (80–89.9), `c` (70–79.9), `d` (60–69.9), `f` (below 60), plus `graded`. Sort by `course_id`.",
  [("", """SELECT course_id, SUM(CASE WHEN score >= 90 THEN 1 ELSE 0 END) AS a,
SUM(CASE WHEN score >= 80 AND score < 90 THEN 1 ELSE 0 END) AS b, SUM(CASE WHEN score >= 70 AND score < 80 THEN 1 ELSE 0 END) AS c,
SUM(CASE WHEN score >= 60 AND score < 70 THEN 1 ELSE 0 END) AS d, SUM(CASE WHEN score < 60 THEN 1 ELSE 0 END) AS f,
COUNT(score) AS graded FROM enrollments WHERE score IS NOT NULL GROUP BY course_id ORDER BY course_id""", None)])
q("3", "Pass rate per course", None,
  "For each course with graded rows: graded count, passed count (score 60 or more) and pass rate % (1 dp). Sort by pass rate, lowest first, then `course_id`.",
  [("", f"""SELECT course_id, COUNT(*) AS graded, SUM(CASE WHEN score >= 60 THEN 1 ELSE 0 END) AS passed,
{D1('100.0 * AVG(CASE WHEN score >= 60 THEN 1 ELSE 0 END)')} AS pass_rate_pct
FROM enrollments WHERE score IS NOT NULL GROUP BY course_id ORDER BY pass_rate_pct, course_id""", None)])
q("3", "Duplicate enrollments", None,
  "A student should be enrolled in a course at most once per term. Find every (`student_id`, `course_id`, `term`) that appears more than once, with the number of copies and the `enrollment_ids` (comma-separated, ascending).",
  [("", """SELECT student_id, course_id, term, COUNT(*) AS copies, string_agg(CAST(enrollment_id AS VARCHAR), ',' ORDER BY enrollment_id) AS enrollment_ids
FROM enrollments GROUP BY student_id, course_id, term HAVING COUNT(*) > 1""", None)])

# ---------------- Topic 4: Subqueries
q("4", "Second highest salary", "176",
  "Return the second-highest **distinct** instructor salary as `second_highest_salary`. If there isn't one, return a single row with NULL.",
  [("", "SELECT MAX(salary) AS second_highest_salary FROM instructors WHERE salary < (SELECT MAX(salary) FROM instructors)", None)])
q("4", "Above the course average", None,
  "Graded enrollments whose score beats the average graded score of their course. Show `course_id`, `student_id`, `score` and `course_avg` (1 dp), sorted by course then student. Solve it with a correlated subquery and with a window function.",
  [("", f"""SELECT course_id, student_id, score, {D1('course_avg')} AS course_avg FROM (
SELECT course_id, student_id, score, AVG(score) OVER (PARTITION BY course_id) AS course_avg FROM enrollments) t
WHERE score > course_avg ORDER BY course_id, student_id""", None)])
q("4", "Highest-paid department", None,
  "The department with the largest total instructor salary, as `dept_name` and `total_salary`. Write it so that tied departments would all be returned — no `LIMIT 1`.",
  [("", """WITH payroll AS (SELECT d.dept_name, SUM(i.salary) AS total_salary FROM departments d JOIN instructors i ON i.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name) SELECT dept_name, total_salary FROM payroll WHERE total_salary = (SELECT MAX(total_salary) FROM payroll)""", None)])
q("4", "Passed every Mathematics course", "1045",
  "Students who have a passing score (60 or more) in **every** Mathematics course (`dept_id` 20). In-progress enrollments don't count. Two ways: `HAVING COUNT(DISTINCT …)` and double `NOT EXISTS`.",
  [("", """SELECT s.student_id, s.name FROM students s WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.dept_id = 20
AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.student_id AND e.course_id = c.course_id AND e.score >= 60))
ORDER BY s.student_id""", None)],
  ["Ivan is enrolled in both Mathematics courses, but one has no score yet."])

# ---------------- Topic 5: Ranking
q("5", "Top 2 scores per course", "185",
  "For each course, the students holding the top 2 distinct scores (graded rows only), using `DENSE_RANK`. Show `course_id`, `rnk`, `student_id`, `score`.",
  [("", """WITH r AS (SELECT course_id, student_id, score, DENSE_RANK() OVER (PARTITION BY course_id ORDER BY score DESC) AS rnk
FROM enrollments WHERE score IS NOT NULL) SELECT course_id, rnk, student_id, score FROM r WHERE rnk <= 2 ORDER BY course_id, rnk, student_id""", None)])
q("5", "ROW_NUMBER vs RANK vs DENSE_RANK", "178",
  "Rank instructors by salary (highest first) within their department three ways: `row_num` (ties broken by `instructor_id`), `rnk` and `dense_rnk`. Be ready to explain the difference.",
  [("", """SELECT dept_id, instructor_id, name, salary,
ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, instructor_id) AS row_num,
RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk,
DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dense_rnk
FROM instructors ORDER BY dept_id, row_num""", None)])
q("5", "Nth highest salary", "177",
  "The 3rd highest distinct salary as `nth_highest_salary`, written so changing N is a one-number edit. Solve it with `DENSE_RANK` and with `LIMIT … OFFSET`.",
  [("", """SELECT (SELECT DISTINCT salary FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM instructors) r WHERE rnk = 3) AS nth_highest_salary""", None)])
q("5", "Each student's best course", None,
  "Exactly one row per student with graded enrollments: their highest-scoring course. Break ties by the earlier `enrolled_on`, then `course_id`. Show `student_id`, `course_id`, `score`.",
  [("", """SELECT student_id, course_id, score FROM (SELECT student_id, course_id, score,
ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY score DESC, enrolled_on, course_id) AS rn
FROM enrollments WHERE score IS NOT NULL) t WHERE rn = 1 ORDER BY student_id""", None)])

# ---------------- Topic 6: Running / offsets
q("6", "Running credits per student", "1204",
  "For students 1 and 3, every enrollment with the course's credits and a running total of credits per student, in `enrolled_on` order (ties broken by `course_id`). Then: what changes if you `ORDER BY enrolled_on` only?",
  [("", """SELECT e.student_id, e.course_id, e.enrolled_on, c.credits,
SUM(c.credits) OVER (PARTITION BY e.student_id ORDER BY e.enrolled_on, e.course_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_credits
FROM enrollments e JOIN courses c ON c.course_id = e.course_id WHERE e.student_id IN (1, 3) ORDER BY e.student_id, e.enrolled_on, e.course_id""",
    "With `ORDER BY enrolled_on` alone, the default `RANGE` frame gives both of student 1's 2024-08-20 rows **8** — the whole day at once.")])
q("6", "Score change between terms", "197",
  "Per student and term: the average graded score (1 dp), the previous graded term's average and the change. Only rows that have a previous term. Order terms by date, not by the term string. Sort by `student_id`.",
  [("", f"""WITH t AS (SELECT student_id, term, MIN(enrolled_on) AS term_start, AVG(score) AS avg_score FROM enrollments WHERE score IS NOT NULL GROUP BY student_id, term),
l AS (SELECT student_id, term, avg_score, LAG(avg_score) OVER (PARTITION BY student_id ORDER BY term_start) AS prev_avg FROM t)
SELECT student_id, term, {D1('avg_score')} AS avg_score, {D1('prev_avg')} AS prev_avg, {D1('avg_score - prev_avg')} AS change_pts
FROM l WHERE prev_avg IS NOT NULL ORDER BY student_id""", None)],
  ["Aggregate to one row per student and term first, then use `LAG`."])
q("6", "Salary share of department", None,
  "Every instructor with their department's average salary (2 dp) and their salary as a % of the department's total payroll (1 dp). Sort by `dept_id`, then salary (highest first), then `instructor_id`.",
  [("", f"""SELECT dept_id, name, salary, {D2('AVG(salary) OVER (PARTITION BY dept_id)')} AS dept_avg,
{D1('100 * salary / SUM(salary) OVER (PARTITION BY dept_id)')} AS pct_of_dept FROM instructors ORDER BY dept_id, salary DESC, instructor_id""", None)])
q("6", "First and latest course per student", None,
  "One row per student with enrollments: their first course and their latest course by `enrolled_on` (ties broken by `course_id`), using `FIRST_VALUE` and `LAST_VALUE`.",
  [("", """SELECT DISTINCT student_id, FIRST_VALUE(course_id) OVER w AS first_course, LAST_VALUE(course_id) OVER w AS latest_course
FROM enrollments WINDOW w AS (PARTITION BY student_id ORDER BY enrolled_on, course_id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
ORDER BY student_id""", None)],
  ["If `LAST_VALUE` keeps returning the current row's course, look at the window frame."])

# ---------------- Topic 7: Dates
q("7", "Enrollments per term, in order", None,
  "Enrollments per term in chronological order, with the previous term's count and the change. Check what `ORDER BY term` does first.",
  [("", """WITH t AS (SELECT term, MIN(enrolled_on) AS term_start, COUNT(*) AS enrollments FROM enrollments GROUP BY term)
SELECT term, enrollments, LAG(enrollments) OVER (ORDER BY term_start) AS prev_enrollments,
enrollments - LAG(enrollments) OVER (ORDER BY term_start) AS change_count FROM t ORDER BY term_start""",
    "`ORDER BY term` sorts the strings: 2024-FA, **2025-FA**, 2025-SP — spring lands after fall.")])
q("7", "Login streaks", "180 / 1285",
  "Students who logged in to the portal on 3 or more consecutive days. Return `student_id`, `streak_start`, `streak_end` and `days`.",
  [("", """WITH d AS (SELECT DISTINCT student_id, login_date FROM portal_logins),
n AS (SELECT student_id, login_date, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY login_date) AS rn FROM d),
g AS (SELECT student_id, login_date, login_date - CAST(rn AS INTEGER) AS grp FROM n)
SELECT student_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM g GROUP BY student_id, grp HAVING COUNT(*) >= 3 ORDER BY student_id, streak_start""", None)],
  ["`date − ROW_NUMBER()` days is constant inside a run. Then check what happens on a day with two logins."])
q("7", "Next-day retention", "550",
  "Of the students who ever logged in, what fraction logged in again on the day right after their first login? Return `students`, `retained` and `fraction` (2 dp).",
  [("", f"""WITH f AS (SELECT student_id, MIN(login_date) AS first_login FROM portal_logins GROUP BY student_id),
r AS (SELECT f.student_id, EXISTS (SELECT 1 FROM portal_logins p WHERE p.student_id = f.student_id AND p.login_date = f.first_login + INTERVAL 1 DAY) AS kept FROM f)
SELECT COUNT(*) AS students, SUM(CASE WHEN kept THEN 1 ELSE 0 END) AS retained, {D2('SUM(CASE WHEN kept THEN 1 ELSE 0 END) / COUNT(*)')} AS fraction FROM r""", None)])
q("7", "Inactive students", None,
  "As of 2025-03-31: every student with their last login date and the number of days since it (`days_inactive`). Students who never logged in show NULL for both and come first; then most inactive first, then `student_id`.",
  [("", """SELECT s.student_id, s.name, MAX(p.login_date) AS last_login, DATE '2025-03-31' - MAX(p.login_date) AS days_inactive
FROM students s LEFT JOIN portal_logins p ON p.student_id = s.student_id GROUP BY s.student_id, s.name
ORDER BY MAX(p.login_date) IS NULL DESC, days_inactive DESC, s.student_id""", None)],
  ["`DATEDIFF(later, earlier)` returns whole days in MySQL."])

# ---------------- Topic 8: Recursive
q("8", "Prerequisite chain", None,
  "`WITH RECURSIVE`: everything you must take before CS401, as `depth` (CS401 itself is 0), `course_id`, `title` and `path`, like `CS401 > CS301`.",
  [("", """WITH RECURSIVE chain AS (SELECT course_id, title, prereq_id, 0 AS depth, CAST(course_id AS VARCHAR) AS path FROM courses WHERE course_id = 'CS401'
UNION ALL SELECT c.course_id, c.title, c.prereq_id, ch.depth + 1, CONCAT(ch.path, ' > ', c.course_id) FROM courses c JOIN chain ch ON c.course_id = ch.prereq_id)
SELECT depth, course_id, title, path FROM chain ORDER BY depth""", None)])
q("8", "Instructor org chart", "1270",
  "Every instructor with their `level` (department heads are 1) and their reporting `chain` from the head down, like `Ada Byron > Alan Reed`. Sort by `instructor_id`.",
  [("", """WITH RECURSIVE org AS (SELECT instructor_id, name, 1 AS level, CAST(name AS VARCHAR) AS chain FROM instructors WHERE manager_id IS NULL
UNION ALL SELECT i.instructor_id, i.name, o.level + 1, CONCAT(o.chain, ' > ', i.name) FROM instructors i JOIN org o ON i.manager_id = o.instructor_id)
SELECT instructor_id, name, level, chain FROM org ORDER BY instructor_id""", None)])

# ---------------- write
out = []
out.append("# Campus — 31 MySQL interview questions by pattern, one university dataset\n")
out.append("A small university: departments, instructors, students, courses, enrollments and portal logins, Aug 2024 – Aug 2025. Every question is grouped by the pattern it drills, and every answer is MySQL 8.0.\n")
out.append("**Setup:** run `setup.sql` in MySQL Workbench — it drops and recreates the six tables.  ")
out.append("**Check yourself:** every question has its expected output in a fold, computed by running the reference queries.  ")
out.append("**Solutions:** `solutions.sql`, keyed `-- @Q1` … `-- @Q31`, MySQL 8.0. Two approaches where interviewers ask for both, plus the common wrong answer marked `TRAP`.\n")
out.append("---\n\n## The data\n")
out.append("""```mermaid
erDiagram
    departments ||--o{ instructors : employs
    departments |o--o{ students    : "majors in"
    departments ||--o{ courses     : offers
    instructors |o--o{ instructors : "manages (manager_id)"
    instructors |o--o{ students    : advises
    instructors ||--o{ courses     : teaches
    courses     |o--o{ courses     : "requires (prereq_id)"
    students    ||--o{ enrollments : "enrolls in"
    courses     ||--o{ enrollments : has
    students    ||--o{ portal_logins : "logs in"
```
""")
counts = {t: run(f"SELECT COUNT(*) FROM {t}")[1][0][0] for t in ["departments","instructors","students","courses","enrollments","portal_logins"]}
cols = {"departments":"dept_id, dept_name, building, budget","instructors":"instructor_id, name, dept_id, hire_date, salary, manager_id",
        "students":"student_id, name, email, dept_id, enroll_year, gpa, advisor_id","courses":"course_id, title, dept_id, credits, prereq_id, instructor_id",
        "enrollments":"enrollment_id, student_id, course_id, term, enrolled_on, score","portal_logins":"student_id, login_date"}
out.append("| Table | Rows | Columns |\n|---|---:|---|")
for t in cols: out.append(f"| `{t}` | {counts[t]} | {cols[t]} |")
out.append("")
out.append("**Conventions:** a score of 60 or more is a pass. A NULL `score` means in progress or incomplete — never zero. Terms run `2024-FA` (Aug 2024), `2025-SP` (Jan 2025), `2025-FA` (Aug 2025). Break ties on the id column unless the question says to keep ties.\n")
out.append("**Planted on purpose** (this is what interviewers test):")
for t in ["Two accounts for one student: `JULIA@uni.edu` and `julia@uni.edu ` (with a trailing space).",
          "NULLs in `email`, `gpa`, `dept_id` (undeclared majors), `advisor_id`, `manager_id`, `prereq_id` and `score`.",
          "Ties in salaries, GPAs and course scores.",
          "A duplicated enrollment, and two enrollments by the same student on the same day.",
          "Term labels that sort wrongly as strings.",
          "Three courses nobody took, a department with no instructors or students, and a student who never logged in.",
          "Instructors who earn more than their manager.",
          "Two logins by one student on the same day inside a streak."]:
    out.append(f"- {t}")
out.append("")
out.append("**Short on time? Do these 10 first:** Q1, Q3, Q7, Q9, Q14, Q17, Q18, Q22, Q27, Q31.\n")

for tid, ttitle in TOPICS:
    out.append(f"---\n\n## Topic {tid} — {ttitle}\n")
    for (topic, n, title, lc, stmt, hints, parts) in P:
        if topic != tid: continue
        out.append(f"### Q{n} · {title}" + (f" `≈ LC {lc}`" if lc else ""))
        out.append(stmt)
        for h in hints:
            out.append("<details><summary>Hint</summary>\n\n" + h + "\n</details>")
        for (label, sql, note) in parts:
            c, rows = run(sql)
            body = md_table(c, rows) + "\n" + (f"\n{note}\n" if note else "")
            out.append(f"<details><summary>Expected{' (' + label + ')' if label else ''}</summary>\n\n{body}\n</details>")
        out.append("")

open(os.path.join(ROOT, "QUESTIONS.md"), "w", encoding="utf-8", newline="\n").write("\n".join(out).rstrip() + "\n")
print("wrote", len(P), "problems")
