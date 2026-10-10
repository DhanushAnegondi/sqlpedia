// Loads site/data/: catalog.json up front, collections and handbook pages on demand.

import { tablesToSql } from "./engine/fixtures.js";

let catalog = null;
const collections = new Map();
const pages = new Map();
let dataset = null;

async function getJson(path) {
  // revalidate every load (cheap 304) so new content shows up right after a deploy
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path} not found — run: npm run import`);
  return r.json();
}

export async function loadCatalog() {
  if (catalog) return catalog;
  catalog = await getJson("data/catalog.json");
  catalog.byKey = new Map(catalog.problems.map((p) => [p.key, p]));
  catalog.collectionById = (id) => catalog.collections.find((c) => c.id === id);
  catalog.pageById = (id) => catalog.handbook.find((p) => p.id === id);
  return catalog;
}

export async function loadCollection(id) {
  if (!collections.has(id)) collections.set(id, getJson(`data/c/${id}.json`));
  return collections.get(id);
}

export async function loadProblem(cid, slug) {
  const c = await loadCollection(cid);
  const p = c.problems.find((x) => x.slug === slug || x.id === slug);
  if (!p) return null;
  return { collection: c, problem: p, key: `${c.id}/${p.id}`, setup: c.kind === "shared" ? c.shared.setup_sql : tablesToSql(p.tables) };
}

export async function loadPage(id) {
  if (!pages.has(id)) pages.set(id, getJson(`data/h/${id}.json`));
  return pages.get(id);
}

export async function loadDataset() {
  if (!dataset) dataset = getJson("data/h/_dataset.json");
  return dataset;
}

// Topic families keep the library rail short; anything unmapped lands in "More".
export const TOPIC_FAMILIES = [
  ["Basics", ["Filtering", "Sorting", "Aggregation", "Conditional aggregation", "NULL handling", "String functions", "Numeric functions", "Data cleaning"]],
  ["Joins and sets", ["Joins", "Self-joins", "Anti-joins", "Set operations", "Relational division"]],
  ["Subqueries and CTEs", ["Subqueries", "CTEs", "Recursive CTEs", "Hierarchies"]],
  ["Window functions", ["Window functions", "Ranking", "Top N per group", "Running totals", "Rolling windows", "Moving averages", "Value functions", "NTILE", "Statistics"]],
  ["Dates and sequences", ["Dates", "Date spines", "Period comparisons", "Gaps and islands", "Sessionization", "Cohorts", "Funnels"]],
  ["Data engineering", ["Deduplication", "Pivoting", "Data quality", "Reconciliation", "Incremental loads", "Slowly changing dimensions", "DML"]],
];

export const problemHref = (key, tab = "") => {
  const s = catalog?.byKey.get(key);
  return s ? `#/p/${s.c}/${s.slug}${tab ? "/" + tab : ""}` : "#/problems";
};
export const pageHref = (id, anchor = "") => `#/handbook/${id}${anchor ? "#" + anchor : ""}`;
