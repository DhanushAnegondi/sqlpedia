// Main Page: welcome banner, featured problem, did you know, in the news, sets, topics.

import { esc, md, mdInline, plural, fmtStamp, dayKey } from "../util.js";
import { problemHref, setHref, tierHref, tagHref, groupLabel } from "../data.js";
import * as state from "../state.js";

function featured(data) {
  // Next unsolved essential, else next unsolved, else a stable daily pick.
  for (const set of data.sets)
    for (const id of set.essentials) {
      const p = data.problems.find((x) => x.set === set.id && x.id === id);
      if (p && state.status(p.key) !== "solved") return { p, why: "essential" };
    }
  const open = data.problems.find((p) => state.status(p.key) !== "solved");
  if (open) return { p: open, why: "next" };
  const n = Number(dayKey().replace(/-/g, "")) % data.problems.length;
  return { p: data.problems[n], why: "review" };
}

export function renderMain(data) {
  const s = state.streaks();
  const solved = data.problems.filter((p) => state.status(p.key) === "solved").length;
  const { p, why } = featured(data);
  const set = data.setById(p.set);
  const recent = state.recentHistory(5);
  const verb = { completed: "completed", practiced: "practised again", attempted: "attempted" };

  const traps = data.sets.flatMap((st) => st.planted_traps.map((t) => ({ st, t })));
  const dyk = traps.slice(0, 6).map(({ st, t }) => `<li>… that the <a href="${setHref(st)}">${esc(st.title)}</a> data contains ${mdInline((/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t).replace(/\.$/, ""))}?</li>`).join("");

  const news = [
    s.current ? `<li>Your practice streak stands at <b>${plural(s.current, "day")}</b>${s.practicedToday ? ", including today" : " — practise today to keep it"}.</li>`
              : `<li>No active streak. <a href="${problemHref(p)}">Solve one problem today</a> to start one.</li>`,
    `<li><b>${solved}</b> of ${plural(data.problems.length, "problem")} completed; longest streak ${plural(s.longest, "day")}.</li>`,
    ...recent.map((h) => { const q = data.byKey(h.key); return q ? `<li>${fmtStamp(h.at)} — you ${verb[h.action] || esc(h.action)} <a href="${problemHref(q)}">${esc(q.title)}</a>.</li>` : ""; }),
  ].join("");

  const sets = data.sets.map((st) => {
    const list = data.problems.filter((x) => x.set === st.id);
    const done = list.filter((x) => state.status(x.key) === "solved").length;
    const tiers = [...new Map(list.map((x) => [x.tier, x.tier_title])).entries()];
    return `<li><a href="${setHref(st)}"><b>${esc(st.title)}</b></a> — ${plural(list.length, "problem")}, ${done} completed. ` +
      tiers.map(([t, title]) => `<a href="${tierHref(st.id, t)}" title="${esc(title)}">${esc(groupLabel(st, t, title))}</a>`).join(" · ") + `</li>`;
  }).join("");

  const html = `<h1 id="firstHeading" class="visually-hidden">Main Page</h1>
    <div class="mp-welcome">
      <h1>Welcome to SQLpedia,</h1>
      <p>the SQL problem encyclopedia — ${plural(data.problems.length, "problem")} in ${plural(data.sets.length, "set")}, solved in MySQL 8.0.</p>
    </div>
    <div class="mp-grid">
      <div>
        <div class="mp-box">
          <h2>Today's featured problem</h2>
          <div class="mp-body">
            <p><b><a href="${problemHref(p)}">${esc(p.title)}</a></b> <span style="color:var(--c-subtle)">(${esc(set.title)} ${esc(p.id)}, ${esc(p.group)}${why === "essential" ? ", essential" : ""})</span></p>
            ${md(p.statement_md)}
            <p>Topics: ${p.tags.map((t) => `<a href="${tagHref(t)}">${esc(t)}</a>`).join(", ")}${p.lc_ref ? ` · similar to LeetCode ${esc(p.lc_ref)}` : ""}</p>
            <p class="mp-more"><a href="${problemHref(p)}">Read and solve…</a> · <a href="#/random">Random problem</a></p>
          </div>
        </div>
        <div class="mp-box">
          <h2>Did you know…</h2>
          <div class="mp-body"><ul>${dyk}</ul><p class="mp-more"><a href="${setHref(set)}#planted">More planted traps…</a></p></div>
        </div>
      </div>
      <div>
        <div class="mp-box blue">
          <h2>In the news</h2>
          <div class="mp-body"><ul>${news}</ul><p class="mp-more"><a href="#/progress">Your progress…</a></p></div>
        </div>
        <div class="mp-box blue">
          <h2>Problem sets</h2>
          <div class="mp-body"><ul>${sets}</ul></div>
        </div>
        <div class="mp-box blue">
          <h2>Topics</h2>
          <div class="mp-body"><p>${data.tags.map((t) => `<a href="${tagHref(t.name)}">${esc(t.name)}</a>&nbsp;(${t.problems.length})`).join(" · ")}</p></div>
        </div>
      </div>
    </div>`;
  return { title: "Main Page", html, toc: false };
}
