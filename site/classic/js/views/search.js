// Client-side search over titles, ids, tags and statement text.

import { esc, plural } from "../util.js";
import { problemHref } from "../data.js";
import { statusPill } from "./parts.js";
import * as state from "../state.js";

export function searchProblems(data, q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return data.problems.map((p) => {
    const title = p.title.toLowerCase();
    const tags = p.tags.join(" ").toLowerCase();
    const body = (p.statement_md + " " + (p.hints_md || []).join(" ")).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (p.id.toLowerCase() === t) score += 20;
      if (title.includes(t)) score += 10;
      if (tags.includes(t)) score += 6;
      if (body.includes(t)) score += 2;
      else if (!title.includes(t) && !tags.includes(t) && p.id.toLowerCase() !== t) return null;
    }
    return { p, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.p.number - b.p.number).map((x) => x.p);
}

function snippet(text, terms) {
  const plain = text.replace(/[`*]/g, "");
  const low = plain.toLowerCase();
  let at = Math.max(0, Math.min(...terms.map((t) => low.indexOf(t)).filter((i) => i >= 0), plain.length));
  const start = Math.max(0, at - 60);
  const raw = (start ? "…" : "") + plain.slice(start, start + 200) + (plain.length > start + 200 ? "…" : "");
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  // Highlight on plain text, escape each segment: never match inside HTML entities.
  return raw.split(re).map((part, i) => (i % 2 ? `<b>${esc(part)}</b>` : esc(part))).join("");
}

export function renderSearch(data, q) {
  const hits = searchProblems(data, q);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const html = `<h1 id="firstHeading">Search results</h1>
    <div class="siteSub">${q ? `${plural(hits.length, "result")} for “${esc(q)}”` : "Type in the search box above."}</div>
    ${hits.length ? `<ul class="mw-history" style="font-size:1em">${hits.map((p) => `<li><a href="${problemHref(p)}"><b>${esc(p.title)}</b></a> ${statusPill(state.status(p.key))}<br>
        <span style="font-size:.875em">${snippet(p.statement_md, terms)}</span><br>
        <span style="font-size:.8125em;color:var(--c-subtle)">${esc(p.id)} · ${esc(data.setById(p.set).title)} · ${esc(p.group)} · ${esc(p.tags.join(", "))}</span></li>`).join("")}</ul>`
      : q ? `<div class="ambox notice"><div>There were no results matching the query. Try a topic such as <a href="#/search?q=window">window</a>, <a href="#/search?q=recursive">recursive</a> or <a href="#/search?q=median">median</a>.</div></div>` : ""}`;
  return { title: `Search: ${q}`, html, toc: false };
}
