// Build the site's data from all sources.
//
//   node scripts/build_content.mjs        (run after scripts/import.mjs)
//
// Inputs
//   .build/legacy/<set>.json        ShopLite / Campus (shared dataset per set), from scripts/import.mjs
//   content/collections/*.json      collections with per-problem tables (expected filled by fill_expected.py)
//   content/collections/<id>/       a collection split into parts (_meta.json + part files)
//   content/handbook/*.json         handbook pages (+ _dataset.json)
// Outputs (site/data/)
//   catalog.json                    collections, problem summaries, topics, handbook index
//   c/<collection>.json             full problems of one collection
//   h/<page>.json, h/_dataset.json  handbook pages and the shared example dataset

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "data");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const errors = [];

const HANDBOOK_FOR_TOPIC = {
  Filtering: "filtering", Sorting: "filtering", Aggregation: "aggregation", "Conditional aggregation": "case-expressions",
  Joins: "joins", "Self-joins": "joins", "Anti-joins": "joins", "Set operations": "set-operations",
  Subqueries: "subqueries", CTEs: "ctes", "Recursive CTEs": "recursive-ctes", Hierarchies: "recursive-ctes",
  "Date spines": "recursive-ctes", "NULL handling": "null-handling", "String functions": "string-functions",
  "Numeric functions": "numeric-functions", Dates: "date-time-functions", "Window functions": "window-basics",
  Ranking: "ranking", "Top N per group": "top-bottom-n", "Running totals": "running-totals",
  "Rolling windows": "rolling-windows", "Moving averages": "rolling-windows", "Value functions": "value-functions",
  "Period comparisons": "period-comparisons", NTILE: "ntile-buckets", "Gaps and islands": "gaps-and-islands",
  Sessionization: "sessionization", Deduplication: "deduplication", "Data cleaning": "deduplication", DML: "deduplication",
  Pivoting: "pivot-unpivot", Cohorts: "retention-funnels", Funnels: "retention-funnels",
  Reconciliation: "data-engineering-sql", "Incremental loads": "data-engineering-sql",
  "Slowly changing dimensions": "data-engineering-sql", "Data quality": "data-engineering-sql",
  "Relational division": "subqueries", Statistics: "aggregate-windows",
};

// Difficulty for the legacy sets, by section.
const LEGACY_DIFFICULTY = {
  shoplite: { A: "Easy", B: "Medium", C: "Hard" },
  campus: { 1: "Easy", 2: "Easy", 3: "Easy", 4: "Medium", 5: "Medium", 6: "Medium", 7: "Hard", 8: "Hard" },
};

function legacyCollection(set) {
  const problems = set.problems.map((p) => {
    const tables = set.tables.filter((t) => p.tables_used.includes(t.name)).map((t) => ({
      name: t.name, description_md: "", columns: t.columns.map((c) => ({ name: c.name, type: c.type, note: c.note || "" })), rows: t.rows,
    }));
    const parts = p.parts.map((part) => {
      const sol = p.solutions.find((s) => s.part === part.label) || { mysql: [], traps: [] };
      return {
        label: part.label, expected: part.expected, intro_md: part.intro_md || "", note_md: part.note_md || "",
        solutions_intro_md: sol.intro_md || "", noeq: !!sol.noeq,
        solutions: sol.mysql.map((a, i) => ({ label: a.label && a.label !== "Correct" ? a.label : (sol.mysql.length > 1 ? `Approach ${i + 1}` : "Solution"), explain_md: a.comment_md || "", sql: a.sql })),
        traps: sol.traps.map((t) => ({ explain_md: t.comment_md || "", sql: t.sql })),
        postgres_original: sol.postgres_original || "",
      };
    });
    return {
      id: p.id, slug: p.slug, title: p.title,
      difficulty: (LEGACY_DIFFICULTY[set.id] || {})[p.tier] || "Medium",
      topics: p.tags, section: p.tier_title, lc_ref: p.lc_ref,
      statement_md: p.statement_md, dialect_note_md: p.dialect_note_md, hints_md: p.hints_md,
      notes_md: "", tables, parts, uses_shared_setup: true,
    };
  });
  return {
    id: set.id, title: set.title, description_md: set.description_md, kind: "shared",
    shared: { setup_sql: set.setup_sql, conventions_md: set.conventions_md, planted_traps: set.planted_traps,
      er_mermaid: set.er_mermaid, tables: set.tables, essentials: set.essentials, group_kind: set.group_kind },
    problems,
  };
}

function ownTablesCollection(doc) {
  const problems = doc.problems.map((p) => {
    if (!p.expected) errors.push(`${doc.id}/${p.id}: expected is null - run scripts/verify/fill_expected.py`);
    return {
      id: p.id, slug: p.slug, title: p.title, difficulty: p.difficulty, topics: p.topics || [], section: p.section || null,
      statement_md: p.statement_md, dialect_note_md: p.dialect_note_md || null, hints_md: p.hints_md || [],
      notes_md: p.notes_md || "", tables: p.tables || [], source: p.source || null,
      parts: [{
        label: "", expected: p.expected, intro_md: "", note_md: "", solutions_intro_md: "", noeq: false,
        solutions: (p.solutions || []).map((s) => ({ label: s.label || "Solution", explain_md: s.explain_md || "", sql: s.sql })),
        traps: (p.traps || []).map((t) => ({ explain_md: t.explain_md || "", sql: t.sql })),
        postgres_original: "",
      }],
      uses_shared_setup: false,
    };
  });
  return { id: doc.id, title: doc.title, description_md: doc.description_md || "", kind: "own", problems };
}

function loadCollections() {
  const out = [];
  const dir = join(ROOT, "content", "collections");
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (name.endsWith(".json")) out.push(ownTablesCollection(read(p)));
      else if (statSync(p).isDirectory() && existsSync(join(p, "_meta.json"))) {
        const meta = read(join(p, "_meta.json"));
        const problems = [];
        for (const part of meta.parts) {
          if (!existsSync(join(p, part))) { errors.push(`${meta.id}: missing part ${part}`); continue; }
          problems.push(...read(join(p, part)).problems);
        }
        out.push(ownTablesCollection({ ...meta, problems }));
      }
    }
  }
  const legacy = join(ROOT, ".build", "legacy");
  if (existsSync(join(legacy, "index.json")))
    for (const s of read(join(legacy, "index.json")).sets) out.push(legacyCollection(read(join(legacy, `${s.id}.json`))));
  // Display order
  const ORDER = ["basics", "drills", "patterns", "apple", "campus", "shoplite"];
  return out.sort((a, b) => (ORDER.indexOf(a.id) + 99 * (ORDER.indexOf(a.id) < 0)) - (ORDER.indexOf(b.id) + 99 * (ORDER.indexOf(b.id) < 0)));
}

function loadHandbook() {
  const dir = join(ROOT, "content", "handbook");
  if (!existsSync(dir)) return { pages: [], dataset: null };
  const pages = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => read(join(dir, f)));
  for (const pg of pages) for (const s of pg.sections || []) for (const ex of s.examples || [])
    if (!ex.expected) errors.push(`handbook/${pg.id}/${ex.id}: expected is null - run fill_expected.py`);
  const GROUPS = ["Foundations", "Functions", "Query structure", "Window functions", "Patterns"];
  pages.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order);
  return { pages, dataset: existsSync(join(dir, "_dataset.json")) ? read(join(dir, "_dataset.json")) : null };
}

function main() {
  const collections = loadCollections();
  const { pages, dataset } = loadHandbook();
  const pageIds = new Set(pages.map((p) => p.id));

  for (const sub of ["c", "h"]) { rmSync(join(OUT, sub), { recursive: true, force: true }); mkdirSync(join(OUT, sub), { recursive: true }); }
  for (const stale of ["index.json", "shoplite.json", "campus.json"]) rmSync(join(OUT, stale), { force: true });

  const summaries = [];
  const topicCount = new Map();
  for (const c of collections) {
    const seen = new Set();
    for (const p of c.problems) {
      if (seen.has(p.slug)) errors.push(`${c.id}: duplicate slug ${p.slug}`);
      seen.add(p.slug);
      p.handbook = [...new Set(p.topics.map((t) => HANDBOOK_FOR_TOPIC[t]).filter((id) => id && pageIds.has(id)))];
      summaries.push({ key: `${c.id}/${p.id}`, c: c.id, id: p.id, slug: p.slug, title: p.title, difficulty: p.difficulty, topics: p.topics, section: p.section || null });
      for (const t of p.topics) topicCount.set(t, (topicCount.get(t) || 0) + 1);
    }
    writeFileSync(join(OUT, "c", `${c.id}.json`), JSON.stringify(c));
  }
  for (const pg of pages) writeFileSync(join(OUT, "h", `${pg.id}.json`), JSON.stringify(pg));
  if (dataset) writeFileSync(join(OUT, "h", "_dataset.json"), JSON.stringify(dataset));

  const catalog = {
    built_at: new Date().toISOString(),
    collections: collections.map((c) => ({
      id: c.id, title: c.title, description_md: c.description_md, kind: c.kind, count: c.problems.length,
      difficulty: ["Easy", "Medium", "Hard"].map((d) => c.problems.filter((p) => p.difficulty === d).length),
    })),
    problems: summaries,
    topics: [...topicCount.entries()].map(([name, count]) => ({ name, count, handbook: HANDBOOK_FOR_TOPIC[name] && pageIds.has(HANDBOOK_FOR_TOPIC[name]) ? HANDBOOK_FOR_TOPIC[name] : null }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    handbook: pages.map((p) => ({ id: p.id, title: p.title, group: p.group, order: p.order, summary_md: p.summary_md,
      sections: (p.sections || []).map((s) => ({ id: s.id, heading: s.heading })) })),
  };
  writeFileSync(join(OUT, "catalog.json"), JSON.stringify(catalog));

  // The classic (Wikipedia-style) site at site/classic/ reads the legacy set files as-is.
  const legacyDir = join(ROOT, ".build", "legacy");
  const classicOut = join(ROOT, "site", "classic", "data");
  if (existsSync(join(ROOT, "site", "classic")) && existsSync(legacyDir)) {
    rmSync(classicOut, { recursive: true, force: true });
    mkdirSync(classicOut, { recursive: true });
    for (const f of readdirSync(legacyDir).filter((x) => x.endsWith(".json"))) writeFileSync(join(classicOut, f), readFileSync(join(legacyDir, f)));
  }

  const strict = process.argv.includes("--strict");
  if (errors.length) {
    console.error(`${errors.length} content problems:\n  - ` + errors.slice(0, 40).join("\n  - "));
    if (strict) process.exit(1);
  }
  console.log(`built: ${collections.length} collections, ${summaries.length} problems, ${pages.length} handbook pages, ${topicCount.size} topics`);
}

main();
