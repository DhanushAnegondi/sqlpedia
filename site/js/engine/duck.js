// In-browser SQL engine: DuckDB-WASM (pinned) + the MySQL / SQL Server translator.
// Each run gets a fresh schema, loads the problem's tables, then runs the user's script.
// The result of the last statement that returns rows is shown.

import { translate, splitStatements, SESSION_SETUP, TranslateError } from "./translate.js";

const DUCKDB_ESM = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm";
let dbPromise = null;
let runSeq = 0;

export function engineState() { return dbPromise ? "starting-or-ready" : "cold"; }

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const duckdb = await import(DUCKDB_ESM);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      return db;
    })().catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

export function warmUp() { getDb().catch(() => {}); }

const RETURNS_ROWS = /^\s*(\(?\s*SELECT|WITH|VALUES|TABLE|SHOW|DESCRIBE|EXPLAIN|PRAGMA|SUMMARIZE)\b/i;

// ------------------------------------------------------------ Arrow -> display strings

const pad = (n, w = 2) => String(n).padStart(w, "0");
function fmtDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function fmtTs(ms) {
  const d = new Date(ms);
  return `${fmtDate(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
function decimalToString(v, scale) {
  // Arrow decimals arrive as little-endian 32-bit words (BN objects extend typed arrays).
  let words;
  if (typeof v === "bigint") words = null;
  else if (ArrayBuffer.isView(v)) words = new Uint32Array(v.buffer, v.byteOffset, Math.floor(v.byteLength / 4));
  else return String(v);
  let big = 0n;
  if (words) {
    for (let i = words.length - 1; i >= 0; i--) big = (big << 32n) + BigInt(words[i]);
    const bits = BigInt(words.length * 32);
    if (words[words.length - 1] & 0x80000000) big -= 1n << bits;
  } else big = v;
  const neg = big < 0n;
  let s = (neg ? -big : big).toString();
  if (scale > 0) {
    s = s.padStart(scale + 1, "0");
    s = s.slice(0, -scale) + "." + s.slice(-scale);
  }
  return (neg ? "-" : "") + s;
}
function fmtDouble(x) {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return String(x);
  return String(Number(x.toFixed(6)));
}

function toCell(v, type) {
  if (v === null || v === undefined) return null;
  const id = type.typeId;
  switch (id) {
    case 7: return decimalToString(v, type.scale);                     // Decimal
    case 8: return fmtDate(v instanceof Date ? v.getTime() : Number(v)); // Date
    case 10: {                                                          // Timestamp
      let ms = v instanceof Date ? v.getTime() : Number(v);
      const unit = type.unit; // 0 s, 1 ms, 2 us, 3 ns (arrow-js already scales to ms for get())
      if (unit === 0 && ms < 1e11) ms *= 1000;
      return fmtTs(ms);
    }
    case 6: return v ? "1" : "0";                                       // Bool, shown like MySQL
    case 3: return fmtDouble(Number(v));                                // Float
    case 2: return String(v);                                           // Int (number or bigint)
    default:
      if (typeof v === "object" && v.toJSON) return JSON.stringify(v.toJSON());
      return String(v);
  }
}

function arrowToResult(table) {
  const fields = table.schema.fields;
  const cols = fields.map((f) => f.name);
  const vectors = fields.map((_, i) => table.getChildAt(i));
  const rows = [];
  for (let r = 0; r < table.numRows; r++) rows.push(fields.map((f, c) => toCell(vectors[c].get(r), f.type)));
  // MySQL shows DATE + INTERVAL as a DATE; DuckDB returns a TIMESTAMP. A timestamp column
  // that is entirely midnight is displayed as dates.
  fields.forEach((f, c) => {
    if (f.type.typeId === 10 && rows.length && rows.every((row) => row[c] === null || row[c].endsWith(" 00:00:00")))
      rows.forEach((row) => { if (row[c] !== null) row[c] = row[c].slice(0, 10); });
  });
  return { columns: cols, rows };
}

// ------------------------------------------------------------ public

export async function runSql({ setup = "", sql, dialect = "mysql", maxRows = 1000 }) {
  const started = performance.now();
  let duckSql;
  try {
    duckSql = translate(sql, dialect);
  } catch (e) {
    return { ok: false, error: e.message, kind: e instanceof TranslateError ? "translate" : "error", ms: 0 };
  }
  let db;
  try { db = await getDb(); }
  catch (e) { return { ok: false, kind: "load", error: "Couldn't start the in-browser SQL engine (needs an internet connection the first time). " + e.message, ms: 0 }; }
  const conn = await db.connect();
  const schema = `run${++runSeq}`;
  try {
    for (const s of SESSION_SETUP[dialect]) await conn.query(s);
    await conn.query(`CREATE SCHEMA ${schema}`);
    await conn.query(`USE memory.${schema}`);
    if (setup) for (const st of splitStatements(translate(setup, "mysql"))) await conn.query(st);
    let last = null, affected = 0, statements = 0;
    for (const st of splitStatements(duckSql)) {
      statements++;
      const res = await conn.query(st);
      if (RETURNS_ROWS.test(st)) last = res;
      else if (res && res.numRows) {
        const v = res.getChildAt(0)?.get(0);
        if (typeof v === "number" || typeof v === "bigint") affected += Number(v);
      }
    }
    const ms = Math.round(performance.now() - started);
    if (!statements) return { ok: false, error: "Nothing to run.", kind: "error", ms };
    if (!last) return { ok: true, columns: [], rows: [], ms, message: `Done. ${affected} row(s) affected; no result set returned.` };
    const out = arrowToResult(last);
    const truncated = out.rows.length > maxRows;
    if (truncated) out.rows = out.rows.slice(0, maxRows);
    return { ok: true, ...out, ms, truncated };
  } catch (e) {
    return { ok: false, kind: "sql", error: cleanError(e.message), ms: Math.round(performance.now() - started) };
  } finally {
    try { await conn.query("USE memory.main"); await conn.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } catch {}
    await conn.close();
  }
}

function cleanError(msg) {
  return String(msg || "Error").replace(/\n\s*LINE \d+:[\s\S]*$/, "").replace(/^(\w+ Error): /, "$1: ").slice(0, 600);
}
