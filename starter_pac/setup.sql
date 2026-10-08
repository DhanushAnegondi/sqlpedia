-- ============================================================
-- ShopLite - a tiny online store for SQL interview practice
-- 4 tables, Jan-Jun 2025. Plain standard SQL: tested on PostgreSQL 16, DuckDB and SQLite.
-- Re-runnable: drops and recreates everything.
-- ============================================================

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    customer_id  INT PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL,
    email        VARCHAR(100) NOT NULL,
    city         VARCHAR(50),             -- NULL for one customer
    signup_date  DATE         NOT NULL,
    referred_by  INT                      -- customer_id of the referrer, NULL if none
);

CREATE TABLE products (
    product_id    INT PRIMARY KEY,
    product_name  VARCHAR(50)   NOT NULL,
    category      VARCHAR(20)   NOT NULL,
    price         DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
    order_id     INT PRIMARY KEY,
    customer_id  INT           NOT NULL REFERENCES customers (customer_id),
    order_date   DATE          NOT NULL,
    status       VARCHAR(10)   NOT NULL,  -- 'completed' or 'cancelled'
    amount       DECIMAL(10,2) NOT NULL   -- = SUM(quantity * unit_price) of its items
);

CREATE TABLE order_items (
    order_id    INT           NOT NULL REFERENCES orders (order_id),
    product_id  INT           NOT NULL REFERENCES products (product_id),
    quantity    INT           NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

INSERT INTO customers (customer_id, name, email, city, signup_date, referred_by) VALUES
    (1, 'Alice Kim', 'alice@mail.com', 'Austin', '2025-01-02', NULL),
    (2, 'Ben Ortiz', 'ben@mail.com', 'Boston', '2025-01-05', 1),
    (3, 'Chloe Park', 'chloe@mail.com', 'Austin', '2025-01-10', 1),
    (4, 'Dev Patel', 'dev@mail.com', 'Chicago', '2025-01-15', NULL),
    (5, 'Emma Lee', 'emma@mail.com', 'Boston', '2025-02-01', 2),
    (6, 'Farah Khan', 'farah@mail.com', 'Chicago', '2025-02-11', 4),
    (7, 'Gus Nolan', 'gus@mail.com', 'Austin', '2025-02-20', 3),
    (8, 'Hana Sato', 'hana@mail.com', 'Denver', '2025-03-03', NULL),
    (9, 'Ivan Petrov', 'ivan@mail.com', 'Denver', '2025-03-15', 8),
    (10, 'Jade Wu', 'jade@mail.com', 'Boston', '2025-04-02', 5),
    (11, 'Alice Kim', 'ALICE@mail.com', 'Austin', '2025-04-10', NULL),
    (12, 'Kai Brooks', 'kai@mail.com', NULL, '2025-05-05', 7),
    (13, 'Ben Ortiz', 'ben@mail.com', 'Boston', '2025-05-20', NULL);

INSERT INTO products (product_id, product_name, category, price) VALUES
    (101, 'Wireless Mouse', 'Electronics', 25.00),
    (102, 'Mechanical Keyboard', 'Electronics', 80.00),
    (103, 'USB-C Hub', 'Electronics', 40.00),
    (104, 'Running Shoes', 'Apparel', 90.00),
    (105, 'Hoodie', 'Apparel', 45.00),
    (106, 'Socks 3-Pack', 'Apparel', 12.00),
    (107, 'Coffee Beans', 'Grocery', 18.00),
    (108, 'Green Tea', 'Grocery', 10.00);

INSERT INTO orders (order_id, customer_id, order_date, status, amount) VALUES
    (1001, 1, '2025-01-03', 'completed', 105.00),
    (1002, 2, '2025-01-06', 'completed', 90.00),
    (1003, 3, '2025-01-12', 'completed', 90.00),
    (1004, 1, '2025-01-20', 'completed', 36.00),
    (1005, 4, '2025-01-25', 'cancelled', 40.00),
    (1006, 4, '2025-02-02', 'completed', 120.00),
    (1007, 5, '2025-02-03', 'completed', 69.00),
    (1008, 1, '2025-02-14', 'completed', 102.00),
    (1009, 6, '2025-02-15', 'completed', 65.00),
    (1010, 2, '2025-02-27', 'completed', 18.00),
    (1011, 6, '2025-03-08', 'completed', 80.00),
    (1012, 3, '2025-03-10', 'completed', 25.00),
    (1013, 3, '2025-03-11', 'completed', 18.00),
    (1014, 3, '2025-03-11', 'completed', 12.00),
    (1015, 3, '2025-03-12', 'completed', 45.00),
    (1016, 7, '2025-03-12', 'completed', 145.00),
    (1017, 8, '2025-03-18', 'completed', 180.00),
    (1018, 1, '2025-03-25', 'cancelled', 80.00),
    (1019, 5, '2025-04-01', 'completed', 30.00),
    (1020, 5, '2025-04-02', 'completed', 25.00),
    (1021, 9, '2025-04-05', 'completed', 135.00),
    (1022, 10, '2025-04-08', 'cancelled', 90.00),
    (1023, 2, '2025-04-15', 'completed', 105.00),
    (1024, 4, '2025-04-20', 'completed', 54.00),
    (1025, 8, '2025-04-22', 'completed', 65.00),
    (1026, 1, '2025-05-02', 'completed', 40.00),
    (1027, 3, '2025-05-05', 'completed', 90.00),
    (1028, 7, '2025-05-09', 'completed', 66.00),
    (1029, 9, '2025-05-10', 'completed', 36.00),
    (1030, 6, '2025-05-21', 'completed', 114.00),
    (1031, 2, '2025-05-30', 'completed', 57.00),
    (1032, 8, '2025-06-02', 'completed', 160.00),
    (1033, 1, '2025-06-03', 'completed', 18.00),
    (1034, 4, '2025-06-04', 'completed', 135.00),
    (1035, 5, '2025-06-10', 'completed', 52.00),
    (1036, 3, '2025-06-15', 'cancelled', 25.00),
    (1037, 7, '2025-06-20', 'completed', 90.00),
    (1038, 9, '2025-06-28', 'completed', 45.00);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1001, 102, 1, 80.00),
    (1001, 101, 1, 25.00),
    (1002, 104, 1, 90.00),
    (1003, 105, 2, 45.00),
    (1004, 107, 2, 18.00),
    (1005, 103, 1, 40.00),
    (1006, 102, 1, 80.00),
    (1006, 103, 1, 40.00),
    (1007, 106, 2, 12.00),
    (1007, 105, 1, 45.00),
    (1008, 104, 1, 90.00),
    (1008, 106, 1, 12.00),
    (1009, 101, 1, 25.00),
    (1009, 103, 1, 40.00),
    (1010, 107, 1, 18.00),
    (1011, 102, 1, 80.00),
    (1012, 101, 1, 25.00),
    (1013, 107, 1, 18.00),
    (1014, 106, 1, 12.00),
    (1015, 105, 1, 45.00),
    (1016, 102, 1, 80.00),
    (1016, 101, 1, 25.00),
    (1016, 103, 1, 40.00),
    (1017, 104, 2, 90.00),
    (1018, 102, 1, 80.00),
    (1019, 107, 1, 18.00),
    (1019, 106, 1, 12.00),
    (1020, 101, 1, 25.00),
    (1021, 104, 1, 90.00),
    (1021, 105, 1, 45.00),
    (1022, 104, 1, 90.00),
    (1023, 102, 1, 80.00),
    (1023, 101, 1, 25.00),
    (1024, 107, 3, 18.00),
    (1025, 103, 1, 40.00),
    (1025, 101, 1, 25.00),
    (1026, 103, 1, 40.00),
    (1027, 104, 1, 90.00),
    (1028, 107, 3, 18.00),
    (1028, 106, 1, 12.00),
    (1029, 107, 2, 18.00),
    (1030, 104, 1, 90.00),
    (1030, 106, 2, 12.00),
    (1031, 105, 1, 45.00),
    (1031, 106, 1, 12.00),
    (1032, 102, 2, 80.00),
    (1033, 107, 1, 18.00),
    (1034, 104, 1, 90.00),
    (1034, 105, 1, 45.00),
    (1035, 103, 1, 40.00),
    (1035, 106, 1, 12.00),
    (1036, 101, 1, 25.00),
    (1037, 104, 1, 90.00),
    (1038, 105, 1, 45.00);
