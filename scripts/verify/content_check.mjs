// Run authored content through the browser engine (translator + DuckDB CLI) in both
// dialects and compare with `expected` (which fill_expected.py took from real MySQL).
//
//   node scripts/verify/content_check.mjs content/collections/patterns.json [...]

import { readFileSync } from "node:fs";
import { join, resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { translate, SESSION_SETUP } from "../../site/js/engine/translate.js";
import { tablesToSql } from "../../site/js/engine/fixtures.js";
import { duck, compare } from "./engine_check.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataset = JSON.parse(readFileSync(join(ROOT, "content", "handbook", "_dataset.json"), "utf8"));
const datasetSql = tablesToSql(dataset.tables);

function runIn(dialect, setup, sql) {
  // Setup is MySQL DDL (portable subset) for both dialects.
  const script = [...SESSION_SETUP[dialect], translate(setup, "mysql"), translate(sql, dialect)].join(";\n") + ";";
  return duck(script);
}

let bad = 0;
for (const f of process.argv.slice(2)) {
  const doc = JSON.parse(readFileSync(isAbsolute(f) ? f : join(ROOT, f), "utf8"));
  const issues = [];
  const check = (id, setup, sql, dialect, expected, note) => {
    if (!sql) return;
    let rows;
    try { rows = runIn(dialect, setup, sql); }
    catch (e) { issues.push(`${id} [${dialect}] ENGINE ERROR: ${e.message.slice(0, 200)}`); return; }
    if (!expected) { issues.push(`${id}: no expected yet (run fill_expected.py first)`); return; }
    const d = rows ? compare(expected.rows, rows) : "no result";
    if (d && d !== "ORDER") issues.push(`${id} [${dialect}] differs from MySQL: ${d}${note ? " (has dialect_note)" : ""} | got ${JSON.stringify(rows?.slice(0, 3))} | exp ${JSON.stringify(expected.rows.slice(0, 3))}`);
  };
  if (doc.problems) {
    for (const p of doc.problems) {
      const setup = tablesToSql(p.tables || []);
      (p.solutions || []).forEach((s, i) => check(`${p.id} solution ${i + 1}`, setup, s.sql, "mysql", p.expected));
    }
  } else {
    for (const sec of doc.sections || []) for (const ex of sec.examples || []) {
      const setup = ex.uses_dataset ? datasetSql : tablesToSql(ex.tables || []);
      const id = `${doc.id}/${ex.id}`;
      check(id, setup, ex.mysql, "mysql", ex.expected);
      check(id, setup, ex.tsql, "tsql", ex.expected, ex.dialect_note_md);
    }
  }
  console.log(`== ${f}: ${issues.length} issues`);
  issues.forEach((x) => console.log("  -", x));
  bad += issues.filter((x) => !x.includes("(has dialect_note)")).length;
}
process.exit(bad ? 1 : 0);
