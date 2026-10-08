// Reusable MediaWiki-style building blocks.

import { esc, md } from "../util.js";
import { problemHref, tierHref, tagHref, groupLabel } from "../data.js";
import * as state from "../state.js";

export function heading(level, id, text, extra = "") {
  return `<div class="mw-heading mw-heading${level}"><h${level} id="${id}">${esc(text)}</h${level}>${extra}</div>`;
}

export const STATUS_LABEL = { new: "Not started", attempted: "Attempted", solved: "Completed" };
export const statusPill = (s) => { const k = STATUS_LABEL[s] ? s : "new"; return `<span class="status-pill ${k}">${STATUS_LABEL[k]}</span>`; };

export function catlinks(cats) {
  return `<div class="catlinks"><a href="#/all">Categories</a>: <ul>${cats.map(([href, name]) => `<li><a href="${href}">${esc(name)}</a></li>`).join("")}</ul></div>`;
}

// Navbox listing every problem of a set grouped by tier, current one bold, prev/next row.
export function setNavbox(data, set, current) {
  const tiers = [...new Map(set.problems.map((p) => [p.tier, p.tier_title])).entries()];
  const rows = tiers.map(([t, title]) => {
    const items = data.problems.filter((p) => p.set === set.id && p.tier === t).map((p) => {
      const cls = [p.key === current?.key ? "current" : "", state.status(p.key) === "solved" ? "done" : ""].filter(Boolean).join(" ");
      return `<a href="${problemHref(p)}"${cls ? ` class="${cls}"` : ""} title="${esc(p.title)}">${esc(p.id)} ${esc(p.title)}</a>`;
    }).join(` <span class="sep">·</span> `);
    return `<div class="navbox-row"><div class="navbox-group"><a href="${tierHref(set.id, t)}">${set.group_kind === "Topic" ? esc(title) : `Tier ${esc(t)}</a><br><span style="font-weight:normal">${esc(title)}</span>`}${set.group_kind === "Topic" ? "</a>" : ""}</div><div class="navbox-list">${items}</div></div>`;
  }).join("");
  let pn = "";
  if (current) {
    const list = data.problems.filter((p) => p.set === set.id);
    const i = list.findIndex((p) => p.key === current.key);
    const prev = list[i - 1], next = list[i + 1];
    pn = `<div class="prevnext"><span>${prev ? `&larr; <a href="${problemHref(prev)}">${esc(prev.id)} ${esc(prev.title)}</a>` : ""}</span>` +
         `<span>${next ? `<a href="${problemHref(next)}">${esc(next.id)} ${esc(next.title)}</a> &rarr;` : ""}</span></div>`;
  }
  return `<div class="navbox" role="navigation" aria-label="${esc(set.title)} problems"><div class="navbox-title"><a href="#/set/${set.id}">${esc(set.title)}</a> problems</div>${rows}${pn}</div>`;
}

export function problemCats(p, data) {
  return [[tierHref(p.set, p.tier), `${data.setById(p.set).title} — ${p.group}`], ...p.tags.map((t) => [tagHref(t), t])];
}

export function problemListItem(p, data, { showSet = false } = {}) {
  const s = STATUS_LABEL[state.status(p.key)] ? state.status(p.key) : "new";
  return `<li><span class="status-dot ${s}" title="${STATUS_LABEL[s]}"></span><a href="${problemHref(p)}">${esc(p.title)}</a>` +
    ` <span style="color:var(--c-subtle);font-size:.85em">${esc(p.id)}${showSet ? " · " + esc(data.setById(p.set).title) : ""}</span></li>`;
}

export { md };
