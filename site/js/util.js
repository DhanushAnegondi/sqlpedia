// Shared helpers: escaping, markdown, SQL highlighting, tables, clipboard, toast, dates.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------ markdown

export function mdInline(s) {
  const codes = [];
  let out = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${c}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      if (!/^(https?:|#|\/|\.{0,2}\/|[\w-]+(\.html)?$)/i.test(h) || /^(javascript|data|vbscript):/i.test(h)) return t;
      const ext = /^https?:/.test(h);
      return `<a href="${h}"${ext ? ' rel="noopener" target="_blank"' : ""}>${t}</a>`;
    });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

// Blocks: ``` fences, | pipe | tables |, #### headings, - / 1. lists, paragraphs (single newline = <br>).
export function md(src) {
  if (!src) return "";
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join("\n");
      out.push(/^(sql|mysql|tsql)?$/i.test(fence[1]) ? codeBlock(code) : `<div class="code"><pre><code>${esc(code)}</code></pre></div>`);
      continue;
    }
    if (isTableRow(line) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => mdInline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tbl-wrap"><table class="data"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { out.push(`<h4>${mdInline(h[2])}</h4>`); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(`<li>${mdInline(item)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !/^#{2,4}\s/.test(lines[i]) && !(isTableRow(lines[i]) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]))) para.push(lines[i++]);
    out.push(`<p>${para.map(mdInline).join("<br>")}</p>`);
  }
  return out.join("");
}

// ------------------------------------------------------------ SQL highlighting

const KW = new Set(("select from where and or not in is null as on join left right inner outer full cross " +
  "group by order having limit offset with recursive union all distinct case when then else end over " +
  "partition rows range between unbounded preceding following current row asc desc insert into values " +
  "update set delete create table drop if exists primary key references int integer varchar decimal date datetime " +
  "interval day month year week hour minute second exists cast like using true false any some char signed unsigned " +
  "top fetch next only window intersect except merge matched go declare begin commit").split(" "));
const FN = new Set(("count sum avg min max round coalesce nullif lag lead row_number rank dense_rank ntile " +
  "percent_rank cume_dist first_value last_value nth_value date_format datediff date_add date_sub dateadd datepart " +
  "datename eomonth last_day lower upper trim ltrim rtrim concat concat_ws substring substr left right length len " +
  "char_length charindex locate instr replace reverse lpad rpad replicate floor ceil ceiling abs mod power sqrt " +
  "truncate month year day extract timestampdiff str_to_date convert format group_concat string_agg ifnull isnull " +
  "iif if greatest least now curdate getdate weekday dayofweek quarter week yearweek makedate datefromparts " +
  "substring_index position cast").split(" "));

export function highlightSql(src) {
  const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  let out = "", m;
  while ((m = re.exec(src))) {
    if (m[1]) out += `<span class="tok-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-num">${m[3]}</span>`;
    else if (m[4]) {
      const w = m[4].toLowerCase();
      const call = /^\s*\(/.test(src.slice(re.lastIndex));
      if (FN.has(w) && call) out += `<span class="tok-fn">${esc(m[4])}</span>`;
      else if (KW.has(w)) out += `<span class="tok-kw">${esc(m[4])}</span>`;
      else out += esc(m[4]);
    } else out += esc(m[5]);
  }
  return out;
}

let codeId = 0;
export const codeStore = new Map();
export function codeBlock(sql, { load = false, label = "Copy" } = {}) {
  const id = `c${++codeId}`;
  codeStore.set(id, sql);
  return `<div class="code"><div class="code-actions">` +
    (load ? `<button type="button" class="btn sm" data-load="${id}">Load into editor</button>` : "") +
    `<button type="button" class="btn sm" data-copy="${id}">${esc(label)}</button></div>` +
    `<pre><code>${highlightSql(sql)}</code></pre></div>`;
}

// ------------------------------------------------------------ tables

export const isNum = (v) => v !== null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v));

export function dataTable(columns, rows, { rowClass = null, tall = false, max = 500 } = {}) {
  if (!columns.length && !rows.length) return `<div class="tbl-wrap"><div class="muted small" style="padding:8px 12px">Empty result — 0 rows.</div></div>`;
  const shown = rows.slice(0, max);
  const head = `<tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
  const body = shown.map((r, i) => {
    const cls = rowClass ? rowClass(r, i) : "";
    return `<tr${cls ? ` class="${cls}"` : ""}>` + r.map((v) => v === null || v === undefined
      ? `<td class="null">NULL</td>`
      : `<td${isNum(v) ? ' class="num"' : ""}>${esc(v)}</td>`).join("") + "</tr>";
  }).join("");
  const more = rows.length > max ? `<div class="small muted" style="padding:6px 12px">Showing ${max} of ${rows.length} rows.</div>` : "";
  return `<div class="tbl-wrap${tall ? " tall" : ""}"><table class="data"><thead>${head}</thead><tbody>${body || `<tr><td class="muted" colspan="${columns.length || 1}">No rows</td></tr>`}</tbody></table>${more}</div>`;
}

// ------------------------------------------------------------ clipboard + toast

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    return ok;
  }
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

// ------------------------------------------------------------ dates (local time, never UTC)

export const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fmtDay = (k) => { const d = parseDay(k); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtStamp = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const monthShort = (i) => MONTHS[i].slice(0, 3);
export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Icons (inline SVG, currentColor)
export const ICON = {
  check: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" opacity=".15"/><path d="M5 8.2l2 2 4-4.4"/></svg>`,
  dot: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/></svg>`,
  half: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 3.2v9.6L12.5 8z"/></svg>`,
  send: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2.5 8h9M8 4l4 4-4 4"/></svg>`,
  reset: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8a5 5 0 105-5H5M5 1v2.5H7.5"/></svg>`,
  left: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>`,
  right: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>`,
  doc: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3 M6 8h4.5 M6 10.5h4.5"/></svg>`,
  bulb: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 13h4M6.5 15h3M8 1.8a4.2 4.2 0 00-2.6 7.5c.5.4.8 1 .8 1.7h3.6c0-.7.3-1.3.8-1.7A4.2 4.2 0 008 1.8z"/></svg>`,
  note: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 2.5h10v11H3z M5.5 5.5h5 M5.5 8h5 M5.5 10.5h3"/></svg>`,
  clock: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>`,
  sun: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3"/></svg>`,
  moon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z"/></svg>`,
  search: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>`,
  menu: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg>`,
  filter: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 3.5h12M4.5 8h7M7 12.5h2"/></svg>`,
  x: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" width="10" height="10"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
};
