// Problem library: filter rail (collection, difficulty, status, topic families) + compact list.

import { esc, ICON, plural } from "../util.js";
import { problemHref, TOPIC_FAMILIES } from "../data.js";
import * as state from "../state.js";
import { diffPill, statusIcon } from "./common.js";

const DIFFS = ["Easy", "Medium", "Hard"];
const STATUS = [["new", "Not started"], ["attempted", "Attempted"], ["solved", "Solved"]];

export function renderLibrary(catalog, query) {
  const f = { c: query.get("c") || "", topic: query.get("topic") || "", d: query.get("d") || "", s: query.get("s") || "", q: query.get("q") || "" };
  const inColl = catalog.problems.filter((p) => !f.c || p.c === f.c);
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = inColl.filter((p) =>
    (!f.topic || p.topics.includes(f.topic)) && (!f.d || p.difficulty === f.d) && (!f.s || state.status(p.key) === f.s) &&
    terms.every((t) => `${p.title} ${p.id} ${p.topics.join(" ")}`.toLowerCase().includes(t)));

  const href = (patch) => {
    const n = { ...f, ...patch };
    const qs = new URLSearchParams(Object.entries(n).filter(([, v]) => v)).toString();
    return `#/problems${qs ? "?" + qs : ""}`;
  };
  const opt = (label, count, active, patch) =>
    `<a class="opt" href="${href(patch)}" aria-pressed="${active}" role="button"><span>${esc(label)}</span><span class="n">${count}</span></a>`;

  const topicCount = (t) => inColl.filter((p) => p.topics.includes(t)).length;
  const known = new Set(TOPIC_FAMILIES.flatMap(([, ts]) => ts));
  const more = [...new Set(inColl.flatMap((p) => p.topics))].filter((t) => !known.has(t));
  const families = [...TOPIC_FAMILIES, ...(more.length ? [["More", more]] : [])].map(([fam, ts]) => {
    const present = ts.filter((t) => topicCount(t) > 0);
    if (!present.length) return "";
    const total = inColl.filter((p) => p.topics.some((t) => ts.includes(t))).length;
    return `<details${present.includes(f.topic) ? " open" : ""}><summary><span>${esc(fam)}</span><span class="n small muted">${total}</span></summary>
      ${present.map((t) => opt(t, topicCount(t), f.topic === t, { topic: f.topic === t ? "" : t })).join("")}</details>`;
  }).join("");

  const rail = `<aside class="rail" id="rail" aria-label="Filters">
    <div><h4>Collection</h4>
      ${opt("All problems", catalog.problems.length, !f.c, { c: "", topic: "" })}
      ${catalog.collections.map((c) => opt(c.title, c.count, f.c === c.id, { c: f.c === c.id ? "" : c.id, topic: "" })).join("")}</div>
    <div><h4>Difficulty</h4>${DIFFS.map((d) => opt(d, inColl.filter((p) => p.difficulty === d).length, f.d === d, { d: f.d === d ? "" : d })).join("")}</div>
    <div><h4>Status</h4>${STATUS.map(([k, l]) => opt(l, inColl.filter((p) => state.status(p.key) === k).length, f.s === k, { s: f.s === k ? "" : k })).join("")}</div>
    <div><h4>Topic</h4>${families}</div>
  </aside>`;

  const chips = [
    f.c && [catalog.collectionById(f.c)?.title || f.c, { c: "", topic: "" }],
    f.topic && [f.topic, { topic: "" }], f.d && [f.d, { d: "" }],
    f.s && [STATUS.find(([k]) => k === f.s)?.[1], { s: "" }], f.q && [`“${f.q}”`, { q: "" }],
  ].filter(Boolean);

  const rows = list.map((p) => `<a class="plist-row" href="${problemHref(p.key)}">
      ${statusIcon(p.key)}
      <span style="min-width:0"><span class="t">${esc(p.title)}</span><span class="s">${esc(catalog.collectionById(p.c).title)} · ${esc(p.id)}</span></span>
      <span class="tags">${p.topics.slice(0, 2).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}${p.topics.length > 2 ? `<span class="chip">+${p.topics.length - 2}</span>` : ""}</span>
      <span class="d">${diffPill(p.difficulty)}</span></a>`).join("");

  const title = f.c ? catalog.collectionById(f.c)?.title || "Problems" : f.topic || "Problems";
  const coll = f.c && catalog.collectionById(f.c);
  const html = `<div class="page">
    <div class="eyebrow">${f.c && f.topic ? esc(f.topic) : "Problems"}</div>
    <h1 class="page-title">${esc(title)}</h1>
    ${coll ? `<p class="lede">${esc((coll.description_md || "").replace(/[*`]/g, ""))}${coll.kind === "shared" ? ` <a href="#/data/${coll.id}">See the dataset →</a>` : ""}</p>` : ""}
    <div class="lib">
      ${rail}
      <div style="min-width:0">
        <div class="lib-head">
          <button class="btn filter-toggle" id="filterToggle" aria-controls="rail" aria-expanded="false">${ICON.filter} Filters</button>
          <input class="filter-input" id="libFilter" type="search" placeholder="Filter by title or topic" value="${esc(f.q)}" aria-label="Filter problems">
          <span class="muted small grow" style="text-align:right">${plural(list.length, "problem")}</span>
        </div>
        ${chips.length ? `<div class="active-filters">${chips.map(([l, patch]) => `<a class="chip" href="${href(patch)}" aria-label="Remove filter ${esc(l)}">${esc(l)} ${ICON.x}</a>`).join("")}<a class="small" href="#/problems" style="align-self:center">Clear all</a></div>` : ""}
        <div class="card plist">
          <div class="plist-head"><span></span><span>Title</span><span class="tags">Topics</span><span style="text-align:right">Difficulty</span></div>
          ${rows || `<div class="empty-state"><b>No problems match</b><a href="#/problems">Clear filters</a></div>`}
        </div>
      </div>
    </div></div>`;

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
      return () => clearTimeout(t);
    },
    keepScroll: !!f.q,
  };
}
