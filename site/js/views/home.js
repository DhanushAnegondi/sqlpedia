// Home: continue where you left off, stats, collections, the handbook map, recent activity.

import { esc, md, plural } from "../util.js";
import { problemHref, pageHref } from "../data.js";
import * as state from "../state.js";
import { diffPill, heatmapHtml } from "./common.js";

const GROUP_BLURB = {
  "Foundations": "How a query runs, filtering, grouping, joins, sets, CASE, NULLs.",
  "Functions": "Strings, numbers, dates and times — with every argument annotated.",
  "Query structure": "Subqueries, CTEs and recursive CTEs.",
  "Window functions": "Frames, running and rolling totals, ranking, top N, NTILE, LAG/LEAD, YoY.",
  "Patterns": "Dedup, pivots, streaks, sessions, retention, funnels, data-engineering SQL.",
};

function nextUp(catalog) {
  const last = state.lastTouched();
  if (last && last.status !== "solved" && catalog.byKey.get(last.key)) return { p: catalog.byKey.get(last.key), why: "Continue where you left off" };
  const order = ["basics", "patterns", "apple", "campus", "shoplite"];
  for (const c of order) {
    const p = catalog.problems.find((x) => x.c === c && state.status(x.key) !== "solved" && x.difficulty !== "Hard");
    if (p) return { p, why: last ? "Up next" : "Start here" };
  }
  return { p: catalog.problems[0], why: "Review" };
}

export function renderHome(catalog) {
  const s = state.streaks();
  const solved = catalog.problems.filter((p) => state.status(p.key) === "solved").length;
  const { p, why } = nextUp(catalog);
  const groups = [...new Set(catalog.handbook.map((h) => h.group))];

  const html = `<div class="page">
    <section class="hero">
      <div class="card card-pad">
        <div class="eyebrow">SQL interview practice</div>
        <h1>Read it, write it, <span class="serif">run it.</span></h1>
        <p class="lede">${plural(catalog.problems.length, "problem")} with their own tables, an editor that runs MySQL and SQL Server in your browser, and a handbook of runnable examples.</p>
        <div class="stats">
          <div class="stat"><div class="v">${solved}<span class="muted" style="font-size:14px"> / ${catalog.problems.length}</span></div><div class="k">Solved</div></div>
          <div class="stat"><div class="v">${s.current}</div><div class="k">Day streak</div></div>
          <div class="stat"><div class="v">${s.activeDays}</div><div class="k">Days practised</div></div>
        </div>
      </div>
      <div class="card card-pad continue">
        <div class="eyebrow">${esc(why)}</div>
        <a class="title" href="${problemHref(p.key)}">${esc(p.title)}</a>
        <div class="row">${diffPill(p.difficulty)}<span class="chip">${esc(catalog.collectionById(p.c).title)}</span>${p.topics.slice(0, 2).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>
        <div class="row" style="margin-top:auto"><a class="btn primary" href="${problemHref(p.key)}">Open problem</a><a class="btn ghost" href="#/problems">Browse all</a></div>
      </div>
    </section>

    <h2 class="section-title">Problem collections <a href="#/problems">All problems →</a></h2>
    <div class="grid g-coll">
      ${catalog.collections.map((c) => {
        const done = catalog.problems.filter((x) => x.c === c.id && state.status(x.key) === "solved").length;
        const [e, m, h] = c.difficulty;
        return `<a class="card card-pad coll-card" href="#/problems?c=${c.id}">
          <span class="name">${esc(c.title)}</span>
          <span class="desc">${esc((c.description_md || "").replace(/[*`]/g, "").split(". ")[0])}.</span>
          <span class="bar3" title="${e} easy · ${m} medium · ${h} hard"><span style="width:${(100 * e) / c.count}%"></span><span style="width:${(100 * m) / c.count}%"></span><span style="width:${(100 * h) / c.count}%"></span></span>
          <span class="small muted">${c.count} problems · ${done} solved</span></a>`;
      }).join("")}
    </div>

    <h2 class="section-title">Handbook <a href="#/handbook">Open handbook →</a></h2>
    <div class="grid g3">
      ${groups.map((g) => `<div class="card card-pad hb-group"><h3>${esc(g)}</h3><p class="small muted" style="margin:0 0 8px">${esc(GROUP_BLURB[g] || "")}</p><ul>
        ${catalog.handbook.filter((h) => h.group === g).map((h) => `<li><a href="${pageHref(h.id)}">${esc(h.title)}</a></li>`).join("")}</ul></div>`).join("")}
    </div>

    <h2 class="section-title">Activity <a href="#/progress">Progress →</a></h2>
    <div class="card card-pad">${heatmapHtml(state.activity(), 26)}</div>
  </div>`;
  return { title: "", html };
}
