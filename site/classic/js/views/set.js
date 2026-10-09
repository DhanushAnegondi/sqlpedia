// Dataset article: description, ER diagram, every table in full, conventions, traps, setup.sql.

import { esc, md, mdInline, wikitable, codeBlock, plural } from "../util.js";
import { problemHref, tierHref, groupLabel } from "../data.js";
import { heading, setNavbox, problemListItem } from "./parts.js";
import * as state from "../state.js";

export function renderSet(data, setId) {
  const set = data.setById(setId);
  if (!set) return { title: "Set not found", html: `<h1 id="firstHeading">Set not found</h1><div class="ambox content"><div>No problem set <code>${esc(setId)}</code>.</div></div>` };
  const problems = data.problems.filter((p) => p.set === set.id);
  const solved = problems.filter((p) => state.status(p.key) === "solved").length;
  const totalRows = set.tables.reduce((n, t) => n + t.rows.length, 0);
  const tiers = [...new Map(problems.map((p) => [p.tier, p.tier_title])).entries()];

  const infobox = `<table class="infobox"><caption>${esc(set.title)}</caption>
    <tr><td colspan="2" class="infobox-subheader">Practice dataset</td></tr>
    <tr><th scope="row">Tables</th><td>${set.tables.length}</td></tr>
    <tr><th scope="row">Rows</th><td>${totalRows}</td></tr>
    <tr><th scope="row">Problems</th><td>${problems.length}</td></tr>
    <tr><th scope="row">Completed</th><td>${solved} of ${problems.length}</td></tr>
    <tr><th scope="row">Engine</th><td>MySQL 8.0 (run in Workbench)</td></tr>
    <tr><td colspan="2" style="text-align:center;padding-top:.5em"><button type="button" class="mw-btn small" data-copy-text="${esc(set.setup_sql)}">Copy setup.sql</button></td></tr></table>`;

  const summary = `<div class="table-scroll"><table class="wikitable"><thead><tr><th>Table</th><th>Rows</th><th>Columns</th></tr></thead><tbody>` +
    set.tables.map((t) => `<tr><td><a href="#/set/${set.id}#t-${t.name}"><code>${esc(t.name)}</code></a></td><td class="num">${t.rows.length}</td><td>${t.columns.map((c) => esc(c.name)).join(", ")}</td></tr>`).join("") +
    `</tbody></table></div>`;

  const tables = set.tables.map((t) => {
    const schema = `<div class="table-scroll"><table class="wikitable"><thead><tr><th>Column</th><th>Type</th><th>Key</th><th>Nullable</th><th>Note</th></tr></thead><tbody>` +
      t.columns.map((c) => `<tr><td><code>${esc(c.name)}</code></td><td class="mono">${esc(c.type)}</td><td>${c.pk ? `<span class="key-badge">PK</span>` : ""}${c.fk ? `<span class="key-badge">FK</span> → <code>${esc(c.fk)}</code>` : ""}</td><td>${c.nullable ? "yes" : "no"}</td><td>${c.note ? esc(c.note) : ""}</td></tr>`).join("") +
      `</tbody></table></div>`;
    const usedBy = problems.filter((p) => p.tables_used.includes(t.name));
    return heading(3, `t-${t.name}`, t.name) + schema +
      `<details class="mw-collapsible"${t.rows.length <= 15 ? " open" : ""}><summary><span>Data <span class="sub">${plural(t.rows.length, "row")}</span></span><span class="toggle" aria-hidden="true"></span></summary><div class="body">${wikitable(t.columns.map((c) => c.name), t.rows)}</div></details>` +
      `<p style="font-size:.8125rem;color:var(--c-subtle)">Used by ${plural(usedBy.length, "problem")}: ${usedBy.map((p) => `<a href="${problemHref(p)}">${esc(p.id)}</a>`).join(", ")}</p>`;
  }).join("");

  const byTier = tiers.map(([t, title]) =>
    `<div class="mw-category-group"><h3><a href="${tierHref(set.id, t)}">${esc(groupLabel(set, t, title))}</a>${set.group_kind === "Topic" ? "" : ` — ${esc(title)}`}</h3><ul>${problems.filter((p) => p.tier === t).map((p) => problemListItem(p, data)).join("")}</ul></div>`).join("");

  const html = `<h1 id="firstHeading">${esc(set.title)} <span class="title-prefix">(dataset)</span></h1>
    <div class="siteSub">From SQLpedia · ${esc(set.full_title)}</div>
    ${infobox}
    ${md(set.description_md)}
    <p>Run <code>setup.sql</code> once in MySQL Workbench to create the ${set.tables.length} tables; it drops and recreates them, so re-run it whenever a problem changes the data.</p>
    ${heading(2, "er", "Entity–relationship diagram")}
    <figure class="diagram"><div class="mermaid-out"></div><pre class="mermaid-src">${esc(set.er_mermaid)}</pre>
      <figcaption>How the ${set.tables.length} tables relate. Read <code>||--o{</code> as one-to-many; a loop on a table is a self-reference.</figcaption></figure>
    ${heading(2, "tables", "Tables")}${summary}${tables}
    ${heading(2, "conventions", "Conventions")}<p>${mdInline(set.conventions_md)}</p>
    ${heading(2, "planted", "Planted on purpose")}<p>These are what interviewers test; the problems lean on them.</p><ul>${set.planted_traps.map((t) => `<li>${mdInline(t)}</li>`).join("")}</ul>
    ${set.essentials.length ? `${heading(2, "essentials", "Short on time")}<p>Do these ${set.essentials.length} first: ${set.essentials.map((id) => { const p = problems.find((x) => x.id === id); return p ? `<a href="${problemHref(p)}">${esc(id)}</a>` : esc(id); }).join(", ")}.</p>` : ""}
    ${heading(2, "setup", "Setup script")}<p>${set.native_mysql ? "Written for MySQL 8.0." : "Plain SQL; runs unchanged on MySQL 8.0."}</p>${codeBlock(set.setup_sql, { label: "Copy setup.sql" })}
    ${heading(2, "problems", "Problems")}<div class="mw-category">${byTier}</div>
    ${setNavbox(data, set, null)}`;

  return { title: `${set.title} (dataset)`, html };
}
