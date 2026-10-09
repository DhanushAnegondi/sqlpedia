// Progress: stats, activity heatmap, per-collection progress, recent activity, backup.

import { esc, fmtStamp, fmtDay, dayKey, toast } from "../util.js";
import { problemHref } from "../data.js";
import * as state from "../state.js";
import { heatmapHtml, diffPill } from "./common.js";

const VERB = { completed: "Solved", practiced: "Practised again", attempted: "Attempted", accepted: "Accepted", wrong: "Wrong answer" };

export function renderProgress(catalog) {
  const s = state.streaks();
  const solved = catalog.problems.filter((p) => state.status(p.key) === "solved");
  const byDiff = ["Easy", "Medium", "Hard"].map((d) => [d, solved.filter((p) => p.difficulty === d).length, catalog.problems.filter((p) => p.difficulty === d).length]);
  const recent = state.recentHistory(40);

  const html = `<div class="page">
    <div class="eyebrow">Progress</div>
    <h1 class="page-title">Your practice</h1>
    <p class="lede">${s.practicedToday ? "You practised today." : "Nothing logged today yet."} Progress is saved in this browser — export a backup now and then.</p>
    ${state.storageAvailable() ? "" : `<div class="callout bad">Browser storage is unavailable, so progress can't be saved in this window.</div>`}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="stat"><div class="v">${solved.length}<span class="muted" style="font-size:14px"> / ${catalog.problems.length}</span></div><div class="k">Solved</div></div>
      <div class="stat"><div class="v">${s.current}</div><div class="k">Current streak (days)</div></div>
      <div class="stat"><div class="v">${s.longest}</div><div class="k">Longest streak</div></div>
      <div class="stat"><div class="v">${s.activeDays}</div><div class="k">Days practised</div></div>
    </div>
    <div class="card card-pad"><div class="row" style="margin-bottom:8px"><strong>Activity</strong><span class="grow"></span><span class="small muted" id="dayDetail">Click a day for details.</span></div>${heatmapHtml(state.activity())}</div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card card-pad"><strong>By collection</strong>
        ${catalog.collections.map((c) => {
          const n = solved.filter((p) => p.c === c.id).length, pct = Math.round((100 * n) / c.count);
          return `<div style="margin-top:12px"><div class="row small"><a href="#/problems?c=${c.id}">${esc(c.title)}</a><span class="grow"></span><span class="muted">${n} / ${c.count}</span></div><div class="meter"><span style="width:${pct}%"></span></div></div>`;
        }).join("")}
      </div>
      <div class="card card-pad"><strong>By difficulty</strong>
        ${byDiff.map(([d, n, t]) => `<div style="margin-top:12px"><div class="row small">${diffPill(d)}<span class="grow"></span><span class="muted">${n} / ${t}</span></div><div class="meter"><span style="width:${t ? Math.round((100 * n) / t) : 0}%"></span></div></div>`).join("")}
      </div>
    </div>

    <h2 class="section-title">Recent activity</h2>
    <div class="card card-pad">${recent.length ? `<ul class="log">${recent.map((h) => {
      const p = catalog.byKey.get(h.key);
      return `<li><span class="when">${fmtStamp(h.at)}</span><span>${VERB[h.action] || esc(h.action)} ${p ? `<a href="${problemHref(p.key)}">${esc(p.title)}</a> <span class="muted small">${esc(catalog.collectionById(p.c).title)}</span>` : esc(h.key)}</span></li>`;
    }).join("")}</ul>` : `<div class="empty-state"><b>Nothing yet</b>Open a problem, write a query and press Submit.</div>`}</div>

    <h2 class="section-title">Backup</h2>
    <div class="card card-pad row">
      <button class="btn primary" id="exportBtn">Export progress</button>
      <label class="btn" style="cursor:pointer">Import…<input type="file" accept="application/json,.json" id="importInput" class="visually-hidden"></label>
      <span class="small muted">The export is a JSON file you can import on another browser or machine.</span>
    </div>
  </div>`;

  return {
    title: "Progress",
    html,
    mount(root) {
      root.querySelector(".heatmap").addEventListener("click", (e) => {
        const c = e.target.closest("[data-day]");
        if (!c) return;
        const d = state.dayDetail(c.dataset.day);
        const keys = [...new Set([...d.completed, ...d.attempted])];
        root.querySelector("#dayDetail").innerHTML = `<b>${fmtDay(c.dataset.day)}</b>: ${keys.length ? keys.map((k) => { const p = catalog.byKey.get(k); return p ? `<a href="${problemHref(k)}">${esc(p.title)}</a>` : esc(k); }).join(", ") : "no practice"}`;
      });
      root.querySelector("#exportBtn").addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([state.exportJson()], { type: "application/json" }));
        a.download = `sqlpedia-progress-${dayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast("Progress exported.");
      });
      root.querySelector("#importInput").addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const text = await f.text();
        e.target.value = "";
        if (!confirm("Replace your current progress with this file? Export first if unsure.")) return;
        try { state.importJson(text); toast("Progress imported."); window.dispatchEvent(new HashChangeEvent("hashchange")); }
        catch (err) { toast(err.message); }
      });
    },
  };
}
