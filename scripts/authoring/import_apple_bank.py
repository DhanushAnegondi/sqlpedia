"""Convert the Apple SDE-Data prep SQL bank into a SQLpedia collection.

    python scripts/authoring/import_apple_bank.py

Source (read-only): F:/Personal/Projects/Apple_prep/.sql_cheatsheet_validation/validated_bank.json
(60 problems, each with its own fixtures; verified on MySQL 8.0 when it was written).
Output: content/collections/apple.json in the format of content/SCHEMA.md. Run
scripts/verify/fill_expected.py on it afterwards to re-verify on MySQL.
"""
import json, os, re

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = r"F:\Personal\Projects\Apple_prep\.sql_cheatsheet_validation\validated_bank.json"

# Difficulty by problem id (judgement on the pattern's interview weight and trickiness).
HARD = {19, 30, 40, 43, 44, 45, 48, 49, 51, 52, 54, 56, 57, 59, 60}
EASY = {1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 20, 21, 24, 26, 31}

TOPIC_RULES = [
    (r"\bWHERE\b|filter|distinct", "Filtering"),
    (r"COUNT|GROUP BY|aggregate|HAVING|SUM|AVG", "Aggregation"),
    (r"CASE|conditional", "Conditional aggregation"),
    (r"JOIN|join", "Joins"),
    (r"self", "Self-joins"),
    (r"anti|NOT EXISTS|orphan|never", "Anti-joins"),
    (r"NULL|missing", "NULL handling"),
    (r"UNION", "Set operations"),
    (r"subquer|EXISTS", "Subqueries"),
    (r"RANK|ROW_NUMBER|ranking|Top", "Ranking"),
    (r"window|OVER|LAG|LEAD|running|cumulative", "Window functions"),
    (r"running|cumulative", "Running totals"),
    (r"rolling|trailing|seven", "Rolling windows"),
    (r"LAG|LEAD|previous|next", "Value functions"),
    (r"date|month|week|calendar|day|timestamp|UTC|age|leap", "Dates"),
    (r"streak|consecutive|islands", "Gaps and islands"),
    (r"session", "Sessionization"),
    (r"retention|cohort", "Cohorts"),
    (r"funnel", "Funnels"),
    (r"duplicate|dedup|latest|tie-breaker", "Deduplication"),
    (r"pivot", "Pivoting"),
    (r"hierarch|recursive", "Recursive CTEs"),
    (r"reconcil", "Reconciliation"),
    (r"point-in-time|dimension|version", "Slowly changing dimensions"),
    (r"median|weighted|percent|share of", "Statistics"),
    (r"every required|division", "Relational division"),
    (r"interval|overlap", "Data quality"),
    (r"normaliz|string|text|parse", "String functions"),
]


def topics_for(p):
    hay = " ".join([p["title"], p["pattern"], p["task"]])
    out = []
    for rx, t in TOPIC_RULES:
        if re.search(rx, hay, re.I) and t not in out:
            out.append(t)
    return out[:4] or ["Aggregation"]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    bank = json.load(open(SRC, encoding="utf-8"))
    fx = bank["fixtures"]
    problems = []
    for p in bank["problems"]:
        n = p["id"]
        tables = []
        for name in p["tables"]:
            f = fx[name]
            tables.append({
                "name": name,
                "description_md": f.get("note", ""),
                "columns": [{"name": c, "type": t} for c, t in f["cols"]],
                "rows": f["rows"],
            })
        sql = re.sub(r"\bcs_(\w+)", r"\1", p["sql"])
        problems.append({
            "id": f"A{n:02d}",
            "slug": slug(p["title"]),
            "title": p["title"],
            "difficulty": "Hard" if n in HARD else "Easy" if n in EASY else "Medium",
            "topics": topics_for(p),
            "statement_md": p["task"],
            "tables": tables,
            "hints_md": [f"Output grain: {p['grain']}."],
            "notes_md": f"**Pattern family:** {p['pattern']}\n\n**Grain:** one row = {p['grain']}.\n\n**Watch out:** {p['trap']}",
            "solutions": [{"label": p["pattern"], "explain_md": p["why"], "sql": sql}],
            "traps": [],
            "expected": None,
            "source": "Apple SDE-Data prep bank",
        })
    doc = {
        "id": "apple",
        "title": "Apple SDE – Data prep",
        "description_md": "Your 60-question pattern bank from the Apple SDE–Data preparation, each question with its own tiny tables. Ordered from core semantics to dates, sequences and data-engineering patterns.",
        "problems": problems,
    }
    out = os.path.join(ROOT, "content", "collections", "apple.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote", out, len(problems), "problems")


if __name__ == "__main__":
    main()
