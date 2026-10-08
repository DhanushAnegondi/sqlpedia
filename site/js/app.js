// SQLpedia shell: hash router, sidebar, section dropdown, search, appearance, TOC.

import { loadAll, problemHref, setHref, tierHref, tagHref, groupLabel } from "./data.js";
import * as state from "./state.js";
import { esc, copyText, toast, codeStore, plural } from "./util.js";
import { renderMain } from "./views/main.js";
import { renderProblem } from "./views/problem.js";
import { renderSet } from "./views/set.js";
import { renderAll, renderCategory } from "./views/lists.js";
import { renderProgress } from "./views/progress.js";
import { renderSearch, searchProblems } from "./views/search.js";
import { renderDiagrams } from "./mermaid.js";

const $ = (id) => document.getElementById(id);
let data = null;

// ------------------------------------------------------------ routing

const routes = [
  [/^\/?$/, () => renderMain(data)],
  [/^\/p\/([\w-]+)\/([\w-]+)(?:\/(solutions|history))?$/, (m) => renderProblem(data, m[1], m[2], m[3] || "")],
  [/^\/set\/([\w-]+)$/, (m) => renderSet(data, m[1])],
  [/^\/all$/, (m, q) => renderAll(data, q)],
  [/^\/category\/(tier|tag)\/([\w-]+)$/, (m) => renderCategory(data, m[1], m[2])],
  [/^\/progress$/, () => renderProgress(data)],
  [/^\/search$/, (m, q) => renderSearch(data, q.get("q") || "")],
  [/^\/random$/, () => {
    const open = data.problems.filter((p) => state.status(p.key) !== "solved");
    const pool = open.length ? open : data.problems;
    const p = pool[Math.floor(Math.random() * pool.length)];
    location.replace(problemHref(p));
    return null;
  }],
];

function notFound(path) {
  return {
    title: "Page not found",
    html: `<h1 id="firstHeading">Page not found</h1>
      <div class="ambox content"><div>There is no page at <code>#${esc(path)}</code>. Try the <a href="#/">Main page</a>, <a href="#/all">All problems</a> or search.</div></div>`,
  };
}

async function route() {
  const raw = location.hash.slice(1) || "/";
  const [pathAnchor, qs] = raw.split("?");
  const [path, anchor] = pathAnchor.split("#");
  const query = new URLSearchParams(qs || "");
  let view = null;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { view = await fn(m, query); if (view === null) return; break; }
  }
  view ||= notFound(path);
  if (anchor) view.keepScroll = true;
  paint(view, path);
  if (anchor) {
    const el = document.getElementById(anchor);
    (el?.closest(".mw-heading") || el)?.scrollIntoView();
  }
}

let cleanup = null;
function paint(view, path) {
  if (cleanup) { cleanup(); cleanup = null; }
  document.title = `${view.title} - SQLpedia`;
  $("titlebar").innerHTML = view.titlebar || "";
  $("page").innerHTML = view.html;
  $("pageTools").innerHTML = view.tools || defaultTools();
  buildToc(view.toc !== false);
  markCurrent(path);
  syncSectionSelect(path);
  document.body.classList.remove("sidebar-open");
  if (!view.keepScroll) window.scrollTo(0, 0);
  renderDiagrams($("page"));
  if (view.after) cleanup = view.after($("page")) || null;
}

function defaultTools() {
  return `<h3>Tools</h3><ul>
    <li><a href="#/random">Random problem</a></li>
    <li><a href="#/all">All problems</a></li>
    <li><a href="#/progress">Your progress</a></li></ul>`;
}

// ------------------------------------------------------------ sidebar + dropdown

function sidebarHtml() {
  const counts = (list) => {
    const done = list.filter((p) => state.status(p.key) === "solved").length;
    return `<span class="count">${done}/${list.length}</span>`;
  };
  let h = `<div class="sidebar-group"><h3>Navigation</h3><ul>
    <li><a href="#/">Main page</a></li>
    <li><a href="#/all">All problems</a></li>
    <li><a href="#/random">Random problem</a></li>
    <li><a href="#/progress">Progress</a></li></ul></div>`;
  for (const s of data.sets) {
    const tiers = [...new Map(s.problems.map((p) => [p.tier, p.tier_title])).entries()];
    h += `<div class="sidebar-group"><h3>${esc(s.title)}</h3><ul>
      <li><a href="${setHref(s)}">Dataset and schema</a></li>` +
      tiers.map(([t, title]) => {
        const list = data.problems.filter((p) => p.set === s.id && p.tier === t);
        return `<li><a href="${tierHref(s.id, t)}" title="${esc(title)}">${esc(groupLabel(s, t, title))} ${counts(list)}</a></li>`;
      }).join("") + `</ul></div>`;
  }
  h += `<div class="sidebar-group"><h3>Topics</h3><ul>` +
    data.tags.slice(0, 12).map((t) => `<li><a href="${tagHref(t.name)}">${esc(t.name)}</a></li>`).join("") +
    (data.tags.length > 12 ? `<li><a href="#/all">More topics…</a></li>` : "") + `</ul></div>`;
  return h;
}

function sectionOptions() {
  let h = `<option value="">Go to section…</option>
    <optgroup label="Navigation">
      <option value="#/">Main page</option>
      <option value="#/all">All problems</option>
      <option value="#/random">Random problem</option>
      <option value="#/progress">Progress</option>
    </optgroup>`;
  for (const s of data.sets) {
    const tiers = [...new Map(s.problems.map((p) => [p.tier, p.tier_title])).entries()];
    h += `<optgroup label="${esc(s.title)}"><option value="${setHref(s)}">${esc(s.title)}: dataset and schema</option>` +
      tiers.map(([t, title]) => `<option value="${tierHref(s.id, t)}">${s.group_kind === "Topic" ? esc(title) : `Tier ${esc(t)}: ${esc(title)}`}</option>`).join("") +
      `</optgroup>`;
    h += `<optgroup label="${esc(s.title)}: problems">` +
      s.problems.map((p) => `<option value="${problemHref({ ...p, set: s.id })}">${esc(p.id)} · ${esc(p.title)}</option>`).join("") +
      `</optgroup>`;
  }
  h += `<optgroup label="Topics">` +
    data.tags.map((t) => `<option value="${tagHref(t.name)}">${esc(t.name)} (${t.problems.length})</option>`).join("") +
    `</optgroup>`;
  return h;
}

function syncSectionSelect(path) {
  const sel = $("sectionSelect");
  const want = "#" + path;
  sel.value = [...sel.options].some((o) => o.value === want) ? want : "";
}

function markCurrent(path) {
  for (const a of document.querySelectorAll("#sidebarNav a")) {
    if (a.getAttribute("href") === "#" + path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function refreshChrome() {
  $("sidebarNav").innerHTML = sidebarHtml();
  const s = state.streaks();
  $("streakChip").textContent = s.current ? `Streak: ${plural(s.current, "day")}` : "Progress";
  $("streakChip").title = s.practicedToday ? "You practiced today" : "No practice logged today yet";
  markCurrent((location.hash.slice(1) || "/").split("?")[0]);
}

// ------------------------------------------------------------ TOC + scroll spy

let spy = null;
function buildToc(enabled) {
  const toc = $("toc"), list = $("tocList");
  if (spy) { spy.disconnect(); spy = null; }
  const heads = enabled ? [...$("page").querySelectorAll(".mw-heading2 h2[id], .mw-heading3 h3[id]")] : [];
  if (heads.length < 2) { toc.hidden = true; list.innerHTML = ""; return; }
  toc.hidden = false;
  list.innerHTML = `<li class="toc-level-1"><a href="#top" data-target="__top" class="active">(Top)</a></li>` +
    heads.map((h) => `<li class="toc-level-${h.tagName === "H2" ? 1 : 2}"><a href="#" data-target="${h.id}">${esc(h.textContent)}</a></li>`).join("");
  list.onclick = (e) => {
    const a = e.target.closest("a[data-target]");
    if (!a) return;
    e.preventDefault();
    const t = a.dataset.target;
    if (t === "__top") window.scrollTo({ top: 0 });
    else document.getElementById(t)?.closest(".mw-heading")?.scrollIntoView();
  };
  const links = [...list.querySelectorAll("a")];
  spy = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) {
      links.forEach((l) => l.classList.toggle("active", l.dataset.target === en.target.id));
    }
  }, { rootMargin: "-60px 0px -70% 0px" });
  heads.forEach((h) => spy.observe(h));
}

// ------------------------------------------------------------ search box

function setupSearch() {
  const box = $("searchBox"), res = $("searchResults");
  let active = -1;
  const close = () => { res.classList.remove("open"); active = -1; box.setAttribute("aria-expanded", "false"); };
  box.addEventListener("input", () => {
    const q = box.value.trim();
    if (!q) return close();
    const hits = searchProblems(data, q).slice(0, 8);
    res.innerHTML = hits.length
      ? hits.map((p) => `<a href="${problemHref(p)}" role="option">${esc(p.title)}<span class="sr-sub">${esc(p.id)} · ${esc(data.setById(p.set).title)} · ${esc(p.group)}</span></a>`).join("") +
        `<a href="#/search?q=${encodeURIComponent(q)}" role="option"><i>Search for pages containing “${esc(q)}”</i></a>`
      : `<div class="sr-empty">No problems match “${esc(q)}”.</div>`;
    res.classList.add("open");
    box.setAttribute("aria-expanded", "true");
    active = -1;
  });
  box.addEventListener("keydown", (e) => {
    const items = [...res.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle("active", i === active));
    } else if (e.key === "Escape") close();
    else if (e.key === "Enter" && active >= 0 && items[active]) {
      e.preventDefault();
      location.hash = items[active].getAttribute("href");
      box.value = "";
      close();
    }
  });
  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = box.value.trim();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
    box.value = "";
    close();
  });
  res.addEventListener("click", () => { box.value = ""; close(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".vector-search")) close(); });
}

// ------------------------------------------------------------ appearance

function setupAppearance() {
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem("sqlpedia.appearance") || "{}"); } catch {}
  const root = document.documentElement;
  const apply = () => {
    if (prefs.theme && prefs.theme !== "auto") root.dataset.theme = prefs.theme; else delete root.dataset.theme;
    if (prefs.fontsize) root.dataset.fontsize = prefs.fontsize; else delete root.dataset.fontsize;
    if (prefs.width) root.dataset.width = prefs.width; else delete root.dataset.width;
    for (const seg of document.querySelectorAll(".seg[data-pref]")) {
      const cur = prefs[seg.dataset.pref] ?? (seg.dataset.pref === "theme" ? "auto" : "");
      for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === cur));
    }
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".seg[data-pref] button");
    if (!b) return;
    prefs[b.closest(".seg").dataset.pref] = b.dataset.v;
    try { localStorage.setItem("sqlpedia.appearance", JSON.stringify(prefs)); } catch {}
    apply();
    if (b.closest(".seg").dataset.pref === "theme") renderDiagrams($("page"), true);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => renderDiagrams($("page"), true));
  apply();
}

function setupSidebarToggle() {
  const btn = $("sidebarToggle");
  btn.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 850px)").matches) {
      const open = document.body.classList.toggle("sidebar-open");
      document.body.classList.remove("sidebar-hidden");
      btn.setAttribute("aria-expanded", String(open));
    } else {
      const hidden = document.body.classList.toggle("sidebar-hidden");
      btn.setAttribute("aria-expanded", String(!hidden));
    }
  });
  if (window.matchMedia("(max-width: 850px)").matches) btn.setAttribute("aria-expanded", "false");
}

// ------------------------------------------------------------ global click handlers

function setupCopy() {
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy], [data-copy-text]");
    if (!b) return;
    const text = codeStore.get(b.dataset.copy) ?? b.dataset.copyText;
    if (text == null) return;
    const ok = await copyText(text);
    b.dataset.label ||= b.textContent;
    b.textContent = ok ? "Copied" : "Copy failed";
    toast(ok ? "Copied to clipboard — paste it into MySQL Workbench." : "Could not copy. Select the text manually.");
    clearTimeout(b._t);
    b._t = setTimeout(() => (b.textContent = b.dataset.label), 1500);
  });
}

// ------------------------------------------------------------ boot

async function boot() {
  try {
    data = await loadAll();
  } catch (err) {
    $("page").innerHTML = `<h1 id="firstHeading">SQLpedia</h1><div class="ambox speedy"><div><p class="ambox-title">Could not load the problem data.</p><p>${esc(err.message)}</p><p>Serve the <code>site/</code> folder over HTTP (<code>npm run serve</code>), not from the file system.</p></div></div>`;
    return;
  }
  $("sectionSelect").innerHTML = sectionOptions();
  $("sectionSelect").addEventListener("change", (e) => { if (e.target.value) location.hash = e.target.value; });
  setupSearch();
  setupAppearance();
  setupSidebarToggle();
  setupCopy();
  refreshChrome();
  state.onChange(refreshChrome);
  window.addEventListener("hashchange", route);
  route();
}

boot();
