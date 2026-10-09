"""Run every MySQL reference solution against a real MySQL 8.0 server and compare
the result with the expected output in site/data/<set>.json.

    python scripts/verify/verify_mysql.py [set-id ...]

Needs a throwaway server (never your real one): MYSQL_VERIFY_PORT (default 33079),
root with no password, e.g. started with `mysqld --initialize-insecure`.
Each problem runs in a freshly loaded database, so DML in one solution can't leak.
"""
import json, os, subprocess, sys, xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MYSQL = r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
PORT = os.environ.get("MYSQL_VERIFY_PORT", "33079")
ARGS = [MYSQL, "--no-defaults", "--protocol=TCP", "--host=127.0.0.1", f"--port={PORT}", "--user=root",
        "--default-character-set=utf8mb4"]
NIL = "{http://www.w3.org/2001/XMLSchema-instance}nil"


def run(sql, db=None, xml=True):
    args = ARGS + (["--xml"] if xml else []) + ([db] if db else [])
    p = subprocess.run(args, input=sql, capture_output=True, text=True, encoding="utf-8")
    if p.returncode:
        raise RuntimeError(p.stderr.strip())
    return p.stdout


def last_result(xml_text):
    # mysql --xml prints one <resultset> per statement; keep the last one that has a header.
    sets = []
    for chunk in xml_text.split("<?xml")[1:]:
        root = ET.fromstring("<?xml" + chunk)
        rows = root.findall("row")
        if rows or root.get("statement", "").strip().lower().startswith(("select", "with")):
            sets.append(root)
    if not sets:
        return None, None
    root = sets[-1]
    rows = root.findall("row")
    cols = [f.get("name") for f in rows[0]] if rows else []
    data = [[None if f.get(NIL) == "true" else (f.text or "") for f in r] for r in rows]
    return cols, data


def norm(v):
    if v is None:
        return None
    s = str(v).strip()
    try:
        d = Decimal(s)
        return ("n", d.normalize())
    except InvalidOperation:
        pass
    if len(s) == 19 and s.endswith(" 00:00:00"):
        s = s[:10]
    return ("s", s)


def same(a, b):
    na, nb = norm(a), norm(b)
    if na is None or nb is None:
        return na is None and nb is None
    if na[0] == nb[0] == "n":
        return abs(na[1] - nb[1]) <= Decimal("0.005")
    return na == nb


def compare(exp_rows, got_rows):
    if len(exp_rows) != len(got_rows):
        return f"row count {len(got_rows)} != expected {len(exp_rows)}"
    if any(len(r) != len(exp_rows[0]) for r in got_rows):
        return "column count differs"
    if all(all(same(x, y) for x, y in zip(e, g)) for e, g in zip(exp_rows, got_rows)):
        return None
    key = lambda r: [str(norm(v)) for v in r]
    if all(all(same(x, y) for x, y in zip(e, g)) for e, g in zip(sorted(exp_rows, key=key), sorted(got_rows, key=key))):
        return "ORDER"  # same rows, different order
    return "values differ"


def verify_set(set_id):
    data = json.load(open(os.path.join(ROOT, ".build", "legacy", f"{set_id}.json"), encoding="utf-8"))
    db = f"verify_{set_id}"
    results = []
    for p in data["problems"]:
        for sol in p["solutions"]:
            part = next((x for x in p["parts"] if x["label"] == sol["part"]), None)
            exp = part and part["expected"]
            for kind, items in (("answer", sol["mysql"]), ("trap", sol["traps"])):
                for i, a in enumerate(items):
                    label = f'{p["id"]}{sol["part"]} {kind} {a["label"] or i + 1}'
                    try:
                        run(f"DROP DATABASE IF EXISTS {db}; CREATE DATABASE {db};", xml=False)
                        run(data["setup_sql"], db, xml=False)
                        cols, rows = last_result(run(a["sql"], db))
                    except Exception as e:
                        results.append((label, "ERROR", str(e)[:300]))
                        continue
                    if exp is None or sol["noeq"]:
                        results.append((label, "RAN", f"{len(rows or [])} rows"))
                        continue
                    if rows is None:
                        results.append((label, "NO RESULT", ""))
                        continue
                    diff = compare(exp["rows"], rows)
                    if kind == "trap":
                        results.append((label, "TRAP-DIFFERS" if diff else "TRAP-SAME?", diff or ""))
                    else:
                        results.append((label, "PASS" if diff is None else ("PASS-ORDER" if diff == "ORDER" else "FAIL"),
                                        "" if diff in (None, "ORDER") else f"{diff} | got {rows[:4]} | exp {exp['rows'][:4]}"))
    run(f"DROP DATABASE IF EXISTS {db};", xml=False)
    return results


def main():
    sets = sys.argv[1:] or [s["id"] for s in json.load(open(os.path.join(ROOT, ".build", "legacy", "index.json")))["sets"]]
    bad = 0
    for s in sets:
        res = verify_set(s)
        print(f"== {s}")
        for label, status, note in res:
            if status not in ("PASS", "TRAP-DIFFERS", "RAN"):
                bad += status in ("FAIL", "ERROR", "NO RESULT", "TRAP-SAME?")
            print(f"  {status:12} {label} {note}")
        counts = {}
        for _, st, _ in res:
            counts[st] = counts.get(st, 0) + 1
        print("  summary:", counts)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
