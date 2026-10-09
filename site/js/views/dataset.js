// Dataset page for collections that share one dataset (ShopLite, Campus).

import { esc, md, mdInline, codeBlock, dataTable } from "../util.js";
import { loadCollection, problemHref } from "../data.js";
import { renderDiagrams } from "../mermaid.js";

export async function renderDataset(catalog, cid) {
  const c = await loadCollection(cid).catch(() => null);
  if (!c || c.kind !== "shared") return null;
  const sh = c.shared;
  const html = `<div class="page narrow">
    <div class="eyebrow"><a href="#/problems?c=${c.id}">${esc(c.title)}</a> · Dataset</div>
    <h1 class="page-title">${esc(c.title)} dataset</h1>
    <div class="lede">${md(c.description_md)}</div>
    ${sh.conventions_md ? `<div class="callout"><span class="title">Conventions</span>${mdInline(sh.conventions_md)}</div>` : ""}
    <h2 class="section-title">How the tables relate</h2>
    <figure class="diagram"><div class="mermaid-out"></div><pre class="mermaid-src">${esc(sh.er_mermaid)}</pre><figcaption>Read <code>||--o{</code> as one-to-many; a loop is a self-reference.</figcaption></figure>
    ${sh.planted_traps?.length ? `<h2 class="section-title">Planted on purpose</h2><ul>${sh.planted_traps.map((t) => `<li>${mdInline(t)}</li>`).join("")}</ul>` : ""}
    <h2 class="section-title">Tables</h2>
    ${sh.tables.map((t) => `<div class="tbl-caption"><span class="name">${esc(t.name)}</span><span class="small muted">${t.rows.length} rows</span></div>
      <details class="fold"><summary>Columns</summary><div class="fold-body">${dataTable(["column", "type", "key", "note"], t.columns.map((col) => [col.name, col.type, [col.pk ? "PK" : "", col.fk ? `FK → ${col.fk}` : ""].filter(Boolean).join(" "), col.note || ""]))}</div></details>
      ${dataTable(t.columns.map((col) => col.name), t.rows, { tall: true })}`).join("")}
    <h2 class="section-title">Setup script</h2>
    <p class="muted">Every problem in this collection already runs against these tables in the editor. To practise in MySQL Workbench, run this first.</p>
    ${codeBlock(sh.setup_sql, { label: "Copy setup.sql" })}
    <h2 class="section-title">Problems</h2>
    <ul>${c.problems.map((p) => `<li><a href="${problemHref(`${c.id}/${p.id}`)}">${esc(p.title)}</a> <span class="muted small">${esc(p.id)} · ${esc(p.difficulty)}</span></li>`).join("")}</ul>
  </div>`;
  return {
    title: `${c.title} dataset`,
    html,
    mount(root) {
      renderDiagrams(root);
      const onTheme = () => renderDiagrams(root, true);
      window.addEventListener("themechange", onTheme);
      return () => window.removeEventListener("themechange", onTheme);
    },
  };
}
