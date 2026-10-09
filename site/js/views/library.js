// Problem library: rail (collection, status) + filter bar (difficulty toggles, topic dropdown) + list,
// grouped by section when a collection has sections.

import { esc, ICON, plural } from "../util.js";
import { problemHref, TOPIC_FAMILIES } from "../data.js";
import * as state from "../state.js";
import { diffPill, statusIcon } from "./common.js";

const DIFFS = ["Easy", "Medium", "Hard"];
const STATUS = [["new", "Not started"], ["attempted", "Attempted"], ["solved", "Solved"]];

// Kept across re-renders so toggling a filter doesn't close the topic panel or lose focus.
let topicsOpen = false;
let lastColl = null;
let refocus = "";

const list = (v) => (v ? v.split(",").filter(Boolean) : []);
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function renderLibrary(catalog, query) {
  const f = { c: query.get("c") || "", topic: query.get("topic") || "", d: query.get("d") || "", s: query.get("s") || "", q: query.get("q") || "" };
  const ds = list(f.d), ts = list(f.topic);
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const inColl = catalog.problems.filter((p) => !f.c || p.c === f.c);
  const pass = { d: (p) => !ds.length || ds.includes(p.difficulty), t: (p) => !ts.length || ts.some((t) => p.topics.includes(t)),
    s: (p) => !f.s || state.status(p.key) === f.s, q: (p) => terms.every((t) => `${p.title} ${p.id} ${p.topics.join(" ")}`.toLowerCase().includes(t)) };
  // facet counts: apply every filter except the facet's own
  const except = (k) => inColl.filter((p) => Object.entries(pass).every(([n, fn]) => n === k || fn(p)));
  const shown = except("");

  const href = (patch) => {
    const n = { ...f, ...patch };
    const qs = new URLSearchParams(Object.entries(n).filter(([, v]) => v)).toString();
    return `#/problems${qs ? "?" + qs : ""}`;
  };
  const opt = (label, count, active, patch) =>
    `<a class="opt" href="${href(patch)}" aria-pressed="${active}" role="button"><span>${esc(label)}</span><span class="n">${count}</span></a>`;

  const rail = `<aside class="rail" id="rail" aria-label="Collections and status">
    <div><h4>Collection</h4>
      ${opt("All problems", catalog.problems.length, !f.c, { c: "", topic: "" })}
      ${catalog.collections.map((c) => opt(c.title, c.count, f.c === c.id, { c: f.c === c.id ? "" : c.id, topic: "" })).join("")}</div>
    <div><h4>Status</h4>${STATUS.map(([k, l]) => opt(l, except("s").filter((p) => state.status(p.key) === k).length, f.s === k, { s: f.s === k ? "" : k })).join("")}</div>
  </aside>`;

  // difficulty toggles
  const forD = except("d");
  const diffBtns = DIFFS.map((d) => {
    const n = forD.filter((p) => p.difficulty === d).length, on = ds.includes(d);
    if (!n && !on) return "";
    return `<a class="ftog ${d.toLowerCase()}" data-k="d:${d}" href="${href({ d: toggle(ds, d).join(",") })}" role="button" aria-pressed="${on}">${esc(d)}<span class="n">${n}</span></a>`;
  }).join("");

  // topic panel, grouped by family; only topics present in the collection
  const forT = except("t");
  const tCount = (t) => forT.filter((p) => p.topics.includes(t)).length;
  const present = new Set(inColl.flatMap((p) => p.topics));
  const known = new Set(TOPIC_FAMILIES.flatMap(([, x]) => x));
  const more = [...present].filter((t) => !known.has(t)).sort();
  const groups = [...TOPIC_FAMILIES, ...(more.length ? [["More", more]] : [])].map(([fam, list]) => {
    const items = list.filter((t) => present.has(t) && (tCount(t) || ts.includes(t)));
    if (!items.length) return "";
    return `<div class="tgroup"><div class="tfam">${esc(fam)}</div><div class="tchips">
      ${items.map((t) => `<a class="ftog" data-k="t:${esc(t)}" href="${href({ topic: toggle(ts, t).join(",") })}" role="button" aria-pressed="${ts.includes(t)}">${esc(t)}<span class="n">${tCount(t)}</span></a>`).join("")}
    </div></div>`;
  }).join("");

  const fbar = `<div class="fbar card" role="group" aria-label="Filter problems">
    <div class="fbar-row">
      <span class="flabel">Difficulty</span><div class="ftogs">${diffBtns}</div>
      <button class="btn ftopics" id="topicsBtn" aria-expanded="${topicsOpen}" aria-controls="topicPanel">Topics${ts.length ? ` <span class="badge">${ts.length}</span>` : ""}<span class="caret" aria-hidden="true">▾</span></button>
      ${ds.length || ts.length ? `<a class="small" data-k="clear" href="${href({ d: "", topic: "" })}">Reset</a>` : ""}
    </div>
    <div class="tpanel" id="topicPanel"${topicsOpen ? "" : " hidden"}>${groups || `<span class="muted small">No topics.</span>`}</div>
  </div>`;

  const chips = [
    f.c && [catalog.collectionById(f.c)?.title || f.c, { c: "", topic: "" }],
    ...ts.map((t) => [t, { topic: ts.filter((x) => x !== t).join(",") }]),
    ...ds.map((d) => [d, { d: ds.filter((x) => x !== d).join(",") }]),
    f.s && [STATUS.find(([k]) => k === f.s)?.[1], { s: "" }], f.q && [`“${f.q}”`, { q: "" }],
  ].filter(Boolean);

  const row = (p) => `<a class="plist-row" href="${problemHref(p.key)}">
      ${statusIcon(p.key)}
      <span style="min-width:0"><span class="t">${esc(p.title)}</span><span class="s">${esc(catalog.collectionById(p.c).title)} · ${esc(p.id)}</span></span>
      <span class="tags">${p.topics.slice(0, 2).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}${p.topics.length > 2 ? `<span class="chip">+${p.topics.length - 2}</span>` : ""}</span>
      <span class="d">${diffPill(p.difficulty)}</span></a>`;
  // inside one collection with sections: a heading per section, in collection order
  let rows;
  if (f.c && shown.some((p) => p.section)) {
    const secs = [];
    for (const p of shown) {
      const last = secs[secs.length - 1];
      if (last && last.name === (p.section || "")) last.items.push(p); else secs.push({ name: p.section || "", items: [p] });
    }
    rows = secs.map((s) => `${s.name ? `<div class="plist-sec"><span>${esc(s.name)}</span><span class="n">${s.items.filter((p) => state.status(p.key) === "solved").length} / ${s.items.length} solved</span></div>` : ""}${s.items.map(row).join("")}`).join("");
  } else rows = shown.map(row).join("");

  const title = f.c ? catalog.collectionById(f.c)?.title || "Problems" : ts.length === 1 ? ts[0] : "Problems";
  const coll = f.c && catalog.collectionById(f.c);
  const html = `<div class="page">
    <div class="eyebrow">${f.c && ts.length === 1 ? esc(ts[0]) : "Problems"}</div>
    <h1 class="page-title">${esc(title)}</h1>
    ${coll ? `<p class="lede">${esc((coll.description_md || "").replace(/[*`]/g, ""))}${coll.kind === "shared" ? ` <a href="#/data/${coll.id}">See the dataset →</a>` : ""}</p>` : ""}
    <div class="lib">
      ${rail}
      <div style="min-width:0">
        ${fbar}
        <div class="lib-head">
          <button class="btn filter-toggle" id="filterToggle" aria-controls="rail" aria-expanded="false">${ICON.filter} Collection</button>
          <input class="filter-input" id="libFilter" type="search" placeholder="Filter by title or topic" value="${esc(f.q)}" aria-label="Filter problems by text">
          <span class="muted small grow" style="text-align:right">${plural(shown.length, "problem")}</span>
        </div>
        ${chips.length ? `<div class="active-filters">${chips.map(([l, patch]) => `<a class="chip" href="${href(patch)}" aria-label="Remove filter ${esc(l)}">${esc(l)} ${ICON.x}</a>`).join("")}<a class="small" href="#/problems" style="align-self:center">Clear all</a></div>` : ""}
        <div class="card plist">
          <div class="plist-head"><span></span><span>Title</span><span class="tags">Topics</span><span style="text-align:right">Difficulty</span></div>
          ${rows || `<div class="empty-state"><b>No problems match</b><a href="${href({ d: "", topic: "", s: "", q: "" })}">Clear filters</a></div>`}
        </div>
      </div>
    </div></div>`;

  // staying in the same collection = filtering in place: keep the scroll position
  const sameColl = lastColl === f.c;
  lastColl = f.c;

  return {
    title, html,
    mount(root) {
      const input = root.querySelector("#libFilter");
      let t = null;
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => { const pos = input.selectionStart; history.replaceState(null, "", href({ q: input.value.trim() })); window.dispatchEvent(new HashChangeEvent("hashchange")); requestAnimationFrame(() => { const i = document.getElementById("libFilter"); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }); }, 250);
      });
      const tog = root.querySelector("#filterToggle");
      tog.addEventListener("click", () => tog.setAttribute("aria-expanded", String(root.querySelector("#rail").classList.toggle("open"))));
      const tb = root.querySelector("#topicsBtn"), panel = root.querySelector("#topicPanel");
      tb.addEventListener("click", () => { topicsOpen = panel.hidden; panel.hidden = !topicsOpen; tb.setAttribute("aria-expanded", String(topicsOpen)); });
      root.querySelector(".fbar").addEventListener("click", (e) => { const a = e.target.closest("[data-k]"); if (a) refocus = a.dataset.k; });
      if (refocus) {
        const el = [...root.querySelectorAll(".fbar [data-k]")].find((x) => x.dataset.k === refocus) || tb;
        el.focus({ preventScroll: true });
        refocus = "";
      }
      // leaving the library: the next visit starts at the top
      return () => { clearTimeout(t); if (!location.hash.startsWith("#/problems")) lastColl = null; };
    },
    keepScroll: !!f.q || sameColl,
  };
}
