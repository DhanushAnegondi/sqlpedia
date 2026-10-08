// Import one problem set into site/data/<set-id>.json and rebuild site/data/index.json.
//
//   node scripts/import.mjs <source-dir> <set-id>
//
// Reads <source-dir>/QUESTIONS.md, setup.sql, solutions.sql (Postgres originals, read-only),
// mysql/<set-id>/solutions.sql (MySQL ports) and sets-meta/<set-id>.json (tags, dialect notes).
// Parse rules are documented in CLAUDE.md. Any block it cannot place is a hard error.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "data");

const errors = [];
const fail = (msg) => errors.push(msg);

function read(path) {
  if (!existsSync(path)) throw new Error(`missing file: ${path}`);
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- markdown tables

function parseRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

// Split a block of markdown lines into { before, table, after }.
function splitTable(lines) {
  const start = lines.findIndex((l) => l.trim().startsWith("|"));
  if (start < 0) return { before: lines.join("\n").trim(), table: null, after: "" };
  let end = start;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  const rows = lines.slice(start, end);
  const columns = parseRow(rows[0]).map((c) => c.replace(/`/g, ""));
  const body = rows.slice(2).map((r) => parseRow(r).map((v) => (v === "NULL" ? null : v)));
  return {
    before: lines.slice(0, start).join("\n").trim(),
    table: { columns, rows: body },
    after: lines.slice(end).join("\n").trim(),
  };
}

// ---------------------------------------------------------------- QUESTIONS.md

function parseQuestions(md) {
  const lines = md.split("\n");
  const set = { title: "", description_md: "", er_mermaid: "", conventions_md: "", group_kind: "Tier",
                planted_traps: [], essentials: [], summary_table: null, problems: [] };

  set.title = (lines.find((l) => l.startsWith("# ")) || "# Untitled").slice(2).trim();

  const firstH2 = lines.findIndex((l) => l.startsWith("## "));
  const intro = lines.slice(lines.findIndex((l) => l.startsWith("# ")) + 1, firstH2);
  set.description_md = intro.join("\n").split(/\n\s*\n/).map((p) => p.trim())
    .filter((p) => p && p !== "---")[0] || "";

  const mm = md.match(/```mermaid\n([\s\S]*?)```/);
  if (mm) set.er_mermaid = mm[1].trim();

  const conv = lines.find((l) => l.startsWith("**Conventions:**"));
  if (conv) set.conventions_md = conv.replace("**Conventions:**", "").trim();

  const planted = lines.findIndex((l) => l.startsWith("**Planted on purpose**"));
  if (planted >= 0) {
    for (let i = planted + 1; i < lines.length && lines[i].startsWith("- "); i++)
      set.planted_traps.push(lines[i].slice(2).trim());
  }

  const ess = lines.find((l) => /^\*\*Short on time/.test(l));
  if (ess) set.essentials = [...ess.matchAll(/\bQ(\d+)\b/g)].map((m) => `Q${m[1]}`);

  // Data summary table (Table | Rows | Columns) right after the mermaid block.
  const dataH = lines.findIndex((l) => /^## The data/.test(l));
  if (dataH >= 0) {
    const next = lines.findIndex((l, i) => i > dataH && l.startsWith("## "));
    const t = splitTable(lines.slice(dataH + 1, next < 0 ? undefined : next).filter((l) => !l.startsWith("```")));
    set.summary_table = t.table;
  }

  // Problems.
  let tier = null, tierTitle = null, cur = null;
  const finish = () => { if (cur) { set.problems.push(cur); cur = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Sections: "## Tier A — title" (difficulty) or "## Topic 3 — title" (pattern).
    const t = line.match(/^## (Tier|Topic) (\w+)\s+[—-]\s+(.*)$/);
    if (t) { finish(); set.group_kind = t[1]; tier = t[2]; tierTitle = t[3].trim(); continue; }
    if (line.startsWith("## ")) { finish(); continue; }

    const q = line.match(/^### Q(\d+)\s+·\s+(.*?)\s*(?:`≈\s*LC\s+([^`]+)`)?\s*$/);
    if (q) {
      finish();
      cur = { id: `Q${q[1]}`, number: Number(q[1]), title: q[2].trim(),
              slug: slugify(q[2]), tier, tier_title: tierTitle,
              lc_ref: q[3] ? q[3].trim() : null, statement_md: "", hints_md: [], parts: [] };
      const stmt = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("<details>") && !lines[i].startsWith("#") && lines[i] !== "---") {
        stmt.push(lines[i]); i++;
      }
      cur.statement_md = stmt.join("\n").trim();
      i--;
      continue;
    }

    const d = line.match(/^<details><summary>(.*?)<\/summary>/);
    if (d && cur) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("</details>")) { body.push(lines[i]); i++; }
      const summary = d[1].trim();
      if (/^Hint/i.test(summary)) {
        cur.hints_md.push(body.join("\n").trim());
      } else if (/^Expected/i.test(summary)) {
        const lab = summary.match(/\((\w)\)/);
        const { before, table, after } = splitTable(body);
        cur.parts.push({ label: lab ? lab[1] : "", expected: table,
                         intro_md: before || null, note_md: after || null });
      } else {
        fail(`${cur.id}: unknown <details> summary "${summary}"`);
      }
    }
  }
  finish();
  return set;
}

// ---------------------------------------------------------------- setup.sql

function splitTuple(s) {
  // s is the inside of "( ... )"; split on commas outside single quotes.
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      if (q && s[i + 1] === "'") { cur += "'"; i++; continue; }
      q = !q; continue;
    }
    if (ch === "," && !q) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out.map((v) => (v.toUpperCase() === "NULL" ? null : v));
}

function parseSetup(sql) {
  const tables = [];
  const createRe = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = createRe.exec(sql))) {
    const name = m[1];
    const cols = []; let tablePk = [];
    for (const raw of m[2].split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const [code, ...rest] = line.split("--");
      const note = rest.join("--").trim() || null;
      const c = code.trim().replace(/,$/, "");
      const pk = c.match(/^PRIMARY KEY\s*\(([^)]*)\)/i);
      if (pk) { tablePk = pk[1].split(",").map((s) => s.trim()); continue; }
      const cm = c.match(/^(\w+)\s+([A-Z]+(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)(.*)$/i);
      if (!cm) { fail(`setup.sql: cannot parse column line in ${name}: ${line}`); continue; }
      const fk = cm[3].match(/REFERENCES\s+(\w+)\s*\((\w+)\)/i);
      cols.push({ name: cm[1], type: cm[2].replace(/\s+/g, ""),
                  pk: /PRIMARY KEY/i.test(cm[3]), fk: fk ? `${fk[1]}.${fk[2]}` : null,
                  nullable: !/NOT NULL|PRIMARY KEY/i.test(cm[3]), note });
    }
    for (const c of cols) if (tablePk.includes(c.name)) { c.pk = true; c.nullable = false; }
    tables.push({ name, columns: cols, rows: [] });
  }

  const insRe = /INSERT INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*([\s\S]*?);/g;
  while ((m = insRe.exec(sql))) {
    const t = tables.find((x) => x.name === m[1]);
    if (!t) { fail(`setup.sql: insert into unknown table ${m[1]}`); continue; }
    const order = m[2].split(",").map((s) => s.trim());
    const tupleRe = /\(((?:[^()']|'(?:[^']|'')*')*)\)/g;
    let tm;
    while ((tm = tupleRe.exec(m[3]))) {
      const vals = splitTuple(tm[1]);
      t.rows.push(t.columns.map((c) => vals[order.indexOf(c.name)] ?? null));
    }
  }
  return tables;
}

// ---------------------------------------------------------------- solutions.sql

const DIVIDER = /^-- (=+|TIER\b.*)$/;

function parseSolutions(sql, label) {
  const blocks = new Map(); // "Q5a" -> { noeq, chunks: [...] }
  let curKey = null, buf = [];
  const flush = () => { if (curKey) blocks.set(curKey, buildBlock(buf)); buf = []; };
  for (const line of sql.split("\n")) {
    const mk = line.match(/^-- @(Q\d+[a-z]?)\b/);
    if (mk) { flush(); curKey = mk[1]; continue; }
    if (curKey && !DIVIDER.test(line)) buf.push(line);
  }
  flush();
  if (!blocks.size) fail(`${label}: no -- @Q markers found`);
  return blocks;
}

function buildBlock(lines) {
  const noeq = lines.some((l) => l.trim() === "-- @noeq");
  lines = lines.filter((l) => l.trim() !== "-- @noeq");
  // Chunks = runs of non-blank lines.
  const chunks = []; let cur = [];
  for (const l of lines) {
    if (l.trim() === "") { if (cur.length) chunks.push(cur); cur = []; } else cur.push(l);
  }
  if (cur.length) chunks.push(cur);

  const approaches = [], traps = [];
  let intro = [];
  for (const ch of chunks) {
    const firstSql = ch.findIndex((l) => !l.trim().startsWith("--"));
    if (firstSql < 0) {
      // comment-only chunk: block intro before any statement, else trailing note
      const text = ch.map((l) => l.replace(/^--\s?/, "")).join("\n");
      if (!approaches.length && !traps.length) intro.push(text);
      else (approaches.at(-1) || traps.at(-1)).sql += "\n\n" + ch.join("\n");
      continue;
    }
    let comments = ch.slice(0, firstSql).map((l) => l.replace(/^--\s?/, ""));
    // Comments above the first labelled approach describe the whole problem.
    const labelAt = comments.findIndex((c) => /^(\(\w\)|Step \d+:|Correct:|TRAP:)/.test(c));
    if (labelAt > 0 && !approaches.length && !traps.length) {
      intro.push(comments.slice(0, labelAt).join(" "));
      comments = comments.slice(labelAt);
    }
    const sqlText = ch.slice(firstSql).join("\n");
    let lab = "";
    let isTrap = false;
    const out = [];
    for (const c of comments) {
      let m;
      if ((m = c.match(/^TRAP:\s*(.*)$/))) { isTrap = true; out.push(m[1]); }
      else if ((m = c.match(/^\((\w)\)\s*(.*)$/))) { lab = `Approach ${m[1]}`; out.push(m[2]); }
      else if ((m = c.match(/^(Step \d+):\s*(.*)$/))) { lab = m[1]; out.push(m[2]); }
      else if ((m = c.match(/^Correct:\s*(.*)$/))) { lab = "Correct"; out.push(m[1]); }
      else out.push(c);
    }
    const entry = { label: lab, comment_md: out.join(" ").replace(/\s+/g, " ").trim(), sql: sqlText };
    (isTrap ? traps : approaches).push(entry);
  }
  return { noeq, intro_md: intro.join("\n\n").replace(/\n/g, " ").trim(), approaches, traps,
           raw: lines.join("\n").trim() };
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, " ");
}

// ---------------------------------------------------------------- main

function main() {
  const [srcArg, setId] = process.argv.slice(2);
  if (!srcArg || !setId) {
    console.error("usage: node scripts/import.mjs <source-dir> <set-id>");
    process.exit(2);
  }
  const src = resolve(ROOT, srcArg);
  const q = parseQuestions(read(join(src, "QUESTIONS.md")));
  const setupSql = read(join(src, "setup.sql"));
  const tables = parseSetup(setupSql);
  // Sets authored in MySQL ship their solutions directly; Postgres sets have a port in mysql/<set-id>/.
  const portPath = join(ROOT, "mysql", setId, "solutions.sql");
  const native = !existsSync(portPath);
  const pg = native ? new Map() : parseSolutions(read(join(src, "solutions.sql")), "solutions.sql");
  const my = parseSolutions(read(native ? join(src, "solutions.sql") : portPath),
    native ? "solutions.sql" : `mysql/${setId}/solutions.sql`);
  const metaPath = join(ROOT, "sets-meta", `${setId}.json`);
  const meta = existsSync(metaPath) ? JSON.parse(read(metaPath)) : { problems: {} };

  const tableNames = tables.map((t) => t.name);
  const problems = q.problems.map((p) => {
    const m = meta.problems?.[p.id] || {};
    const partLabels = p.parts.length ? p.parts.map((x) => x.label) : [""];
    const solutions = partLabels.map((lab) => {
      const key = p.id + lab;
      const mb = my.get(key), pb = pg.get(key);
      if (!native && !pb) fail(`${key}: no block in source solutions.sql`);
      if (!mb) fail(`${key}: no MySQL solution block`);
      return {
        part: lab,
        noeq: !!(mb?.noeq || pb?.noeq),
        intro_md: mb?.intro_md || "",
        mysql: mb?.approaches || [],
        traps: mb?.traps || [],
        postgres_original: pb?.raw || "",
      };
    });
    for (const part of p.parts)
      if (!part.expected && !solutions.find((s) => s.part === part.label)?.noeq)
        fail(`${p.id}${part.label}: expected output has no table and block is not @noeq`);
    if (!p.parts.length) fail(`${p.id}: no expected output`);

    const allSql = stripComments(solutions.flatMap((s) => [...s.mysql, ...s.traps].map((a) => a.sql)).join("\n"));
    const tables_used = tableNames.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(allSql));

    return { ...p, dialect_note_md: m.dialect_note_md || null, tags: m.tags || [],
             tables_used, solutions };
  });

  for (const key of my.keys())
    if (!problems.some((p) => p.solutions.some((s) => p.id + s.part === key)))
      fail(`mysql/${setId}/solutions.sql: block ${key} matches no problem`);
  for (const id of Object.keys(meta.problems || {}))
    if (!problems.some((p) => p.id === id)) fail(`sets-meta/${setId}.json: unknown problem ${id}`);

  if (errors.length) {
    console.error(`import failed (${errors.length}):\n  - ` + errors.join("\n  - "));
    process.exit(1);
  }

  const set = {
    id: setId,
    title: meta.title || q.title,
    full_title: q.title,
    group_kind: q.group_kind,
    native_mysql: native,
    description_md: q.description_md,
    conventions_md: q.conventions_md,
    planted_traps: q.planted_traps,
    essentials: q.essentials,
    er_mermaid: q.er_mermaid,
    setup_sql: setupSql.trim(),
    tables,
    problems,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${setId}.json`), JSON.stringify(set, null, 1));

  // Rebuild index.json from every set file present.
  const sets = readdirSync(OUT)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(readFileSync(join(OUT, f), "utf8")))
    .map((s) => ({ id: s.id, title: s.title, full_title: s.full_title, group_kind: s.group_kind || "Tier",
                   problem_count: s.problems.length,
                   tiers: [...new Map(s.problems.map((p) => [p.tier, p.tier_title])).entries()]
                     .map(([id, title]) => ({ id, title })) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(join(OUT, "index.json"), JSON.stringify({ sets }, null, 1));

  const parts = problems.reduce((n, p) => n + p.parts.length, 0);
  console.log(`imported ${setId}: ${problems.length} problems, ${parts} expected tables, ` +
    `${tables.length} tables (${tables.map((t) => `${t.name} ${t.rows.length}`).join(", ")})`);
}

main();
