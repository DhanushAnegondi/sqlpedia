// Problem article: statement, schema, input data, expected output, hints, practice, solutions.

import { esc, md, mdInline, wikitable, codeBlock, fmtStamp, plural, toast } from "../util.js";
import { problemHref, setHref, tagHref, tierHref, groupNoun } from "../data.js";
import * as state from "../state.js";
import { heading, statusPill, catlinks, setNavbox, problemCats } from "./parts.js";

const ICON_INFO = `<svg class="ambox-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#36c"/><path d="M9 8h2v7H9zM9 5h2v2H9z" fill="#fff"/></svg>`;
const ICON_WARN = `<svg class="ambox-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l9.5 17H.5z" fill="#f28500"/><path d="M9 7h2v5H9zM9 13.5h2v2H9z" fill="#fff"/></svg>`;
const ICON_STOP = `<svg class="ambox-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#d33"/><path d="M6 6l8 8M14 6l-8 8" stroke="#fff" stroke-width="2"/></svg>`;
const ICON_OK = `<svg class="ambox-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#14866d"/><path d="M5.5 10.5l3 3 6-7" stroke="#fff" stroke-width="2" fill="none"/></svg>`;

export function renderProblem(data, setId, slug, tab) {
  const p = data.problem(setId, slug);
  if (!p) return {
    title: "Problem not found",
    html: `<h1 id="firstHeading">Problem not found</h1><div class="ambox content"><div>No problem <code>${esc(slug)}</code> in set <code>${esc(setId)}</code>. See <a href="#/all">All problems</a>.</div></div>`,
  };
  const set = data.setById(setId);
  const titlebar = `
    <ul class="vector-tabs" aria-label="Namespaces">
      <li class="${tab !== "solutions" ? "selected" : ""}"><a href="${problemHref(p)}">Problem</a></li>
      <li class="${tab === "solutions" ? "selected" : ""}"><a href="${problemHref(p, "solutions")}">Solutions</a></li>
    </ul>
    <ul class="vector-tabs" aria-label="Views">
      <li class="${tab !== "history" ? "selected" : ""}"><a href="${problemHref(p, tab === "solutions" ? "solutions" : "")}">Read</a></li>
      <li class="${tab === "history" ? "selected" : ""}"><a href="${problemHref(p, "history")}">View history</a></li>
    </ul>`;

  const head = `<h1 id="firstHeading">${esc(p.title)}</h1>
    <div class="siteSub">From SQLpedia · <a href="${setHref(set)}">${esc(set.title)}</a>, <a href="${tierHref(set.id, p.tier)}">${esc(p.group)}</a> · Problem ${esc(p.id)}</div>`;

  const tools = `<h3>Tools</h3><ul>
      <li><button type="button" class="linklike" data-copy-text="${esc(set.setup_sql)}">Copy setup.sql</button></li>
      <li><a href="${setHref(set)}">Dataset and schema</a></li>
      <li><a href="${problemHref(p, "solutions")}">Solutions</a></li>
      <li><a href="${problemHref(p, "history")}">Your history</a></li>
      <li><a href="#/random">Random problem</a></li></ul>`;

  if (tab === "history") return { title: `${p.title}: history`, titlebar, tools, html: head + historyHtml(p), toc: false, after: (root) => bind(root, data, p) };
  if (tab === "solutions") return {
    title: `${p.title}: solutions`, titlebar, tools,
    html: head + `<div id="solutionsWrap">${solutionsHtml(p, 2)}</div>` + setNavbox(data, set, p),
    after: (root) => bind(root, data, p),
  };

  const html = head +
    hatnote(set) +
    `<div id="statusBanner">${statusBanner(p)}</div>` +
    `<div class="lead">${md(p.statement_md)}</div>` +
    infobox(p, set) +
    (p.dialect_note_md ? `<div class="ambox content">${ICON_WARN}<div><span class="ambox-title">MySQL note.</span> ${mdInline(p.dialect_note_md)}</div></div>` : "") +
    schemaHtml(p, set) +
    inputHtml(p, set) +
    expectedHtml(p) +
    hintsHtml(p) +
    heading(2, "practice", "Your practice") +
    `<div id="practiceBar">${practiceBar(p)}</div>` +
    heading(2, "solutions", "Solutions") +
    `<div id="solutionsWrap">${solutionsHtml(p, 3)}</div>` +
    seeAlso(data, p) +
    setNavbox(data, set, p) +
    catlinks(problemCats(p, data));

  return { title: p.title, titlebar, tools, html, after: (root) => bind(root, data, p) };
}

// ------------------------------------------------------------ sections

function hatnote(set) {
  return `<div class="hatnote">This problem uses the <a href="${setHref(set)}">${esc(set.title)} dataset</a>. Conventions: ${mdInline(set.conventions_md)}` +
    `<button type="button" class="mw-btn small" data-copy-text="${esc(set.setup_sql)}">Copy setup.sql</button></div>`;
}

function statusBanner(p) {
  const e = state.get(p.key);
  if (e.status !== "solved") return "";
  const times = e.history.filter((h) => h.action !== "attempted").length;
  return `<div class="ambox success">${ICON_OK}<div>You completed this problem on <b>${fmtStamp(e.completed_at)}</b>` +
    (times > 1 ? ` and have practised it ${plural(times, "time")}` : "") + `. <a href="${problemHref(p, "history")}">View history</a>.</div></div>`;
}

function infobox(p, set) {
  const s = state.status(p.key);
  const rows = [
    ["Set", `<a href="${setHref(set)}">${esc(set.title)}</a>`],
    [groupNoun(set), set.group_kind === "Topic" ? `<a href="${tierHref(set.id, p.tier)}">${esc(p.tier_title)}</a>` : `<a href="${tierHref(set.id, p.tier)}">${esc(p.tier)}</a> — ${esc(p.tier_title)}`],
    ["Problem", esc(p.id)],
    ["LeetCode", p.lc_ref ? `≈ LC ${esc(p.lc_ref)}` : "—"],
    ["Tables", p.tables_used.map((t) => `<a href="${setHref(set)}#t-${t}"><code>${esc(t)}</code></a>`).join(", ") || "—"],
    ["Topics", p.tags.map((t) => `<a href="${tagHref(t)}">${esc(t)}</a>`).join(", ") || "—"],
    ["Parts", p.parts.length > 1 ? p.parts.map((x) => `(${esc(x.label)})`).join(" ") : "1"],
    ["Status", `<span id="infoStatus">${statusPill(s)}</span>`],
  ];
  const essential = set.essentials.includes(p.id)
    ? `<tr><td colspan="2" class="infobox-subheader">Essential — one of the “do these first” ${set.essentials.length}</td></tr>` : "";
  return `<table class="infobox"><caption>${esc(p.title)}</caption>
    <tr><td colspan="2" class="infobox-image">${probIcon(p)}<div class="infobox-caption">${esc(set.title)} · ${esc(p.id)}</div></td></tr>
    ${essential}
    ${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}</table>`;
}

function probIcon(p) {
  return `<svg width="120" height="78" viewBox="0 0 120 78" aria-hidden="true" style="color:var(--c-subtle)">
    <rect x="1" y="1" width="118" height="76" fill="var(--bg-page)" stroke="var(--border-base)"/>
    <rect x="1" y="1" width="118" height="16" fill="var(--bg-interactive)" stroke="var(--border-base)"/>
    ${[0, 1, 2, 3].map((i) => `<line x1="1" x2="119" y1="${17 + (i + 1) * 15}" y2="${17 + (i + 1) * 15}" stroke="var(--border-faint)"/>`).join("")}
    <line x1="40" x2="40" y1="1" y2="77" stroke="var(--border-faint)"/><line x1="80" x2="80" y1="1" y2="77" stroke="var(--border-faint)"/>
    <text x="60" y="54" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="currentColor">${esc(p.id)}</text></svg>`;
}

function schemaHtml(p, set) {
  const tables = set.tables.filter((t) => p.tables_used.includes(t.name));
  const body = tables.map((t) => {
    const rows = t.columns.map((c) => [
      `<code>${esc(c.name)}</code>`,
      `<span class="mono">${esc(c.type)}</span>`,
      [c.pk ? `<span class="key-badge" title="Primary key">PK</span>` : "",
       c.fk ? `<span class="key-badge" title="Foreign key">FK</span> → <code>${esc(c.fk)}</code>` : ""].join(" ").trim() || "",
      c.nullable ? "yes" : "no",
      c.note ? esc(c.note) : "",
    ]);
    return `<div class="table-scroll"><table class="wikitable"><caption><code>${esc(t.name)}</code> <span style="font-weight:normal;color:var(--c-subtle)">· ${plural(t.rows.length, "row")}</span></caption>
      <thead><tr><th>Column</th><th>Type</th><th>Key</th><th>Nullable</th><th>Note</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }).join("");
  return heading(2, "schema", "Schema") +
    `<p>The query reads ${tables.length === 1 ? "one table" : `${tables.length} tables`}. The full diagram is on the <a href="${setHref(set)}#er">dataset page</a>.</p>` + body;
}

function inputHtml(p, set) {
  const tables = set.tables.filter((t) => p.tables_used.includes(t.name));
  return heading(2, "input", "Input data") +
    `<p>Rows exactly as loaded by <code>setup.sql</code>. <span class="null" style="padding:0 4px;background:var(--bg-null);font-style:italic;color:var(--c-subtle)">NULL</span> cells are real SQL NULLs.</p>` +
    tables.map((t) => `<details class="mw-collapsible"${t.rows.length <= 15 ? " open" : ""}>
      <summary><span><code>${esc(t.name)}</code> <span class="sub">${plural(t.rows.length, "row")}</span></span><span class="toggle" aria-hidden="true"></span></summary>
      <div class="body">${wikitable(t.columns.map((c) => c.name), t.rows)}</div></details>`).join("");
}

function expectedHtml(p) {
  const multi = p.parts.length > 1;
  return heading(2, "expected", "Expected output") +
    p.parts.map((part) => {
      const h = multi ? heading(3, `expected-${part.label}`, `Part (${part.label})`) : "";
      const t = part.expected
        ? wikitable(part.expected.columns, part.expected.rows, { caption: `<span style="font-weight:normal;color:var(--c-subtle)">${plural(part.expected.rows.length, "row")}</span>` })
        : "";
      return h + (part.intro_md ? md(part.intro_md) : "") + t + (part.note_md ? md(part.note_md) : "");
    }).join("");
}

function hintsHtml(p) {
  if (!p.hints_md.length) return "";
  return heading(2, "hints", "Hints") +
    p.hints_md.map((h, i) => `<details class="mw-collapsible"><summary><span>Hint${p.hints_md.length > 1 ? " " + (i + 1) : ""}</span><span class="toggle" aria-hidden="true"></span></summary><div class="body">${md(h)}</div></details>`).join("");
}

function practiceBar(p) {
  const e = state.get(p.key);
  const s = e.status || "new";
  const done = e.history.filter((h) => h.action !== "attempted").length;
  const meta = s === "solved"
    ? `Completed ${fmtStamp(e.completed_at)}${done > 1 ? ` · practised ${plural(done, "time")}` : ""}`
    : s === "attempted" ? `Attempted ${plural(e.history.length, "time")}` : "Write your query in MySQL Workbench, then log it here.";
  return `<div class="practice-bar">
    <div class="status-line">${statusPill(s)}<span style="color:var(--c-subtle);font-size:.8125rem">${meta}</span></div>
    <div class="actions">
      <button type="button" class="mw-btn progressive" data-action="open-complete">${s === "solved" ? "Practised again today" : "Mark as completed"}</button>
      ${s !== "solved" ? `<button type="button" class="mw-btn" data-action="attempt">Mark as attempted</button>` : ""}
      ${e.history.length ? `<button type="button" class="mw-btn quiet" data-action="undo">Undo last</button>` : ""}
    </div>
    <form class="complete-form" id="completeForm" hidden>
      <label for="answerSql">Your query <span style="font-weight:normal;color:var(--c-subtle)">(optional — paste it from Workbench)</span></label>
      <textarea id="answerSql" spellcheck="false">${esc(e.answer_sql || "")}</textarea>
      <label for="answerNote">Note <span style="font-weight:normal;color:var(--c-subtle)">(optional)</span></label>
      <input type="text" id="answerNote" value="${esc(e.note || "")}" placeholder="e.g. forgot DISTINCT the first time">
      <div class="actions"><button type="submit" class="mw-btn progressive">Save</button><button type="button" class="mw-btn quiet" data-action="cancel-complete">Cancel</button></div>
    </form>
    ${e.answer_sql ? `<details class="mw-collapsible" style="margin-bottom:0"><summary><span>Your saved query</span><span class="toggle" aria-hidden="true"></span></summary><div class="body">${codeBlock(e.answer_sql)}${e.note ? `<p><i>${esc(e.note)}</i></p>` : ""}</div></details>` : ""}
  </div>`;
}

function approachTitle(a, i, total) {
  if (a.label === "Correct" || !a.label) return total > 1 ? `Solution ${i + 1}` : "Solution";
  return a.label;
}

export function solutionsHtml(p, level) {
  const e = state.get(p.key);
  if (!e.revealed) {
    return `<div class="ambox notice">${ICON_INFO}<div><p><span class="ambox-title">Solutions are hidden.</span> Try the problem in MySQL Workbench first, then compare with the expected output above.</p>
      <p><button type="button" class="mw-btn" data-action="reveal">Reveal solutions</button></p></div></div>`;
  }
  const multi = p.solutions.length > 1;
  const h = (lvl, id, text) => heading(Math.min(lvl, 4), id, text);
  let out = `<p style="font-size:.8125rem;color:var(--c-subtle)">MySQL 8.0 · <button type="button" class="linklike" data-action="hide">Hide solutions</button></p>`;
  for (const s of p.solutions) {
    const base = multi ? level + 1 : level;
    if (multi) out += h(level, `sol-${s.part}`, `Part (${s.part})`);
    if (s.intro_md) out += md(s.intro_md);
    s.mysql.forEach((a, i) => {
      out += h(base, `sol-${s.part || "x"}-${i}`, approachTitle(a, i, s.mysql.length));
      if (a.comment_md) out += md(a.comment_md);
      out += codeBlock(a.sql);
    });
    for (const t of s.traps) {
      out += `<div class="ambox speedy">${ICON_STOP}<div><span class="ambox-title">Common wrong answer.</span> ${mdInline(t.comment_md)}${codeBlock(t.sql)}</div></div>`;
    }
    if (s.postgres_original) out += `<details class="mw-collapsible"><summary><span>PostgreSQL original <span class="sub">from the source pack</span></span><span class="toggle" aria-hidden="true"></span></summary><div class="body">${codeBlock(s.postgres_original)}</div></details>`;
  }
  return out;
}

function seeAlso(data, p) {
  const scored = data.problems.filter((q) => q.key !== p.key)
    .map((q) => ({ q, n: q.tags.filter((t) => p.tags.includes(t)).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.q.number - b.q.number).slice(0, 5);
  if (!scored.length) return "";
  return heading(2, "see-also", "See also") +
    `<ul>${scored.map(({ q }) => `<li><a href="${problemHref(q)}">${esc(q.title)}</a> <span style="color:var(--c-subtle)">(${esc(q.id)}) — ${esc(q.tags.filter((t) => p.tags.includes(t)).join(", "))}</span></li>`).join("")}</ul>`;
}

function historyHtml(p) {
  const e = state.get(p.key);
  const items = [...e.history].reverse();
  const verb = { completed: "Completed", practiced: "Practised again", attempted: "Attempted" };
  return `<p>Your practice log for this problem, newest first. Current status: ${statusPill(e.status || "new")}</p>` +
    (items.length
      ? `<ul class="mw-history">${items.map((h) => `<li><span class="date">${fmtStamp(h.at)}</span><span class="sep">. .</span>${verb[h.action] || esc(h.action)}${h.note ? ` <span class="comment">(${esc(h.note)})</span>` : ""}</li>`).join("")}</ul>`
      : `<div class="ambox notice">${ICON_INFO}<div>No practice logged yet. <a href="${problemHref(p)}#practice">Open the problem</a> and mark it attempted or completed.</div></div>`) +
    (e.answer_sql ? heading(2, "saved", "Your saved query") + codeBlock(e.answer_sql) + (e.note ? `<p><i>${esc(e.note)}</i></p>` : "") : "") +
    (items.length ? `<p><button type="button" class="mw-btn quiet" data-action="undo">Undo last entry</button></p>` : "");
}

// ------------------------------------------------------------ interaction

function bind(root, data, p) {
  const rerender = () => {
    const bar = root.querySelector("#practiceBar");
    if (bar) bar.innerHTML = practiceBar(p);
    const st = root.querySelector("#infoStatus");
    if (st) st.innerHTML = statusPill(state.status(p.key));
    const banner = root.querySelector("#statusBanner");
    if (banner) banner.innerHTML = statusBanner(p);
    const sol = root.querySelector("#solutionsWrap");
    if (sol) sol.innerHTML = solutionsHtml(p, root.querySelector("#practiceBar") ? 3 : 2);
    if (!bar && !sol) window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const onClick = (ev) => {
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    const act = btn.dataset.action;
    const form = root.querySelector("#completeForm");
    if (act === "open-complete") { form.hidden = false; form.querySelector("textarea").focus(); }
    else if (act === "cancel-complete") form.hidden = true;
    else if (act === "attempt") { state.attempt(p.key); toast(`Logged an attempt at ${p.id}.`); rerender(); }
    else if (act === "undo") { state.undo(p.key); toast("Last entry undone."); rerender(); }
    else if (act === "reveal") {
      if (window.confirm(`Reveal the solutions for ${p.id}? Try it in Workbench first if you haven't.`)) { state.setRevealed(p.key, true); rerender(); }
    } else if (act === "hide") { state.setRevealed(p.key, false); rerender(); }
  };
  const onSubmit = (ev) => {
    if (ev.target.id !== "completeForm") return;
    ev.preventDefault();
    const again = state.status(p.key) === "solved";
    state.complete(p.key, { answer_sql: root.querySelector("#answerSql").value.trim(), note: root.querySelector("#answerNote").value.trim() });
    toast(again ? `Logged another practice of ${p.id}.` : `${p.id} marked as completed.`);
    rerender();
  };
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  return () => { root.removeEventListener("click", onClick); root.removeEventListener("submit", onSubmit); };
}
