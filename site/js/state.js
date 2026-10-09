// Practice store (localStorage key "sqlpedia.v1"). Older saves load unchanged.
//
// { version: 1,
//   problems: { "<collection>/<id>": { status: "new"|"attempted"|"solved", completed_at, revealed, note,
//               answer_sql, history: [{ at, action, note }],
//               submissions: [{ at, verdict: "accepted"|"wrong"|"error", dialect, sql, ms }] } },
//   days: { "YYYY-MM-DD": { completed: [key], attempted: [key] } } }
//
// actions: completed | practiced | attempted | accepted | wrong
// Day keys are local dates. Every storage access is wrapped: the site works without storage.

import { dayKey, parseDay, addDays } from "./util.js";

const KEY = "sqlpedia.v1";
const STATUSES = ["new", "attempted", "solved"];
const ACTIONS = ["completed", "practiced", "attempted", "accepted", "wrong"];
const VERDICTS = ["accepted", "wrong", "error"];
const DONE_ACTIONS = ["completed", "practiced", "accepted"];
const listeners = new Set();
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
const strList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string") : []);
const isDate = (s) => typeof s === "string" && !isNaN(Date.parse(s));

function empty() { return { version: 1, problems: {}, days: {} }; }

function normalize(s) {
  if (!isObj(s) || s.version !== 1 || !isObj(s.problems) || !isObj(s.days)) return null;
  const out = empty();
  for (const [key, e] of Object.entries(s.problems)) {
    if (!isObj(e)) continue;
    const history = (Array.isArray(e.history) ? e.history : [])
      .filter((h) => isObj(h) && ACTIONS.includes(h.action) && isDate(h.at))
      .map((h) => ({ at: h.at, action: h.action, note: typeof h.note === "string" ? h.note : "" }));
    const submissions = (Array.isArray(e.submissions) ? e.submissions : [])
      .filter((x) => isObj(x) && VERDICTS.includes(x.verdict) && isDate(x.at))
      .map((x) => ({ at: x.at, verdict: x.verdict, dialect: x.dialect === "tsql" ? "tsql" : "mysql",
        sql: typeof x.sql === "string" ? x.sql.slice(0, 20000) : "", ms: Number(x.ms) || 0 }))
      .slice(-50);
    out.problems[key] = {
      status: STATUSES.includes(e.status) ? e.status : "new",
      history, submissions,
      completed_at: isDate(e.completed_at) ? e.completed_at : null,
      answer_sql: typeof e.answer_sql === "string" ? e.answer_sql : "",
      note: typeof e.note === "string" ? e.note : "",
      revealed: e.revealed === true,
    };
  }
  for (const [k, d] of Object.entries(s.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const day = Array.isArray(d) ? { completed: strList(d), attempted: [] }
      : isObj(d) ? { completed: strList(d.completed), attempted: strList(d.attempted) } : null;
    if (day && (day.completed.length || day.attempted.length)) out.days[k] = day;
  }
  return out;
}

function load() {
  try { const raw = localStorage.getItem(KEY); return (raw && normalize(JSON.parse(raw))) || empty(); }
  catch { return empty(); }
}

let store = load();
let storageOk = true;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; } catch { storageOk = false; }
  listeners.forEach((fn) => { try { fn(); } catch {} });
}

export const storageAvailable = () => storageOk;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const get = (key) => store.problems[key] || { status: "new", history: [], submissions: [] };
export const status = (key) => get(key).status || "new";

function entry(key) { return (store.problems[key] ||= { status: "new", history: [], submissions: [] }); }
function day(k) { return (store.days[k] ||= { completed: [], attempted: [] }); }
function addTo(list, key) { if (!list.includes(key)) list.push(key); }

function markDone(e, key, at, action, note = "") {
  const again = e.status === "solved";
  e.status = "solved";
  if (!e.completed_at) e.completed_at = at;
  e.history.push({ at, action: action === "completed" && again ? "practiced" : action, note });
  addTo(day(dayKey(new Date(at))).completed, key);
}

export function complete(key, { answer_sql = "", note = "" } = {}) {
  const e = entry(key);
  const at = new Date().toISOString();
  if (answer_sql) e.answer_sql = answer_sql;
  if (note) e.note = note;
  markDone(e, key, at, "completed", note);
  save();
}

export function attempt(key, note = "") {
  const e = entry(key);
  const at = new Date().toISOString();
  if (e.status !== "solved") e.status = "attempted";
  e.history.push({ at, action: "attempted", note });
  addTo(day(dayKey(new Date(at))).attempted, key);
  save();
}

// A Submit from the editor. Accepted marks the problem solved; anything else is an attempt.
export function submit(key, { verdict, dialect, sql, ms }) {
  const e = entry(key);
  const at = new Date().toISOString();
  e.submissions.push({ at, verdict, dialect, sql: sql.slice(0, 20000), ms });
  if (e.submissions.length > 50) e.submissions = e.submissions.slice(-50);
  if (verdict === "accepted") { e.answer_sql = sql; markDone(e, key, at, "accepted"); }
  else {
    if (e.status !== "solved") e.status = "attempted";
    e.history.push({ at, action: verdict === "wrong" ? "wrong" : "attempted", note: "" });
    addTo(day(dayKey(new Date(at))).attempted, key);
  }
  save();
}

export function undo(key) {
  const e = store.problems[key];
  if (!e || !e.history.length) return;
  const last = e.history.pop();
  const si = (e.submissions || []).findIndex((x) => x.at === last.at);
  if (si >= 0) e.submissions.splice(si, 1);
  const k = dayKey(new Date(last.at));
  const d = store.days[k];
  if (d) {
    const list = DONE_ACTIONS.includes(last.action) ? "completed" : "attempted";
    const stillThere = e.history.some((h) => dayKey(new Date(h.at)) === k &&
      (list === "completed" ? DONE_ACTIONS.includes(h.action) : !DONE_ACTIONS.includes(h.action)));
    if (!stillThere) d[list] = d[list].filter((x) => x !== key);
    if (!d.completed.length && !d.attempted.length) delete store.days[k];
  }
  const done = e.history.filter((h) => DONE_ACTIONS.includes(h.action));
  e.status = done.length ? "solved" : e.history.length ? "attempted" : "new";
  e.completed_at = done.length ? done[0].at : null;
  save();
}

export function setRevealed(key, v = true) { entry(key).revealed = v; save(); }

// ------------------------------------------------------------ derived stats

export function activity() {
  const out = {};
  for (const [k, d] of Object.entries(store.days)) {
    const n = new Set([...(d.completed || []), ...(d.attempted || [])]).size;
    if (n) out[k] = n;
  }
  return out;
}
export function dayDetail(k) { const d = store.days[k] || {}; return { completed: d.completed || [], attempted: d.attempted || [] }; }

export function streaks() {
  const act = activity();
  const days = Object.keys(act).sort();
  let longest = 0, run = 0, prev = null;
  for (const k of days) {
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = parseDay(k);
  }
  let cur = 0, d = new Date();
  if (!act[dayKey(d)]) d = addDays(d, -1);
  while (act[dayKey(d)]) { cur++; d = addDays(d, -1); }
  return { current: cur, longest, activeDays: days.length, practicedToday: !!act[dayKey()] };
}

export function recentHistory(limit = 30) {
  const all = [];
  for (const [key, e] of Object.entries(store.problems)) for (const h of e.history || []) all.push({ key, ...h });
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function lastTouched() {
  let best = null;
  for (const [key, e] of Object.entries(store.problems)) {
    const t = [...(e.history || []), ...(e.submissions || [])].map((x) => x.at).sort().pop();
    if (t && (!best || t > best.at)) best = { key, at: t, status: e.status };
  }
  return best;
}

// ------------------------------------------------------------ export / import

export function exportJson() { return JSON.stringify({ ...store, exported_at: new Date().toISOString() }, null, 2); }
export function importJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  const s = normalize(parsed);
  if (!s) throw new Error("Not a SQLpedia progress file (expected version 1 with problems and days).");
  store = s;
  save();
}
