// SQLpedia shell: hash router, top bar, search, theme, streak, global copy handler.

import { loadCatalog, problemHref, pageHref } from "./data.js";
import * as state from "./state.js";
import { esc, ICON, copyText, toast, codeStore, plural } from "./util.js";
import { renderHome } from "./views/home.js";
import { renderLibrary } from "./views/library.js";
import { renderWorkspace } from "./views/workspace.js";
import { renderHandbookIndex, renderHandbookPage, renderHandbookDataset } from "./views/handbook.js";
import { renderProgress } from "./views/progress.js";
import { renderDataset } from "./views/dataset.js";

const $ = (id) => document.getElementById(id);
let catalog = null;
let cleanup = null;
let routeSeq = 0;
let firstRoute = true;

const routes = [
  [/^\/?$/, () => renderHome(catalog), "home"],
  [/^\/problems$/, (m, q) => renderLibrary(catalog, q), "problems"],
  [/^\/p\/([\w-]+)\/([\w-]+)(?:\/(question|solution|notes|submissions))?$/, (m) => renderWorkspace(catalog, m[1], m[2], m[3] || "question"), "problems"],
  [/^\/handbook$/, () => renderHandbookIndex(catalog), "handbook"],
  [/^\/handbook\/dataset$/, () => renderHandbookDataset(catalog), "handbook"],
  [/^\/handbook\/([\w-]+)$/, (m) => renderHandbookPage(catalog, m[1]), "handbook"],
  [/^\/data\/([\w-]+)$/, (m) => renderDataset(catalog, m[1]), "problems"],
  [/^\/progress$/, () => renderProgress(catalog), "progress"],
];

function notFound(path) {
  return { title: "Not found", html: `<div class="page narrow"><div class="empty-state"><b>Nothing here</b>No page at <code>#${esc(path)}</code>. <a href="#/">Go home</a> or <a href="#/problems">browse problems</a>.</div></div>` };
}

async function route() {
  const seq = ++routeSeq;
  const raw = location.hash.slice(1) || "/";
  const [pathAnchor, qs] = raw.split("?");
  const [path, anchor] = pathAnchor.split("#");
  const query = new URLSearchParams(qs || "");
  let view = null, section = "";
  for (const [re, fn, sec] of routes) {
    const m = path.match(re);
    if (m) {
      try { view = await fn(m, query); }
      catch (e) { view = { title: "Error", html: `<div class="page narrow"><div class="callout bad"><span class="title">Couldn't load this page.</span>${esc(e.message)}</div></div>` }; }
      section = sec;
      break;
    }
  }
  if (seq !== routeSeq) return; // a newer navigation started while this view was loading
  view ||= notFound(path);
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.title = view.title ? `${view.title} · SQLpedia` : "SQLpedia";
  const main = $("main");
  main.innerHTML = view.html;
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $("nav").classList.remove("open");
  if (view.mount) cleanup = view.mount(main, { anchor }) || null;
  if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); }
  else if (!view.keepScroll) window.scrollTo(0, 0);
  // move focus to the new content (the clicked link is gone), except on first load and in-page filtering
  if (!firstRoute && !view.keepScroll && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  firstRoute = false;
}

// ------------------------------------------------------------ search

function setupSearch() {
  $("searchIcon").outerHTML = ICON.search;
  const box = $("search"), pop = $("searchPop");
  let active = -1;
  const close = () => { pop.classList.remove("open"); box.setAttribute("aria-expanded", "false"); active = -1; };
  const results = (q) => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (hay) => terms.every((t) => hay.includes(t));
    const probs = catalog.problems.filter((p) => match(`${p.title} ${p.id} ${p.topics.join(" ")} ${p.difficulty}`.toLowerCase())).slice(0, 7);
    const pages = [];
    for (const pg of catalog.handbook) {
      if (match(`${pg.title} ${pg.group}`.toLowerCase())) pages.push({ href: pageHref(pg.id), t: pg.title, s: pg.group });
      for (const s of pg.sections) if (match(`${s.heading} ${pg.title}`.toLowerCase()) && pages.length < 7) pages.push({ href: pageHref(pg.id, s.id), t: s.heading, s: pg.title });
    }
    return { probs, pages: pages.slice(0, 6) };
  };
  box.addEventListener("input", () => {
    const q = box.value.trim();
    if (!q) return close();
    const { probs, pages } = results(q);
    pop.innerHTML = (probs.length ? `<div class="group">Problems</div>` + probs.map((p) =>
      `<a href="${problemHref(p.key)}" role="option">${esc(p.title)}<span class="sub">${esc(catalog.collectionById(p.c).title)} · ${esc(p.difficulty)} · ${esc(p.topics.slice(0, 2).join(", "))}</span></a>`).join("") : "") +
      (pages.length ? `<div class="group">Handbook</div>` + pages.map((p) => `<a href="${p.href}" role="option">${esc(p.t)}<span class="sub">${esc(p.s)}</span></a>`).join("") : "") +
      (!probs.length && !pages.length ? `<div class="empty">Nothing matches “${esc(q)}”.</div>` : "") +
      (probs.length ? `<a href="#/problems?q=${encodeURIComponent(q)}" role="option"><span class="sub">See all matching problems →</span></a>` : "");
    pop.classList.add("open");
    box.setAttribute("aria-expanded", "true");
    active = -1;
  });
  box.addEventListener("keydown", (e) => {
    const items = [...pop.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle("active", i === active));
    } else if (e.key === "Enter") {
      const target = items[active >= 0 ? active : 0];
      if (target) { e.preventDefault(); location.hash = target.getAttribute("href"); box.value = ""; close(); box.blur(); }
    } else if (e.key === "Escape") { close(); box.blur(); }
  });
  pop.addEventListener("click", () => { box.value = ""; close(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); box.focus(); }
  });
}

// ------------------------------------------------------------ theme, streak, menu, copy

function setupTheme() {
  const btn = $("themeBtn");
  const isDark = () => document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const paint = () => { btn.innerHTML = isDark() ? ICON.sun : ICON.moon; btn.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode"); };
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sqlpedia.theme", next); } catch {}
    paint();
    window.dispatchEvent(new Event("themechange"));
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { paint(); window.dispatchEvent(new Event("themechange")); });
  paint();
}

function paintStreak() {
  const s = state.streaks();
  $("streak").innerHTML = s.current ? `<b>${s.current}</b> day streak` : `Progress`;
  $("streak").title = s.practicedToday ? "You practised today" : "No practice logged today yet";
}

function setupMenu() {
  const btn = $("menuBtn");
  btn.innerHTML = ICON.menu;
  btn.addEventListener("click", () => btn.setAttribute("aria-expanded", String($("nav").classList.toggle("open"))));
}

function setupCopy() {
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const text = codeStore.get(b.dataset.copy);
    if (text == null) return;
    const ok = await copyText(text);
    b.dataset.label ||= b.textContent;
    b.textContent = ok ? "Copied" : "Copy failed";
    clearTimeout(b._t);
    b._t = setTimeout(() => (b.textContent = b.dataset.label), 1400);
    if (!ok) toast("Couldn't copy — select the text manually.");
  });
}

async function boot() {
  try { catalog = await loadCatalog(); }
  catch (e) {
    $("main").innerHTML = `<div class="page narrow"><div class="callout bad"><span class="title">Couldn't load the problem data.</span>${esc(e.message)}<br>Serve <code>site/</code> over HTTP (<code>npm run serve</code>).</div></div>`;
    return;
  }
  setupSearch(); setupTheme(); setupMenu(); setupCopy();
  paintStreak();
  state.onChange(paintStreak);
  window.addEventListener("hashchange", route);
  route();
}

boot();
export { plural };
