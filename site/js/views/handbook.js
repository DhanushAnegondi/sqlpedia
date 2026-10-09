// Handbook: index, topic pages with runnable examples (MySQL / SQL Server switch), shared dataset page.

import { esc, md, mdInline, codeBlock, dataTable, ICON, plural } from "../util.js";
import { loadPage, loadDataset, pageHref } from "../data.js";
import { tablesToSql } from "../engine/fixtures.js";
import { runSql } from "../engine/duck.js";
import { NOTES } from "../engine/translate.js";
import { createEditor } from "../ui/editor.js";
import { resultHtml } from "./common.js";

const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const DIALECT_LABEL = { mysql: "MySQL 8.0", tsql: "SQL Server" };

function navHtml(catalog, currentId) {
  const groups = [...new Set(catalog.handbook.map((h) => h.group))];
  return groups.map((g) => `<h4>${esc(g)}</h4>` + catalog.handbook.filter((h) => h.group === g)
    .map((h) => `<a href="${pageHref(h.id)}"${h.id === currentId ? ' aria-current="page"' : ""}>${esc(h.title)}</a>`).join("")).join("") +
    `<h4>Reference</h4><a href="#/handbook/dataset"${currentId === "dataset" ? ' aria-current="page"' : ""}>Example tables</a>`;
}

export function renderHandbookIndex(catalog) {
  const groups = [...new Set(catalog.handbook.map((h) => h.group))];
  const html = `<div class="page">
    <div class="eyebrow">Handbook</div>
    <h1 class="page-title">SQL handbook</h1>
    <p class="lede">Syntax with every argument explained, the gotchas interviewers probe, and examples you can edit and run — in MySQL or SQL Server. Outputs were verified on MySQL 8.0.</p>
    ${groups.map((g) => `<h2 class="section-title">${esc(g)}</h2><div class="grid g3">` +
      catalog.handbook.filter((h) => h.group === g).map((h) => `<a class="card card-pad coll-card" href="${pageHref(h.id)}"><span class="name">${esc(h.title)}</span><span class="desc">${mdInline(h.summary_md || "")}</span><span class="small muted">${plural(h.sections.length, "section")}</span></a>`).join("") +
      `</div>`).join("")}
    <h2 class="section-title">Reference</h2>
    <div class="grid g3"><a class="card card-pad coll-card" href="#/handbook/dataset"><span class="name">Example tables</span><span class="desc">The small shared tables most examples run against — with the planted NULLs, ties and gaps.</span></a></div>
  </div>`;
  return { title: "Handbook", html };
}

export async function renderHandbookDataset(catalog) {
  const ds = await loadDataset();
  const sqlId = codeBlock(tablesToSql(ds.tables), { label: "Copy setup SQL" });
  const html = `<div class="hb">
    <nav class="hb-nav" id="hbNav" aria-label="Handbook pages">${navHtml(catalog, "dataset")}</nav>
    <article class="article">
      <div class="crumbs"><a href="#/handbook">Handbook</a> / Reference</div>
      <h1>Example tables</h1>
      <div class="summary">${md(ds.description_md)}</div>
      ${ds.tables.map((t) => `<h2 id="t-${t.name}">${esc(t.name)}</h2><div class="body">${md(t.description_md)}</div>
        ${dataTable(t.columns.map((c) => `${c.name} ${c.type}`), t.rows, { tall: true })}`).join("")}
      <h2 id="setup">Setup SQL</h2><p class="muted">Paste into MySQL Workbench to get the same tables locally.</p>${sqlId}
    </article><div></div></div>`;
  return { title: "Example tables", html };
}

export async function renderHandbookPage(catalog, id) {
  const page = await loadPage(id).catch(() => null);
  if (!page) return null;
  const ds = await loadDataset();
  const datasetSql = tablesToSql(ds.tables);
  const dsNames = ds.tables.map((t) => t.name);
  let dialect = lsGet("sqlpedia.hbdialect", "mysql") === "tsql" ? "tsql" : "mysql";
  const order = catalog.handbook.findIndex((h) => h.id === id);
  const prev = catalog.handbook[order - 1], next = catalog.handbook[order + 1];

  const exampleHtml = (ex, key) => {
    const sql = dialect === "tsql" ? ex.tsql : ex.mysql;
    const uses = ex.uses_dataset ? dsNames.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(ex.mysql || "")) : (ex.tables || []).map((t) => t.name);
    return `<div class="example" data-ex="${key}">
      <div class="example-head"><span class="t">${esc(ex.title || "Example")}</span><span class="grow"></span>
        ${uses.length ? `<span class="uses">${ex.uses_dataset ? `<a href="#/handbook/dataset">${uses.map(esc).join(", ")}</a>` : uses.map(esc).join(", ")}</span>` : ""}</div>
      ${ex.explain_md ? `<div class="example-explain">${md(ex.explain_md)}</div>` : ""}
      ${sql === null || sql === undefined ? `<div class="callout warn" style="margin:10px 14px">Not available in SQL Server. ${ex.dialect_note_md ? mdInline(ex.dialect_note_md) : ""} Showing the MySQL version.</div>` : ""}
      <div class="ex-editor"></div>
      <div class="example-out">
        <div class="row" style="margin-bottom:6px">
          <button class="btn sm" data-run="${key}">${ICON.play} Run</button>
          <button class="btn ghost sm" data-reset="${key}">${ICON.reset} Reset</button>
          ${ex.tables && ex.tables.length && !ex.uses_dataset ? `<button class="btn ghost sm" data-showtables="${key}">Show input tables</button>` : ""}
          <span class="grow"></span><span class="small muted" data-meta="${key}"></span>
        </div>
        <div class="ex-tables" hidden>${(ex.tables || []).map((t) => `<div class="tbl-caption"><span class="name">${esc(t.name)}</span></div>${dataTable(t.columns.map((c) => c.name), t.rows)}`).join("")}</div>
        <div class="out-label">Output <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400" data-label="${key}">verified on MySQL 8.0</span></div>
        <div data-out="${key}">${ex.expected ? dataTable(ex.expected.columns, ex.expected.rows, { tall: true }) : `<span class="muted small">Run to see the output.</span>`}</div>
        ${ex.dialect_note_md && sql !== null && sql !== undefined ? `<div class="callout warn small">${mdInline(ex.dialect_note_md)}</div>` : ""}
      </div></div>`;
  };

  const sectionHtml = (s, si) => {
    const syn = s.syntax ? (s.syntax[dialect] ?? null) : null;
    return `<h2 id="${esc(s.id)}">${esc(s.heading)}</h2>
      ${s.body_md ? `<div class="body">${md(s.body_md)}</div>` : ""}
      ${s.syntax ? `<div class="syntax"><div class="label">Syntax · ${DIALECT_LABEL[dialect]}</div>${syn ? codeBlock(syn) : `<div class="callout warn small">No SQL Server equivalent.</div>`}</div>` : ""}
      ${s.args && s.args.length ? `<table class="args"><thead><tr><th>Argument</th><th>Meaning</th></tr></thead><tbody>${s.args.map((a) => `<tr><td>${esc(a.name)}</td><td>${mdInline(a.meaning)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${(s.examples || []).map((ex, ei) => exampleHtml(ex, `${si}-${ei}`)).join("")}
      ${s.pitfalls_md && s.pitfalls_md.length ? `<div class="callout warn pitfalls"><span class="title">Pitfalls</span><ul>${s.pitfalls_md.map((x) => `<li>${mdInline(x)}</li>`).join("")}</ul></div>` : ""}`;
  };

  const articleHtml = () => `
    <div class="crumbs"><a href="#/handbook">Handbook</a> / ${esc(page.group)}</div>
    <h1>${esc(page.title)}</h1>
    <div class="dialect-bar"><span class="small muted">Dialect</span>
      <div class="seg" role="group" aria-label="SQL dialect">${["mysql", "tsql"].map((d) => `<button type="button" data-dialect="${d}" aria-pressed="${d === dialect}">${DIALECT_LABEL[d]}</button>`).join("")}</div>
      <span class="grow"></span><button class="btn ghost sm filter-toggle" id="pagesBtn" aria-controls="hbNav" aria-expanded="false">${ICON.menu} Pages</button></div>
    ${page.summary_md ? `<div class="summary">${md(page.summary_md)}</div>` : ""}
    ${page.sections.map(sectionHtml).join("")}
    <hr><div class="row">${prev ? `<a class="btn ghost" href="${pageHref(prev.id)}">${ICON.left} ${esc(prev.title)}</a>` : ""}<span class="grow"></span>${next ? `<a class="btn ghost" href="${pageHref(next.id)}">${esc(next.title)} ${ICON.right}</a>` : ""}</div>`;

  const html = `<div class="hb">
    <nav class="hb-nav" id="hbNav" aria-label="Handbook pages">${navHtml(catalog, id)}</nav>
    <article class="article" id="article">${articleHtml()}</article>
    <aside class="hb-toc" aria-label="On this page"><h4>On this page</h4>${page.sections.map((s) => `<a href="#/handbook/${id}#${esc(s.id)}" data-toc="${esc(s.id)}">${esc(s.heading)}</a>`).join("")}</aside>
  </div>`;

  return {
    title: page.title,
    html,
    mount(root, { anchor }) {
      const art = root.querySelector("#article");
      const editors = new Map();
      const exByKey = (k) => { const [si, ei] = k.split("-").map(Number); return page.sections[si].examples[ei]; };
      const sqlOf = (ex) => (dialect === "tsql" && ex.tsql ? ex.tsql : ex.mysql);
      const dialectOf = (ex) => (dialect === "tsql" && ex.tsql ? "tsql" : "mysql");

      const mountEditors = () => {
        editors.clear();
        art.querySelectorAll(".example").forEach((el) => {
          const k = el.dataset.ex, ex = exByKey(k);
          editors.set(k, createEditor(el.querySelector(".ex-editor"), { value: sqlOf(ex), autoHeight: true, onRun: () => run(k), label: `${ex.title} SQL` }));
        });
      };
      async function run(k) {
        const ex = exByKey(k), ed = editors.get(k);
        const outEl = art.querySelector(`[data-out="${k}"]`), meta = art.querySelector(`[data-meta="${k}"]`), label = art.querySelector(`[data-label="${k}"]`);
        if (!ex || !ed || !outEl) return;
        outEl.innerHTML = `<div class="row muted small"><span class="spinner"></span> Running…</div>`;
        const d = dialectOf(ex);
        const res = await runSql({ setup: ex.uses_dataset ? datasetSql : tablesToSql(ex.tables || []), sql: ed.value, dialect: d });
        if (!outEl.isConnected) return; // the dialect was switched while this ran
        label.textContent = `your run · ${DIALECT_LABEL[d]}${d === "tsql" ? " (emulated)" : ""}`;
        meta.textContent = res.ok ? `${res.ms} ms` : "";
        outEl.innerHTML = resultHtml(res) + (d === "tsql" && res.ok ? `<div class="engine-note" style="margin-top:6px">${esc(NOTES.tsql)}</div>` : "");
      }
      art.addEventListener("click", (e) => {
        const r = e.target.closest("[data-run]"), z = e.target.closest("[data-reset]"), d = e.target.closest("[data-dialect]"), st = e.target.closest("[data-showtables]");
        if (r) run(r.dataset.run);
        else if (z) {
          const k = z.dataset.reset, ex = exByKey(k);
          editors.get(k).value = sqlOf(ex);
          art.querySelector(`[data-out="${k}"]`).innerHTML = ex.expected ? dataTable(ex.expected.columns, ex.expected.rows, { tall: true }) : "";
          art.querySelector(`[data-label="${k}"]`).textContent = "verified on MySQL 8.0";
          art.querySelector(`[data-meta="${k}"]`).textContent = "";
        } else if (st) {
          const box = st.closest(".example").querySelector(".ex-tables");
          box.hidden = !box.hidden;
          st.textContent = box.hidden ? "Show input tables" : "Hide input tables";
        } else if (d && d.dataset.dialect !== dialect) {
          dialect = d.dataset.dialect;
          lsSet("sqlpedia.hbdialect", dialect);
          const y = window.scrollY;
          art.innerHTML = articleHtml();
          mountEditors();
          observe();
          window.scrollTo(0, y);
        } else if (e.target.closest("#pagesBtn")) {
          const nav = root.querySelector("#hbNav");
          e.target.closest("#pagesBtn").setAttribute("aria-expanded", String(nav.classList.toggle("open")));
        }
      });
      mountEditors();

      // TOC scroll spy + same-page anchors
      const links = [...root.querySelectorAll("[data-toc]")];
      root.querySelector(".hb-toc").addEventListener("click", (e) => {
        const a = e.target.closest("[data-toc]");
        if (!a) return;
        e.preventDefault();
        document.getElementById(a.dataset.toc)?.scrollIntoView();
        history.replaceState(null, "", a.getAttribute("href"));
      });
      const spy = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.dataset.toc === en.target.id));
      }, { rootMargin: "-120px 0px -70% 0px" });
      function observe() { spy.disconnect(); page.sections.forEach((s) => { const h = document.getElementById(s.id); if (h) spy.observe(h); }); }
      observe();
      return () => spy.disconnect();
    },
    keepScroll: false,
  };
}
