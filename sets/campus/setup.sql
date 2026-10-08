-- ============================================================
-- Campus - a small university for SQL interview practice
-- 6 tables, Aug 2024 - Aug 2025. Written for MySQL 8.0 (standard SQL, also runs on DuckDB).
-- Re-runnable: drops and recreates everything.
-- ============================================================

DROP TABLE IF EXISTS portal_logins;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS departments;

CREATE TABLE departments (
    dept_id    INT PRIMARY KEY,
    dept_name  VARCHAR(50)   NOT NULL,
    building   VARCHAR(50)   NOT NULL,
    budget     DECIMAL(12,2) NOT NULL
);

CREATE TABLE instructors (
    instructor_id  INT PRIMARY KEY,
    name           VARCHAR(50)   NOT NULL,
    dept_id        INT           NOT NULL REFERENCES departments (dept_id),
    hire_date      DATE          NOT NULL,
    salary         DECIMAL(10,2) NOT NULL,
    manager_id     INT                      -- instructor_id of their manager, NULL for department heads
);

CREATE TABLE students (
    student_id   INT PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL,
    email        VARCHAR(100),             -- NULL for one student
    dept_id      INT REFERENCES departments (dept_id),  -- major; NULL = undeclared
    enroll_year  INT          NOT NULL,
    gpa          DECIMAL(3,2),             -- NULL until the first grades are in
    advisor_id   INT REFERENCES instructors (instructor_id)  -- NULL = no advisor assigned
);

CREATE TABLE courses (
    course_id      VARCHAR(10) PRIMARY KEY,
    title          VARCHAR(50) NOT NULL,
    dept_id        INT         NOT NULL REFERENCES departments (dept_id),
    credits        INT         NOT NULL,
    prereq_id      VARCHAR(10),            -- course_id of the prerequisite, NULL if none
    instructor_id  INT         NOT NULL REFERENCES instructors (instructor_id)
);

CREATE TABLE enrollments (
    enrollment_id  INT PRIMARY KEY,
    student_id     INT          NOT NULL REFERENCES students (student_id),
    course_id      VARCHAR(10)  NOT NULL REFERENCES courses (course_id),
    term           VARCHAR(7)   NOT NULL,  -- '2024-FA', '2025-SP', '2025-FA'
    enrolled_on    DATE         NOT NULL,
    score          DECIMAL(5,1)            -- 0-100; NULL = in progress or incomplete
);

CREATE TABLE portal_logins (
    student_id  INT  NOT NULL REFERENCES students (student_id),
    login_date  DATE NOT NULL               -- one row per login; a student can log in twice a day
);

INSERT INTO departments (dept_id, dept_name, building, budget) VALUES
    (10, 'Computer Science', 'Turing Hall', 900000.00),
    (20, 'Mathematics', 'Euler Hall', 650000.00),
    (30, 'Physics', 'Curie Hall', 700000.00),
    (40, 'History', 'Gibbon Hall', 400000.00),
    (50, 'Philosophy', 'Kant Hall', 300000.00);

INSERT INTO instructors (instructor_id, name, dept_id, hire_date, salary, manager_id) VALUES
    (101, 'Ada Byron', 10, '2012-08-15', 145000.00, NULL),
    (102, 'Alan Reed', 10, '2016-01-10', 118000.00, 101),
    (103, 'Grace Lin', 10, '2019-07-01', 118000.00, 101),
    (104, 'Edsger Holt', 10, '2021-08-20', 152000.00, 102),
    (105, 'Emmy Stone', 20, '2010-09-01', 132000.00, NULL),
    (106, 'Carl Gauss', 20, '2018-02-15', 99000.00, 105),
    (107, 'Marie Duval', 30, '2014-03-01', 128000.00, NULL),
    (108, 'Lise Park', 30, '2020-09-01', 131000.00, 107),
    (109, 'Howard Zinn', 40, '2011-01-15', 87000.00, NULL),
    (110, 'Mary Beard', 40, '2023-08-01', 87000.00, 109);

INSERT INTO students (student_id, name, email, dept_id, enroll_year, gpa, advisor_id) VALUES
    (1, 'Aarav Shah', 'aarav@uni.edu', 10, 2022, 3.70, 102),
    (2, 'Bella Cruz', 'bella@uni.edu', 10, 2022, 3.70, 102),
    (3, 'Chen Wei', 'chen@uni.edu', 20, 2021, 3.90, 105),
    (4, 'Diya Nair', 'diya@uni.edu', 10, 2023, 3.20, 103),
    (5, 'Ethan Moss', NULL, 30, 2022, 2.80, 107),
    (6, 'Fatima Ali', 'fatima@uni.edu', 20, 2023, 3.50, 106),
    (7, 'Gabe Ortiz', 'gabe@uni.edu', NULL, 2024, NULL, NULL),
    (8, 'Hana Kim', 'hana@uni.edu', 40, 2021, 3.10, 109),
    (9, 'Ivan Petrov', 'ivan@uni.edu', 30, 2023, 3.40, 108),
    (10, 'Julia Rossi', 'JULIA@uni.edu', 10, 2024, NULL, 104),
    (11, 'Kofi Mensah', 'kofi@uni.edu', 40, 2022, 2.50, NULL),
    (12, 'Lena Novak', 'lena@uni.edu', NULL, 2024, NULL, NULL),
    (13, 'Julia Rossi', 'julia@uni.edu ', 10, 2024, NULL, NULL);

INSERT INTO courses (course_id, title, dept_id, credits, prereq_id, instructor_id) VALUES
    ('CS101', 'Intro to Programming', 10, 4, NULL, 102),
    ('CS201', 'Data Structures', 10, 4, 'CS101', 103),
    ('CS301', 'Databases', 10, 3, 'CS201', 104),
    ('CS401', 'Distributed Systems', 10, 3, 'CS301', 101),
    ('MA101', 'Calculus I', 20, 4, NULL, 106),
    ('MA201', 'Linear Algebra', 20, 3, 'MA101', 105),
    ('PH101', 'Mechanics', 30, 4, 'MA101', 107),
    ('PH201', 'Quantum Physics', 30, 3, 'PH101', 108),
    ('HI101', 'World History', 40, 3, NULL, 109),
    ('HI205', 'History of Science', 40, 3, NULL, 110);

INSERT INTO enrollments (enrollment_id, student_id, course_id, term, enrolled_on, score) VALUES
    (1, 1, 'CS101', '2024-FA', '2024-08-20', 92.0),
    (2, 2, 'CS101', '2024-FA', '2024-08-20', 88.0),
    (3, 4, 'CS101', '2024-FA', '2024-08-22', 75.0),
    (4, 3, 'MA101', '2024-FA', '2024-08-19', 95.0),
    (5, 6, 'MA101', '2024-FA', '2024-08-21', 81.0),
    (6, 5, 'MA101', '2024-FA', '2024-08-21', 58.0),
    (7, 9, 'MA101', '2024-FA', '2024-08-23', 77.0),
    (8, 8, 'HI101', '2024-FA', '2024-08-19', 85.0),
    (9, 11, 'HI101', '2024-FA', '2024-08-20', 62.0),
    (10, 1, 'MA101', '2024-FA', '2024-08-20', 84.0),
    (11, 3, 'CS101', '2024-FA', '2024-08-22', 90.0),
    (12, 10, 'CS101', '2024-FA', '2024-08-26', 70.0),
    (13, 1, 'CS201', '2025-SP', '2025-01-13', 95.0),
    (14, 2, 'CS201', '2025-SP', '2025-01-13', 88.0),
    (15, 4, 'CS201', '2025-SP', '2025-01-14', 68.0),
    (16, 3, 'MA201', '2025-SP', '2025-01-13', 97.0),
    (17, 6, 'MA201', '2025-SP', '2025-01-15', 79.0),
    (18, 5, 'MA101', '2025-SP', '2025-01-14', 71.0),
    (19, 9, 'PH101', '2025-SP', '2025-01-16', 83.0),
    (20, 5, 'PH101', '2025-SP', '2025-01-16', 55.0),
    (21, 8, 'MA101', '2025-SP', '2025-01-15', 66.0),
    (22, 11, 'CS101', '2025-SP', '2025-01-17', 49.0),
    (23, 10, 'CS201', '2025-SP', '2025-01-20', 74.0),
    (24, 7, 'HI101', '2025-SP', '2025-01-21', 90.0),
    (25, 3, 'CS201', '2025-SP', '2025-01-14', 88.0),
    (26, 1, 'MA201', '2025-SP', '2025-01-13', 88.0),
    (27, 11, 'MA101', '2025-SP', '2025-01-17', NULL),
    (28, 1, 'CS301', '2025-FA', '2025-08-25', NULL),
    (29, 2, 'CS301', '2025-FA', '2025-08-25', NULL),
    (30, 3, 'CS301', '2025-FA', '2025-08-26', NULL),
    (31, 4, 'CS301', '2025-FA', '2025-08-26', NULL),
    (32, 6, 'PH101', '2025-FA', '2025-08-27', NULL),
    (33, 9, 'MA201', '2025-FA', '2025-08-27', NULL),
    (34, 7, 'CS101', '2025-FA', '2025-08-28', NULL),
    (35, 10, 'CS301', '2025-FA', '2025-08-28', NULL),
    (36, 2, 'CS301', '2025-FA', '2025-08-25', NULL);

INSERT INTO portal_logins (student_id, login_date) VALUES
    (1, '2025-03-01'), (1, '2025-03-02'), (1, '2025-03-03'), (1, '2025-03-05'),
    (2, '2025-03-01'), (2, '2025-03-03'), (2, '2025-03-04'),
    (3, '2025-03-02'), (3, '2025-03-03'), (3, '2025-03-03'), (3, '2025-03-04'), (3, '2025-03-05'),
    (4, '2025-03-10'),
    (5, '2025-03-01'), (5, '2025-03-08'),
    (6, '2025-03-04'), (6, '2025-03-05'), (6, '2025-03-06'),
    (7, '2025-03-15'), (7, '2025-03-16'),
    (9, '2025-03-02'), (9, '2025-03-03'),
    (10, '2025-03-20'), (10, '2025-03-21'), (10, '2025-03-22'), (10, '2025-03-23'), (10, '2025-03-25');
