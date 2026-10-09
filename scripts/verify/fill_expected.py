"""Fill `expected` in authored content by running it on real MySQL 8.0 (throwaway server).

    python scripts/verify/fill_expected.py content/collections/patterns.json [more files...]
    python scripts/verify/fill_expected.py --check FILE   # report only, don't write

Collections: runs every solution and trap of every problem against the problem's own tables.
The first solution's result becomes `expected`; other solutions must match it; traps must differ.
Handbook pages: runs every example's `mysql` (shared dataset or own tables) into `expected`.
Exit code 1 if anything errored or disagreed.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify_mysql import run, last_result, compare  # noqa: E402

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DB = f"verify_content_{os.getpid()}"


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def tables_sql(tables):
    parts = [f"DROP TABLE IF EXISTS {t['name']}" for t in reversed(tables)]
    for t in tables:
        cols = ",\n  ".join(f"{c['name']} {c['type']}" for c in t["columns"])
        parts.append(f"CREATE TABLE {t['name']} (\n  {cols}\n)")
        if t["rows"]:
            names = ", ".join(c["name"] for c in t["columns"])
            vals = ",\n  ".join("(" + ", ".join(lit(v) for v in r) + ")" for r in t["rows"])
            parts.append(f"INSERT INTO {t['name']} ({names}) VALUES\n  {vals}")
    return ";\n".join(parts) + ";" if parts else ""


def exec_case(setup, sql):
    run(f"DROP DATABASE IF EXISTS {DB}; CREATE DATABASE {DB};", xml=False)
    if setup:
        run(setup, DB, xml=False)
    return last_result(run(sql, DB))


def as_expected(cols, rows):
    return {"columns": cols, "rows": rows}


def do_collection(doc, problems_report):
    for p in doc["problems"]:
        pid = p.get("id", "?")
        setup = tables_sql(p.get("tables", []))
        exp = None
        for i, s in enumerate(p.get("solutions", [])):
            try:
                cols, rows = exec_case(setup, s["sql"])
            except Exception as e:
                problems_report.append(f"{pid} solution {i + 1}: ERROR {str(e)[:300]}")
                continue
            if cols is None:
                problems_report.append(f"{pid} solution {i + 1}: returned no result set")
                continue
            if exp is None:
                exp = as_expected(cols, rows)
            else:
                d = compare(exp["rows"], rows)
                if d not in (None, "ORDER"):
                    problems_report.append(f"{pid} solution {i + 1}: disagrees with solution 1 ({d})")
                elif d == "ORDER":
                    problems_report.append(f"{pid} solution {i + 1}: same rows, different order (add a full ORDER BY)")
        for i, t in enumerate(p.get("traps", [])):
            try:
                cols, rows = exec_case(setup, t["sql"])
            except Exception as e:
                t["errors"] = True  # an erroring trap is allowed if explained
                continue
            if exp is not None and rows is not None and compare(exp["rows"], rows) in (None, "ORDER"):
                problems_report.append(f"{pid} trap {i + 1}: returns the SAME result as the solution - plant data that exposes it")
        if exp is not None:
            if not exp["rows"]:
                problems_report.append(f"{pid}: expected output is empty - add data so the answer has rows")
            p["expected"] = exp
            p["verified_on"] = "MySQL 8.0.39"


def do_handbook(doc, report, dataset_sql):
    for sec in doc.get("sections", []):
        for ex in sec.get("examples", []):
            eid = f"{doc.get('id')}/{ex.get('id')}"
            setup = dataset_sql if ex.get("uses_dataset") else tables_sql(ex.get("tables", []))
            if not ex.get("mysql"):
                report.append(f"{eid}: no mysql query")
                continue
            try:
                cols, rows = exec_case(setup, ex["mysql"])
            except Exception as e:
                report.append(f"{eid}: ERROR {str(e)[:300]}")
                continue
            if cols is None:
                report.append(f"{eid}: returned no result set")
                continue
            ex["expected"] = as_expected(cols, rows)
            ex["verified_on"] = "MySQL 8.0.39"


def main():
    args = sys.argv[1:]
    check = "--check" in args
    files = [a for a in args if a != "--check"]
    ds = json.load(open(os.path.join(ROOT, "content", "handbook", "_dataset.json"), encoding="utf-8"))
    dataset_sql = tables_sql(ds["tables"])
    failed = False
    for f in files:
        path = f if os.path.isabs(f) else os.path.join(ROOT, f)
        doc = json.load(open(path, encoding="utf-8"))
        report = []
        if "problems" in doc:
            do_collection(doc, report)
            n = len(doc["problems"])
        else:
            do_handbook(doc, report, dataset_sql)
            n = sum(len(s.get("examples", [])) for s in doc.get("sections", []))
        print(f"== {f}: {n} items, {len(report)} issues")
        for r in report:
            print("  -", r)
        failed |= bool(report)
        if not check:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(doc, fh, indent=2, ensure_ascii=False)
                fh.write("\n")
    run(f"DROP DATABASE IF EXISTS {DB};", xml=False)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
