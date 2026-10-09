// Run every MySQL reference solution through the browser engine's translator and DuckDB
// (the CLI stands in for duckdb-wasm), and compare with the expected outputs that
// scripts/verify/verify_mysql.py confirmed on real MySQL.
//
//   node scripts/verify/engine_check.mjs [collection ...]

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { translate, SESSION_SETUP } from "../../site/js/engine/translate.js";
import { tablesToSql } from "../../site/js/engine/fixtures.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function duck(sql) {
  const p = spawnSync("duckdb", ["-json"], { input: sql, encoding: "utf8" });
  if (p.status !== 0 || p.stderr.trim()) throw new Error((p.stderr || p.stdout).trim().split("\n").slice(0, 3).join(" "));
  // -json prints one array per result-producing statement; take the last one.
  const arrays = [];
  let depth = 0, start = -1, inStr = false;
  const s = p.stdout;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "[") { if (depth === 0) start = i; depth++; }
    else if (c === "]") { depth--; if (depth === 0) arrays.push(s.slice(start, i + 1)); }
  }
  if (!arrays.length) return null;
  const rows = JSON.parse(arrays[arrays.length - 1]);
  return rows.map((r) => Object.values(r));
}

const norm = (v) => {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(s)) return ["n", Number(s)];
  if (/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(s)) s = s.slice(0, 10);
  if (s === "true") return ["n", 1];
  if (s === "false") return ["n", 0];
  return ["s", s];
};
const same = (a, b) => {
  const x = norm(a), y = norm(b);
  if (x === null || y === null) return x === null && y === null;
  if (x[0] === "n" && y[0] === "n") return Math.abs(x[1] - y[1]) <= 0.005 + 1e-9;
  return x[1] === y[1];
};
export function compare(exp, got) {
  if (!exp.length && !got.length) return null;
  if (exp.length !== got.length) return `row count ${got.length} != ${exp.length}`;
  const eq = (A, B) => A.every((e, i) => e.length === B[i].length && e.every((v, j) => same(v, B[i][j])));
  if (eq(exp, got)) return null;
  const key = (r) => JSON.stringify(r.map(norm));
  if (eq([...exp].sort((a, b) => key(a).localeCompare(key(b))), [...got].sort((a, b) => key(a).localeCompare(key(b))))) return "ORDER";
  return "values differ";
}

function checkSet(id) {
  const set = JSON.parse(readFileSync(join(ROOT, ".build", "legacy", `${id}.json`), "utf8"));
  const out = [];
  for (const p of set.problems) {
    const setup = p.tables_sql ? p.tables_sql : (set.setup_sql || tablesToSql(p.tables));
    for (const sol of p.solutions) {
      const part = p.parts.find((x) => x.label === sol.part);
      for (const [kind, list] of [["answer", sol.mysql], ["trap", sol.traps]]) {
        list.forEach((a, i) => {
          const label = `${p.id}${sol.part} ${kind} ${a.label || i + 1}`;
          let rows;
          try {
            const script = [...SESSION_SETUP.mysql, translate(setup, "mysql"), translate(a.sql, "mysql")].join(";\n") + ";";
            rows = duck(script);
          } catch (e) { out.push([label, "ERROR", e.message.slice(0, 240)]); return; }
          if (!part?.expected || sol.noeq) { out.push([label, "RAN", ""]); return; }
          const d = rows ? compare(part.expected.rows, rows) : "no result";
          if (kind === "trap") out.push([label, d ? "TRAP-DIFFERS" : "TRAP-SAME?", ""]);
          else out.push([label, d === null ? "PASS" : d === "ORDER" ? "PASS-ORDER" : "FAIL", d && d !== "ORDER" ? `${d} | got ${JSON.stringify(rows?.slice(0, 3))} | exp ${JSON.stringify(part.expected.rows.slice(0, 3))}` : ""]);
        });
      }
    }
  }
  return out;
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main();

function main() {
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : JSON.parse(readFileSync(join(ROOT, ".build", "legacy", "index.json"), "utf8")).sets.map((s) => s.id);
let bad = 0;
for (const id of ids) {
  if (!existsSync(join(ROOT, ".build", "legacy", `${id}.json`))) continue;
  const res = checkSet(id);
  const counts = {};
  console.log(`== ${id}`);
  for (const [label, st, note] of res) {
    counts[st] = (counts[st] || 0) + 1;
    if (!["PASS", "TRAP-DIFFERS", "RAN"].includes(st)) { console.log(`  ${st.padEnd(12)} ${label} ${note}`); if (st !== "PASS-ORDER") bad++; }
  }
  console.log("  summary:", JSON.stringify(counts));
}
process.exit(bad ? 1 : 0);
}
