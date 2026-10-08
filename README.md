# SQLpedia

A Wikipedia-style reading site for SQL interview problems: statements, schemas, input data,
expected outputs and MySQL 8.0 solutions, with a practice tracker. Queries are run in MySQL
Workbench; the site shows the problems and tracks practice.

## Use it

Live site: GitHub Pages (deployed by `.github/workflows/deploy.yml` on every push to `main`).

Locally:

```bash
npm run import   # build site/data/ from the problem sets
npm run serve    # http://localhost:8130
```

## Problem sets

| Set | Folder | Problems | Grouped by |
|---|---|---|---|
| ShopLite | `starter_pac/` | 30 | Difficulty tiers |
| Campus | `sets/campus/` | 31 | Interview pattern |

Adding a set: see `CLAUDE.md` and `.claude/skills/add-problem-set/`.

Practice progress lives in the browser's local storage. Use Export / Import on the Progress page
to back it up or move it between machines.
