// Progress page (Special:MyContributions): heatmap, streaks, per-tier progress, recent log, export/import.

import { esc, dayKey, addDays, fmtDay, fmtStamp, monthShort, plural, toast } from "../util.js";
import { problemHref, tierHref, setHref, groupLabel } from "../data.js";
import * as state from "../state.js";
import { heading } from "./parts.js";

function level(n) { return n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4; }

function heatmap() {
  const act = state.activity();
  const today = new Date();
  // 53 columns ending this week; weeks start on Sunday.
  const end = addDays(today, 6 - today.getDay());
  const start = addDays(end, -(53 * 7) + 1);
  let cells = "", months = "", lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    const colStart = addDays(start, w * 7);
    const m = colStart.getMonth();
    if (m !== lastMonth && colStart.getDate() <= 7) {
      months += `<span class="hm-month" style="grid-column:${w + 1}">${monthShort(m)}</span>`;
      lastMonth = m;
    }
    for (let d = 0; d < 7; d++) {
      const day = addDays(colStart, d);
      const k = dayKey(day);
      const n = act[k] || 0;
      const future = day > today;
      const label = `${fmtDay(k)}: ${n ? plural(n, "problem") : "no practice"}`;
      cells += `<button type="button" class="hm-cell${future ? " future" : ""}${k === dayKey(today) ? " today" : ""}" style="grid-column:${w + 1};grid-row:${d + 2}" data-l="${level(n)}" data-day="${k}" aria-label="${label}" title="${label}"${future ? ' tabindex="-1" aria-hidden="true"' : !n && k !== dayKey(today) ? ' tabindex="-1"' : ""}></button>`;
    }
  }
  const legend = `<div class="hm-legend">Less ${[0, 1, 2, 3, 4].map((l) => `<span class="hm-cell" data-l="${l}" style="background:var(--hm-${l})"></span>`).join("")} More</div>`;
  return `<div class="heatmap-wrap"><div class="heatmap" role="group" aria-label="Practice activity over the last year">${months}${cells}</div></div>${legend}<div class="hm-detail" id="hmDetail" aria-live="polite"></div>`;
}

export function renderProgress(data) {
  const s = state.streaks();
  const solved = data.problems.filter((p) => state.status(p.key) === "solved");
  const attempted = data.problems.filter((p) => state.status(p.key) === "attempted");
  const act = state.activity();
  const thisYear = Object.keys(act).filter((k) => k >= dayKey(addDays(new Date(), -364))).length;

  const stats = `<div class="stat-row">
    <div class="stat"><div class="v">${solved.length}<span style="font-size:.6em;color:var(--c-subtle)"> / ${data.problems.length}</span></div><div class="k">Completed</div></div>
    <div class="stat"><div class="v">${s.current}</div><div class="k">Current streak (days)</div></div>
    <div class="stat"><div class="v">${s.longest}</div><div class="k">Longest streak (days)</div></div>
    <div class="stat"><div class="v">${thisYear}</div><div class="k">Days practised, last 12 months</div></div>
    <div class="stat"><div class="v">${attempted.length}</div><div class="k">Attempted, not completed</div></div></div>`;

  const tierRows = data.sets.flatMap((set) => {
    const tiers = [...new Map(set.problems.map((p) => [p.tier, p.tier_title])).entries()];
    return tiers.map(([t, title]) => {
      const list = data.problems.filter((p) => p.set === set.id && p.tier === t);
      const d = list.filter((p) => state.status(p.key) === "solved").length;
      const pct = Math.round((100 * d) / list.length);
      return `<tr><td><a href="${setHref(set)}">${esc(set.title)}</a></td><td><a href="${tierHref(set.id, t)}">${esc(groupLabel(set, t, title))}</a>${set.group_kind === "Topic" ? "" : ` — ${esc(title)}`}</td><td class="num">${d} / ${list.length}</td><td><span class="meter" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></span> ${pct}%</td></tr>`;
    });
  }).join("");

  const recent = state.recentHistory(40);
  const verb = { completed: "Completed", practiced: "Practised again", attempted: "Attempted" };
  const log = recent.length
    ? `<ul class="mw-history">${recent.map((h) => {
        const p = data.byKey(h.key);
        return `<li><span class="date">${fmtStamp(h.at)}</span><span class="sep">. .</span>${verb[h.action] || esc(h.action)} ${p ? `<a href="${problemHref(p)}">${esc(p.title)}</a> <span style="color:var(--c-subtle)">(${esc(p.id)})</span>` : esc(h.key)}${h.note ? ` <span class="comment">(${esc(h.note)})</span>` : ""}</li>`;
      }).join("")}</ul>`
    : `<div class="ambox notice"><div>Nothing logged yet. Open a problem, solve it in MySQL Workbench, then press <b>Mark as completed</b>. Start with the <a href="#/set/${data.sets[0]?.id}#essentials">essentials</a>.</div></div>`;

  const next = data.problems.filter((p) => state.status(p.key) !== "solved").slice(0, 5);

  const html = `<h1 id="firstHeading">Practice progress</h1>
    <div class="siteSub">${s.practicedToday ? "You practised today." : "No practice logged today yet."}</div>
    ${state.storageAvailable() ? "" : `<div class="ambox speedy"><div>Browser storage is unavailable, so progress can't be saved in this window.</div></div>`}
    ${stats}
    ${heading(2, "activity", "Activity")}
    <p>Each square is a day; darker means more problems completed or attempted that day.</p>
    ${heatmap()}
    ${heading(2, "by-tier", "By section")}
    <div class="table-scroll"><table class="wikitable full"><thead><tr><th>Set</th><th>Section</th><th>Completed</th><th>Progress</th></tr></thead><tbody>${tierRows}</tbody></table></div>
    ${next.length ? `${heading(2, "up-next", "Up next")}<ul>${next.map((p) => `<li><a href="${problemHref(p)}">${esc(p.title)}</a> <span style="color:var(--c-subtle)">(${esc(data.setById(p.set).title)} ${esc(p.id)}, ${esc(p.group)})</span></li>`).join("")}</ul>` : ""}
    ${heading(2, "log", "Recent activity")}
    ${log}
    ${heading(2, "backup", "Backup")}
    <div class="ambox style"><div>Progress lives in this browser's storage. Clearing site data deletes it — export a backup now and then.</div></div>
    <p><button type="button" class="mw-btn progressive" data-action="export">Export progress (JSON)</button>
       <label class="mw-btn" style="cursor:pointer">Import progress…<input type="file" accept="application/json,.json" data-action="import" class="visually-hidden"></label></p>`;

  return {
    title: "Practice progress", html,
    after: (root) => {
      const onClick = (e) => {
        const cell = e.target.closest(".hm-cell[data-day]");
        if (cell) {
          const k = cell.dataset.day;
          const st = (state.activity()[k] || 0);
          const dd = state.dayDetail(k);
          const names = [...new Set([...dd.completed, ...dd.attempted])].map((key) => data.byKey(key)).filter(Boolean);
          root.querySelector("#hmDetail").innerHTML = `<b>${fmtDay(k)}</b>: ${st ? plural(st, "problem") : "no practice"}${names.length ? " — " + names.map((p) => `<a href="${problemHref(p)}">${esc(p.id)}</a>`).join(", ") : ""}`;
          return;
        }
        if (e.target.closest('[data-action="export"]')) {
          const blob = new Blob([state.exportJson()], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `sqlpedia-progress-${dayKey()}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast("Progress exported.");
        }
      };
      const onChange = async (e) => {
        const input = e.target.closest('input[data-action="import"]');
        if (!input || !input.files[0]) return;
        const text = await input.files[0].text();
        input.value = "";
        if (!window.confirm("Replace your current progress with this file? This cannot be undone — export first if unsure.")) return;
        try { state.importJson(text); toast("Progress imported."); window.dispatchEvent(new HashChangeEvent("hashchange")); }
        catch (err) { toast(err.message); }
      };
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
      return () => { root.removeEventListener("click", onClick); root.removeEventListener("change", onChange); };
    },
  };
}
