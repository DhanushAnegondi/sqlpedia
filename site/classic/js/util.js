// Small shared helpers: escaping, markdown, SQL highlighting, tables, clipboard, dates.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------ markdown (inline + simple blocks)

export function mdInline(s) {
  const codes = [];
  let out = esc(s).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
      const ext = /^https?:/.test(h);
      return `<a href="${h}"${ext ? ' class="external" rel="noopener" target="_blank"' : ""}>${t}</a>`;
    });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

// Paragraphs split on blank lines; "- " lines become lists; single newlines become <br>.
export function md(s) {
  if (!s) return "";
  return String(s).trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*] /.test(l)))
      return "<ul>" + lines.map((l) => `<li>${mdInline(l.replace(/^\s*[-*] /, ""))}</li>`).join("") + "</ul>";
    return `<p>${lines.map(mdInline).join("<br>")}</p>`;
  }).join("");
}

// ------------------------------------------------------------ SQL highlighting

const KW = new Set(("select from where and or not in is null as on join left right inner outer full cross " +
  "group by order having limit offset with recursive union all distinct case when then else end over " +
  "partition rows range between unbounded preceding following current row asc desc insert into values " +
  "update set delete create table drop if exists primary key references int varchar decimal date " +
  "interval day month year exists cast like using true false any some char signed unsigned").split(" "));
const FN = new Set(("count sum avg min max round coalesce nullif lag lead row_number rank dense_rank " +
  "date_format datediff date_add date_sub lower upper trim concat floor ceil month extract " +
  "percentile_cont date_trunc generate_series group_concat ifnull year now").split(" "));

export function highlightSql(src) {
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  let out = "", m;
  while ((m = re.exec(src))) {
    if (m[1]) out += `<span class="tok-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-num">${m[3]}</span>`;
    else if (m[4]) {
      const w = m[4].toLowerCase();
      const next = src.slice(re.lastIndex).match(/^\s*\(/);
      if (FN.has(w) && next) out += `<span class="tok-fn">${esc(m[4])}</span>`;
      else if (KW.has(w)) out += `<span class="tok-kw">${esc(m[4])}</span>`;
      else out += esc(m[4]);
    } else out += esc(m[5]);
  }
  return out;
}

let codeId = 0;
export const codeStore = new Map();
export function codeBlock(sql, { label = "Copy" } = {}) {
  const id = `code-${++codeId}`;
  codeStore.set(id, sql);
  return `<div class="codeblock"><button type="button" class="mw-btn small copy-btn" data-copy="${id}" aria-label="Copy SQL">${esc(label)}</button>` +
    `<pre><code>${highlightSql(sql)}</code></pre></div>`;
}

// ------------------------------------------------------------ tables

const isNum = (v) => v !== null && v !== "" && /^-?\d+(\.\d+)?$/.test(String(v));

export function wikitable(columns, rows, { caption = "", markRow = null, className = "" } = {}) {
  const head = `<tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
  const body = rows.map((r, i) => {
    const cls = markRow ? markRow(r, i) : "";
    return `<tr${cls ? ` class="${cls}"` : ""}>` + r.map((v) =>
      v === null ? `<td class="null">NULL</td>`
        : `<td${isNum(v) ? ' class="num"' : ""}>${esc(v)}</td>`).join("") + "</tr>";
  }).join("");
  return `<div class="table-scroll"><table class="wikitable ${className}">` +
    (caption ? `<caption>${caption}</caption>` : "") +
    `<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

// ------------------------------------------------------------ clipboard + toast

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    return ok;
  }
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ------------------------------------------------------------ dates (local time, never UTC)

export const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fmtDay = (k) => { const d = parseDay(k); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtStamp = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const monthShort = (i) => MONTHS[i].slice(0, 3);

export const tagSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
