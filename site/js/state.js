// Practice tracker store (localStorage key "sqlpedia.v1"). Contract in CLAUDE.md.
//
// { version: 1,
//   problems: { "<set>/<id>": { status: "new"|"attempted"|"solved", completed_at, answer_sql,
//                                note, revealed, history: [{ at, action, note }] } },
//   days: { "YYYY-MM-DD": { completed: [key], attempted: [key] } } }
//
// Day keys are local dates. Every storage access is wrapped: the site works without storage.

import { dayKey, parseDay, addDays } from "./util.js";

const KEY = "sqlpedia.v1";
const listeners = new Set();
let store = load();

function empty() { return { version: 1, problems: {}, days: {} }; }

const STATUSES = ["new", "attempted", "solved"];
const ACTIONS = ["completed", "practiced", "attempted"];
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
const strList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string") : []);

// Coerce anything (old shapes, hand-edited or crafted files) into the current contract.
function normalize(s) {
  if (!isObj(s) || s.version !== 1 || !isObj(s.problems) || !isObj(s.days)) return null;
  const out = empty();
  for (const [key, e] of Object.entries(s.problems)) {
    if (!isObj(e)) continue;
    const history = (Array.isArray(e.history) ? e.history : [])
      .filter((h) => isObj(h) && ACTIONS.includes(h.action) && typeof h.at === "string" && !isNaN(Date.parse(h.at)))
      .map((h) => ({ at: h.at, action: h.action, note: typeof h.note === "string" ? h.note : "" }));
    out.problems[key] = {
      status: STATUSES.includes(e.status) ? e.status : "new",
      history,
      completed_at: typeof e.completed_at === "string" && !isNaN(Date.parse(e.completed_at)) ? e.completed_at : null,
      answer_sql: typeof e.answer_sql === "string" ? e.answer_sql : "",
      note: typeof e.note === "string" ? e.note : "",
      revealed: e.revealed === true,
    };
    if (out.problems[key].status === "solved" && !out.problems[key].completed_at)
      out.problems[key].completed_at = history.find((h) => h.action !== "attempted")?.at || new Date().toISOString();
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
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && normalize(JSON.parse(raw))) || empty();
  } catch { return empty(); }
}

let storageOk = true;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; }
  catch { storageOk = false; }
  listeners.forEach((fn) => fn());
}

export const storageAvailable = () => storageOk;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function get(key) {
  return store.problems[key] || { status: "new", history: [] };
}
export const status = (key) => get(key).status || "new";

function entry(key) {
  return (store.problems[key] ||= { status: "new", history: [] });
}
function day(k) { return (store.days[k] ||= { completed: [], attempted: [] }); }
function addTo(list, key) { if (!list.includes(key)) list.push(key); }

export function complete(key, { answer_sql = "", note = "" } = {}) {
  const e = entry(key);
  const now = new Date();
  const again = e.status === "solved";
  e.status = "solved";
  if (!e.completed_at) e.completed_at = now.toISOString();
  if (answer_sql) e.answer_sql = answer_sql;
  if (note) e.note = note;
  e.history.push({ at: now.toISOString(), action: again ? "practiced" : "completed", note });
  addTo(day(dayKey(now)).completed, key);
  save();
}

export function attempt(key, note = "") {
  const e = entry(key);
  const now = new Date();
  if (e.status !== "solved") e.status = "attempted";
  e.history.push({ at: now.toISOString(), action: "attempted", note });
  addTo(day(dayKey(now)).attempted, key);
  save();
}

// Undo the most recent history action for this problem.
export function undo(key) {
  const e = store.problems[key];
  if (!e || !e.history.length) return;
  const last = e.history.pop();
  const k = dayKey(new Date(last.at));
  const d = store.days[k];
  if (d) {
    const sameDay = (a) => e.history.some((h) => h.action === a && dayKey(new Date(h.at)) === k);
    const list = last.action === "attempted" ? "attempted" : "completed";
    const stillThere = list === "attempted" ? sameDay("attempted") : (sameDay("completed") || sameDay("practiced"));
    if (!stillThere) d[list] = d[list].filter((x) => x !== key);
    if (!d.completed.length && !d.attempted.length) delete store.days[k];
  }
  const done = e.history.filter((h) => h.action !== "attempted");
  e.status = done.length ? "solved" : e.history.length ? "attempted" : "new";
  e.completed_at = done.length ? done[0].at : null;
  save();
}

export function setRevealed(key, v = true) {
  entry(key).revealed = v;
  save();
}

export function saveAnswer(key, answer_sql, note) {
  const e = entry(key);
  e.answer_sql = answer_sql;
  e.note = note;
  save();
}

// ------------------------------------------------------------ derived stats

export function activity() {
  // { "YYYY-MM-DD": count of distinct problems touched that day }
  const out = {};
  for (const [k, d] of Object.entries(store.days)) {
    const n = new Set([...(d.completed || []), ...(d.attempted || [])]).size;
    if (n) out[k] = n;
  }
  return out;
}

export function streaks() {
  const act = activity();
  const days = Object.keys(act).sort();
  let longest = 0, run = 0, prev = null;
  for (const k of days) {
    const d = parseDay(k);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // Current streak: counts back from today; if today is empty, from yesterday.
  let cur = 0;
  let d = new Date();
  if (!act[dayKey(d)]) d = addDays(d, -1);
  while (act[dayKey(d)]) { cur++; d = addDays(d, -1); }
  return { current: cur, longest, activeDays: days.length, practicedToday: !!act[dayKey()] };
}

export function dayDetail(k) {
  const d = store.days[k] || {};
  return { completed: d.completed || [], attempted: d.attempted || [] };
}

export function recentHistory(limit = 30) {
  const all = [];
  for (const [key, e] of Object.entries(store.problems))
    for (const h of e.history || []) all.push({ key, ...h });
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ------------------------------------------------------------ export / import

export function exportJson() {
  return JSON.stringify({ ...store, exported_at: new Date().toISOString() }, null, 2);
}

export function importJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  const s = normalize(parsed);
  if (!s) throw new Error("Not a SQLpedia progress file (expected version 1 with problems and days).");
  store = s;
  save();
}

export function clearAll() {
  store = empty();
  save();
}
