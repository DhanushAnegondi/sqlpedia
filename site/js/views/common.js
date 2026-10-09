// Small shared view pieces.

import { esc, ICON, dataTable } from "../util.js";
import * as state from "../state.js";

export const diffPill = (d) => `<span class="pill ${String(d).toLowerCase()}">${esc(d)}</span>`;

export function statusIcon(key) {
  const s = state.status(key);
  const label = s === "solved" ? "Solved" : s === "attempted" ? "Attempted" : "Not started";
  return `<span class="status-ic ${s}" title="${label}" aria-label="${label}">${s === "solved" ? ICON.check : s === "attempted" ? ICON.half : ICON.dot}</span>`;
}

export const topicChip = (t) => `<a class="chip" href="#/problems?topic=${encodeURIComponent(t)}">${esc(t)}</a>`;

// Render an engine result (or error) into HTML.
export function resultHtml(res, { emptyNote = "" } = {}) {
  if (!res) return `<div class="muted small">${emptyNote || "Run a query to see its result here."}</div>`;
  if (!res.ok) {
    const title = res.kind === "translate" ? "Not supported in the browser engine" : res.kind === "load" ? "Engine unavailable" : "Error";
    return `<div class="err-box"><b>${title}.</b> ${esc(res.error)}</div>`;
  }
  if (res.message) return `<div class="muted">${esc(res.message)}</div>`;
  return dataTable(res.columns, res.rows, { tall: true }) +
    `<div class="small muted" style="margin-top:6px">${res.rows.length} row${res.rows.length === 1 ? "" : "s"}${res.truncated ? " (truncated)" : ""} · ${res.ms} ms</div>`;
}

export function heatmapHtml(activity, weeks = 53) {
  const today = new Date();
  const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end); start.setDate(start.getDate() - weeks * 7 + 1);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lvl = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let html = "", lastM = -1;
  for (let w = 0; w < weeks; w++) {
    const col = new Date(start); col.setDate(col.getDate() + w * 7);
    if (col.getMonth() !== lastM && col.getDate() <= 7) { html += `<span class="m" style="grid-column:${w + 1}">${MON[col.getMonth()]}</span>`; lastM = col.getMonth(); }
    for (let d = 0; d < 7; d++) {
      const day = new Date(col); day.setDate(day.getDate() + d);
      const k = key(day), n = activity[k] || 0, future = day > today;
      const label = `${day.toDateString()}: ${n ? `${n} problem${n === 1 ? "" : "s"}` : "no practice"}`;
      html += `<button type="button" class="c${future ? " future" : ""}${k === key(today) ? " today" : ""}" style="grid-column:${w + 1};grid-row:${d + 2}" data-l="${lvl(n)}" data-day="${k}" title="${label}" aria-label="${label}"${future || (!n && k !== key(today)) ? ' tabindex="-1"' : ""}></button>`;
    }
  }
  return `<div class="heatmap-wrap"><div class="heatmap" role="group" aria-label="Practice activity">${html}</div></div>
    <div class="legend">Less ${[0, 1, 2, 3, 4].map((l) => `<span style="background:var(--hm-${l})"></span>`).join("")} More</div>`;
}
