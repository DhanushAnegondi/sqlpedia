# Reviewer brief — SQLpedia

Project: local Wikipedia-skinned (Vector 2022) site where each article is a SQL problem; reading platform with MySQL 8.0 solutions and a manual completion tracker (no in-site SQL execution). Contract: `CLAUDE.md`.

## Checks
- Content fidelity: titles, statements, expected tables, LC refs match `starter_pac/` exactly. Nothing invented.
- Generated JSON matches the data contract in `CLAUDE.md`; never hand-edited.
- MySQL ports: no Postgres-only syntax; user-confirmed results logged when available.
- Wikipedia fidelity at 1280px and 375px, light and dark; no Wikipedia brand assets.
- Progress: local-time day boundaries, streak math, survives reload, export/import round-trip.
- All CDN URLs pinned to exact versions; console clean.
- a11y: AA contrast, focus visible, keyboard reachable, reduced motion.
