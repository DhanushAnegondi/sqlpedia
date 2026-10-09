// Special:AllPages-style list with filters, and category pages (tier / topic).

import { esc, tagSlug, plural } from "../util.js";
import { problemHref, tierHref, tagHref } from "../data.js";
import * as state from "../state.js";
import { problemListItem, STATUS_LABEL, statusPill } from "./parts.js";

export function renderAll(data, query) {
  const f = { set: query.get("set") || "", tier: query.get("tier") || "", tag: query.get("tag") || "", status: query.get("status") || "" };
  const groups = [...new Map(data.problems.filter((p) => !f.set || p.set === f.set).map((p) => [`${p.set}:${p.tier}`, p])).values()];
  const list = data.problems.filter((p) =>
    (!f.set || p.set === f.set) && (!f.tier || `${p.set}:${p.tier}` === f.tier) &&
    (!f.tag || p.tags.some((t) => tagSlug(t) === f.tag)) && (!f.status || state.status(p.key) === f.status));

  const sel = (name, label, opts) => `<label>${label}<select data-filter="${name}"><option value="">All</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${f[name] === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
  const filters = `<div class="filter-bar" role="search" aria-label="Filter problems">
    ${data.sets.length > 1 ? sel("set", "Set", data.sets.map((s) => [s.id, s.title])) : ""}
    ${sel("tier", "Section", groups.map((p) => [`${p.set}:${p.tier}`, `${data.sets.length > 1 ? data.setById(p.set).title + " · " : ""}${p.group}`]))}
    ${sel("tag", "Topic", data.tags.map((t) => [t.slug, `${t.name} (${t.problems.length})`]))}
    ${sel("status", "Status", Object.entries(STATUS_LABEL))}
    ${Object.values(f).some(Boolean) ? `<a href="#/all" style="align-self:center">Clear filters</a>` : ""}</div>`;

  const rows = list.map((p) => {
    const set = data.setById(p.set);
    return `<tr><td><a href="#/set/${set.id}">${esc(set.title)}</a></td><td>${esc(p.id)}</td><td><a href="${problemHref(p)}">${esc(p.title)}</a>${set.essentials.includes(p.id) ? ` <span class="key-badge" title="Do these first">essential</span>` : ""}</td>
      <td><a href="${tierHref(p.set, p.tier)}">${esc(p.group)}</a></td>
      <td>${p.tags.map((t) => `<a href="${tagHref(t)}">${esc(t)}</a>`).join(", ")}</td>
      <td>${p.lc_ref ? `LC ${esc(p.lc_ref)}` : ""}</td><td>${statusPill(state.status(p.key))}</td></tr>`;
  }).join("");

  const html = `<h1 id="firstHeading">All problems</h1>
    <div class="siteSub">${plural(list.length, "problem")}${list.length !== data.problems.length ? ` of ${data.problems.length}` : ""}</div>
    ${filters}
    ${list.length ? `<div class="table-scroll"><table class="wikitable full"><thead><tr><th>Set</th><th>#</th><th>Problem</th><th>Section</th><th>Topics</th><th>LeetCode</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="ambox notice"><div>No problems match these filters. <a href="#/all">Clear filters</a>.</div></div>`}`;

  return {
    title: "All problems", html, toc: false,
    after: (root) => {
      const onChange = (e) => {
        const s = e.target.closest("select[data-filter]");
        if (!s) return;
        f[s.dataset.filter] = s.value;
        const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
        location.hash = "#/all" + (q ? "?" + q : "");
      };
      root.addEventListener("change", onChange);
      return () => root.removeEventListener("change", onChange);
    },
  };
}

export function renderCategory(data, kind, value) {
  let title, intro, list;
  if (kind === "tier") {
    const set = data.sets.find((s) => value.startsWith(s.id + "-"));
    const tier = set ? value.slice(set.id.length + 1).toUpperCase() : "";
    list = set ? data.problems.filter((p) => p.set === set.id && p.tier === tier) : [];
    if (!list.length) return missing(value);
    title = `${set.title} — ${list[0].group}`;
    intro = set.group_kind === "Topic"
      ? `<p>Problems in <a href="#/set/${set.id}">${esc(set.title)}</a> that drill <b>${esc(list[0].tier_title)}</b>.</p>`
      : `<p>Problems in <a href="#/set/${set.id}">${esc(set.title)}</a>, tier ${esc(tier)}: <i>${esc(list[0].tier_title)}</i>.</p>`;
  } else {
    const tag = data.tags.find((t) => t.slug === value);
    if (!tag) return missing(value);
    list = tag.problems;
    title = tag.name;
    intro = `<p>Problems tagged <b>${esc(tag.name)}</b>.</p>`;
  }
  const done = list.filter((p) => state.status(p.key) === "solved").length;
  const groups = new Map();
  for (const p of list) {
    const g = kind === "tier" ? p.tier_title : `${data.setById(p.set).title} — ${p.group}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const keys = [...groups.keys()].sort();
  const html = `<h1 id="firstHeading"><span class="title-prefix">Category:</span>${esc(title)}</h1>
    <div class="siteSub">${done} of ${plural(list.length, "problem")} completed</div>
    ${intro}
    <h2 style="font-family:var(--font-serif);font-weight:normal;font-size:1.3rem;margin:1em 0 .3em">Pages in category “${esc(title)}”</h2>
    <p>The following ${plural(list.length, "page")} ${list.length === 1 ? "is" : "are"} in this category.</p>
    <div class="mw-category">${keys.map((k) => `<div class="mw-category-group"><h3>${esc(k)}</h3><ul>${groups.get(k).map((p) => problemListItem(p, data, { showSet: data.sets.length > 1 })).join("")}</ul></div>`).join("")}</div>
    <div class="catlinks"><a href="#/all">All problems</a> · Other topics: <ul>${data.tags.filter((t) => t.name !== title).slice(0, 10).map((t) => `<li><a href="${tagHref(t.name)}">${esc(t.name)}</a></li>`).join("")}</ul></div>`;
  return { title: `Category:${title}`, html, toc: false };
}

function missing(v) {
  return { title: "Category not found", html: `<h1 id="firstHeading">Category not found</h1><div class="ambox content"><div>No category <code>${esc(v)}</code>. See <a href="#/all">All problems</a>.</div></div>` };
}
