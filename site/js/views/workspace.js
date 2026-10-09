// Problem workspace: left = Question / Solution / Notes / Submissions, right = editor + output.

import { esc, md, mdInline, ICON, codeBlock, codeStore, dataTable, fmtStamp, toast } from "../util.js";
import { loadProblem, problemHref, pageHref } from "../data.js";
import * as state from "../state.js";
import { runSql } from "../engine/duck.js";
import { judge } from "../engine/judge.js";
import { NOTES } from "../engine/translate.js";
import { createEditor } from "../ui/editor.js";
import { diffPill, statusIcon, topicChip, resultHtml } from "./common.js";

const TABS = [["question", "Question", "doc"], ["solution", "Solution", "bulb"], ["notes", "Notes", "note"], ["submissions", "Submissions", "clock"]];
const lsGet = (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export async function renderWorkspace(catalog, cid, slug, tab) {
  const loaded = await loadProblem(cid, slug);
  if (!loaded) return null;
  const { collection: c, problem: p, key, setup } = loaded;
  const siblings = catalog.problems.filter((x) => x.c === c.id);
  const idx = siblings.findIndex((x) => x.key === key);
  const prev = siblings[idx - 1], next = siblings[idx + 1];
  const autoParts = p.parts.filter((x) => x.expected && !x.noeq);

  const html = `<div class="ws" id="ws">
    <section class="ws-pane ws-left" aria-label="Problem">
      <div class="ws-bar">
        <div class="tabs" role="tablist">${TABS.map(([id, label, ic]) => `<button role="tab" id="tab-${id}" aria-controls="tabBody" aria-selected="${id === tab}" tabindex="${id === tab ? 0 : -1}" data-tab="${id}">${ICON[ic]}<span>${label}</span></button>`).join("")}</div>
        <div class="nav-arrows">
          <a class="icon-btn" href="#/problems?c=${c.id}" title="All ${esc(c.title)} problems" aria-label="Back to list">${ICON.menu}</a>
          ${prev ? `<a class="icon-btn" href="${problemHref(prev.key)}" title="Previous: ${esc(prev.title)}" aria-label="Previous problem">${ICON.left}</a>` : ""}
          ${next ? `<a class="icon-btn" href="${problemHref(next.key)}" title="Next: ${esc(next.title)}" aria-label="Next problem">${ICON.right}</a>` : ""}
        </div>
      </div>
      <div class="ws-scroll" id="tabBody" role="tabpanel"></div>
    </section>
    <div class="ws-split" id="split" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"></div>
    <section class="ws-pane ws-right" aria-label="Editor">
      <div class="ws-bar">
        <label class="visually-hidden" for="dialect">Dialect</label>
        <select class="select" id="dialect"><option value="mysql">MySQL 8.0</option><option value="tsql">SQL Server</option></select>
        <button class="btn ghost sm" id="resetBtn" title="Reset to the starter query">${ICON.reset} Reset</button>
        <span class="grow"></span>
        <span class="engine-note" id="engineNote"></span>
        <button class="btn sm" id="runBtn" title="Run (Ctrl+Enter)">${ICON.play} Run</button>
        <button class="btn primary sm" id="submitBtn" title="Submit (Ctrl+Shift+Enter)" ${autoParts.length ? "" : "disabled"}>${ICON.send} Submit</button>
      </div>
      <div class="editor-wrap"><div id="editor"></div></div>
      <div class="out">
        <div class="out-head">
          <strong id="outTitle">Output</strong>
          ${autoParts.length > 1 ? `<label class="small muted" for="partSel">Check against</label><select class="select" id="partSel">${autoParts.map((x) => `<option value="${esc(x.label)}">Part (${esc(x.label)})</option>`).join("")}</select>` : ""}
          <span class="grow"></span>
          <span class="small muted" id="outMeta"></span>
        </div>
        <div class="out-body" id="outBody">${resultHtml(null, { emptyNote: autoParts.length ? "Run to see your result, Submit to check it against the expected output." : "This problem can't be checked automatically (it changes data). Run your query, then mark it solved in Submissions." })}</div>
      </div>
    </section>
  </div>`;

  return {
    title: p.title,
    html,
    mount(root) {
      const body = root.querySelector("#tabBody");
      const out = root.querySelector("#outBody");
      const outTitle = root.querySelector("#outTitle");
      const outMeta = root.querySelector("#outMeta");
      const dialectSel = root.querySelector("#dialect");
      let dialect = lsGet("sqlpedia.dialect", "mysql") === "tsql" ? "tsql" : "mysql";
      dialectSel.value = dialect;
      let current = tab;

      const starter = (d) => {
        const t = p.tables[0]?.name || "your_table";
        return d === "tsql" ? `-- SQL Server\nSELECT TOP 10 *\nFROM ${t};\n` : `-- MySQL 8.0\nSELECT *\nFROM ${t}\nLIMIT 10;\n`;
      };
      const draftKey = (d) => `sqlpedia.draft.${key}.${d}`;
      const editor = createEditor(root.querySelector("#editor"), {
        value: lsGet(draftKey(dialect)) ?? starter(dialect),
        onRun: () => run(false), onSubmit: () => run(true),
        onChange: (v) => lsSet(draftKey(dialect), v),
      });

      // ---------------- tabs
      const paintTab = () => {
        root.querySelectorAll("[data-tab]").forEach((b) => { b.setAttribute("aria-selected", String(b.dataset.tab === current)); b.tabIndex = b.dataset.tab === current ? 0 : -1; });
        body.setAttribute("aria-labelledby", `tab-${current}`);
        body.innerHTML = current === "solution" ? solutionHtml() : current === "notes" ? notesHtml() : current === "submissions" ? submissionsHtml() : questionHtml();
        body.scrollTop = 0;
      };
      root.querySelector(".tabs").addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const ids = TABS.map(([id]) => id);
        const nextId = ids[(ids.indexOf(current) + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
        root.querySelector(`[data-tab="${nextId}"]`).click();
        root.querySelector(`[data-tab="${nextId}"]`).focus();
      });
      root.querySelector(".tabs").addEventListener("click", (e) => {
        const b = e.target.closest("[data-tab]");
        if (!b) return;
        current = b.dataset.tab;
        history.replaceState(null, "", problemHref(key, current === "question" ? "" : current));
        paintTab();
      });

      const questionHtml = () => {
        const meta = `<div class="ws-meta">${diffPill(p.difficulty)}${statusIcon(key)}<a class="chip" href="#/problems?c=${c.id}">${esc(c.title)}</a>${p.section ? `<span class="chip">${esc(p.section)}</span>` : ""}${p.lc_ref ? `<span class="chip">≈ LeetCode ${esc(p.lc_ref)}</span>` : ""}</div>`;
        const shared = c.kind === "shared" ? `<div class="callout"><span class="title">Uses the ${esc(c.title)} dataset</span>${mdInline(c.shared.conventions_md || "")} <a href="#/data/${c.id}">Dataset and diagram →</a></div>` : "";
        const tables = p.tables.map((t) => `
          <div class="tbl-caption"><span class="name">${esc(t.name)}</span><span class="small muted">${t.rows.length} row${t.rows.length === 1 ? "" : "s"}</span></div>
          ${t.description_md ? `<div class="small muted" style="margin:-2px 0 6px">${mdInline(t.description_md)}</div>` : ""}
          <details class="fold"><summary>Columns</summary><div class="fold-body">${dataTable(["column", "type", "note"], t.columns.map((col) => [col.name, col.type, col.note || ""]))}</div></details>
          ${dataTable(t.columns.map((col) => col.name), t.rows, { tall: true })}`).join("");
        const expected = p.parts.map((part) => `
          ${p.parts.length > 1 ? `<h2>Expected output — part (${esc(part.label)})</h2>` : `<h2>Expected output</h2>`}
          ${part.intro_md ? md(part.intro_md) : ""}
          ${part.expected ? dataTable(part.expected.columns, part.expected.rows, { tall: true }) : ""}
          ${part.note_md ? `<div class="small muted">${md(part.note_md)}</div>` : ""}`).join("");
        const hints = (p.hints_md || []).map((h, i) => `<details class="fold"><summary>Hint${p.hints_md.length > 1 ? " " + (i + 1) : ""}</summary><div class="fold-body">${md(h)}</div></details>`).join("");
        return `<h1>${esc(p.title)}</h1>${meta}
          <div class="statement">${md(p.statement_md)}</div>
          ${p.dialect_note_md ? `<div class="callout warn"><span class="title">MySQL note</span>${mdInline(p.dialect_note_md)}</div>` : ""}
          ${shared}
          <h2>Tables</h2>${tables}
          ${expected}
          ${hints ? `<h2>Hints</h2>${hints}` : ""}`;
      };

      const solutionHtml = () => {
        const e = state.get(key);
        if (!e.revealed) return `<h1>${esc(p.title)}</h1><div class="reveal"><b>Solutions are hidden</b><span class="muted">Give it a real try first — the Notes tab has memory joggers if you're stuck.</span><div class="row"><button class="btn primary" data-act="reveal">Reveal solutions</button><button class="btn ghost" data-goto="notes">Open notes</button></div></div>`;
        return `<h1>${esc(p.title)}</h1>` + p.parts.map((part) => `
          ${p.parts.length > 1 ? `<h2>Part (${esc(part.label)})</h2>` : ""}
          ${part.solutions_intro_md ? md(part.solutions_intro_md) : ""}
          ${part.solutions.map((s) => `<h2>${esc(s.label)}</h2>${s.explain_md ? md(s.explain_md) : ""}${codeBlock(s.sql, { load: true })}`).join("")}
          ${part.traps.map((t) => `<div class="callout bad"><span class="title">Common wrong answer</span>${mdInline(t.explain_md)}${codeBlock(t.sql, { load: true })}</div>`).join("")}
          ${part.postgres_original ? `<details class="fold"><summary>PostgreSQL original</summary><div class="fold-body">${codeBlock(part.postgres_original)}</div></details>` : ""}`).join("") +
          `<p><button class="btn ghost sm" data-act="hide">Hide solutions</button></p>`;
      };

      const notesHtml = () => {
        const pages = (p.handbook || []).map((id) => catalog.pageById(id)).filter(Boolean);
        return `<h1>Notes</h1>
          <p class="muted">Memory joggers for this kind of problem — the approach, not the answer.</p>
          ${p.notes_md ? `<details class="fold"><summary>Approach notes <span class="muted small" style="font-weight:400">— a nudge that may name the technique</span></summary><div class="fold-body">${md(p.notes_md)}</div></details>` : ""}
          <h2>Topics</h2><div class="row">${p.topics.map(topicChip).join("")}</div>
          ${pages.length ? `<h2>Handbook</h2><ul>${pages.map((pg) => `<li><a href="${pageHref(pg.id)}">${esc(pg.title)}</a> <span class="muted small">— ${esc(pg.group)}</span></li>`).join("")}</ul>` : ""}
          <h2>Before you write</h2>
          <ol><li><b>Grain:</b> what does one output row represent?</li><li><b>Joins:</b> can a join multiply rows? Aggregate before joining.</li>
          <li><b>NULLs and missing matches:</b> LEFT JOIN, COUNT(col), NOT IN.</li><li><b>Ties and duplicates:</b> which rank function, which tie-breaker?</li>
          <li><b>Boundaries:</b> half-open date ranges, inclusive vs exclusive, time zones.</li></ol>`;
      };

      const submissionsHtml = () => {
        const e = state.get(key);
        const subs = [...(e.submissions || [])].reverse();
        const verdictCls = { accepted: "ok", wrong: "bad", error: "bad" };
        const verdictTxt = { accepted: "Accepted", wrong: "Wrong answer", error: "Error" };
        return `<h1>Submissions</h1>
          <div class="row" style="margin-bottom:12px">${statusIcon(key)}<span>${e.status === "solved" ? `Solved ${e.completed_at ? fmtStamp(e.completed_at) : ""}` : e.status === "attempted" ? "Attempted" : "Not started"}</span>
            <span class="grow"></span>
            <button class="btn sm" data-act="complete">${e.status === "solved" ? "Practised again" : "Mark as solved"}</button>
            ${e.status !== "solved" ? `<button class="btn ghost sm" data-act="attempt">Mark attempted</button>` : ""}
            ${(e.history || []).length ? `<button class="btn ghost sm" data-act="undo">Undo last</button>` : ""}</div>
          ${subs.length ? `<ul class="sub-list">${subs.map((s, i) => {
            const id = `sub-${i}`;
            codeStore.set(id, s.sql);
            return `<li><span class="${verdictCls[s.verdict]}">${verdictTxt[s.verdict]}</span><code title="${esc(s.sql)}">${esc(s.sql.replace(/\s+/g, " ").slice(0, 140))}</code>
              <span class="row small muted">${fmtStamp(s.at)} · ${s.dialect === "tsql" ? "SQL Server" : "MySQL"} · ${s.ms} ms <button class="btn ghost sm" data-load="${id}">Load</button></span></li>`;
          }).join("")}</ul>` : `<div class="empty-state"><b>No submissions yet</b>Write a query and press Submit — every attempt is kept here.</div>`}`;
      };

      body.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-act], [data-goto]");
        if (!b) return;
        if (b.dataset.goto) { current = b.dataset.goto; history.replaceState(null, "", problemHref(key, current)); paintTab(); return; }
        const act = b.dataset.act;
        if (act === "reveal") state.setRevealed(key, true);
        else if (act === "hide") state.setRevealed(key, false);
        else if (act === "complete") { const v = editor.value; state.complete(key, { answer_sql: v.trim() === starter(dialect).trim() ? "" : v }); toast("Marked as solved."); }
        else if (act === "attempt") state.attempt(key);
        else if (act === "undo") state.undo(key);
        paintTab();
      });
      // "Load into editor" from solutions / submissions
      root.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-load]");
        if (!b) return;
        const sql = codeStore.get(b.dataset.load);
        if (sql == null) return;
        editor.value = sql;
        lsSet(draftKey(dialect), sql);
        if (dialect !== "mysql") toast("Loaded a MySQL query — switch the dialect to MySQL to run it as written.");
        editor.focus();
      });

      // ---------------- editor actions
      dialectSel.addEventListener("change", () => {
        lsSet(draftKey(dialect), editor.value);
        dialect = dialectSel.value;
        lsSet("sqlpedia.dialect", dialect);
        editor.value = lsGet(draftKey(dialect)) ?? starter(dialect);
        root.querySelector("#engineNote").textContent = dialect === "tsql" ? "SQL Server is emulated" : "";
      });
      root.querySelector("#engineNote").textContent = dialect === "tsql" ? "SQL Server is emulated" : "";
      root.querySelector("#resetBtn").addEventListener("click", () => {
        if (!confirm("Replace the editor contents with the starter query?")) return;
        editor.value = starter(dialect);
        lsSet(draftKey(dialect), editor.value);
      });
      root.querySelector("#runBtn").addEventListener("click", () => run(false));
      root.querySelector("#submitBtn").addEventListener("click", () => run(true));

      let busy = false;
      async function run(submit) {
        if (busy) return;
        if (submit && !autoParts.length) return;
        busy = true;
        const btns = [root.querySelector("#runBtn"), root.querySelector("#submitBtn")];
        btns.forEach((b) => (b.disabled = true));
        outTitle.textContent = submit ? "Checking…" : "Running…";
        outMeta.textContent = "";
        out.innerHTML = `<div class="row muted"><span class="spinner"></span> Starting the SQL engine (the first run downloads it, a few seconds)…</div>`;
        const sql = editor.value;
        const res = await runSql({ setup, sql, dialect });
        busy = false;
        btns.forEach((b) => (b.disabled = false));
        if (!autoParts.length) btns[1].disabled = true;
        const note = dialect === "tsql" ? `<div class="engine-note" style="margin-top:8px">${esc(NOTES.tsql)}</div>` : "";
        if (!submit) {
          outTitle.textContent = "Result";
          out.innerHTML = resultHtml(res) + note;
          return;
        }
        const partSel = root.querySelector("#partSel");
        const part = autoParts.find((x) => x.label === (partSel ? partSel.value : autoParts[0].label));
        if (!res.ok || !res.columns.length) {
          state.submit(key, { verdict: "error", dialect, sql, ms: res.ms || 0 });
          outTitle.innerHTML = `<span class="verdict err">${res.ok ? "No result" : "Error"}</span>`;
          out.innerHTML = res.ok ? `<div class="muted">Your script didn't return a result set. End it with a SELECT.</div>` : resultHtml(res);
          if (current === "submissions") paintTab();
          return;
        }
        const v = judge(part.expected, res);
        state.submit(key, { verdict: v.verdict, dialect, sql, ms: res.ms });
        outMeta.textContent = `${res.ms} ms`;
        const warn = v.warnings.map((w) => `<div class="callout warn small">${esc(w)}</div>`).join("");
        if (v.verdict === "accepted") {
          outTitle.innerHTML = `<span class="verdict ok">Accepted</span>`;
          out.innerHTML = `<div class="callout ok"><span class="title">Correct — ${res.rows.length} row${res.rows.length === 1 ? "" : "s"} match the expected output.</span>Compare with other approaches in the Solution tab.</div>${warn}` + resultHtml(res) + note;
        } else {
          outTitle.innerHTML = `<span class="verdict bad">Wrong answer</span>`;
          const diff = v.missing || v.extra ? `<div class="diff-grid">
              <div><div class="small muted" style="margin-bottom:4px">Expected but missing (${v.missing.length})</div>${dataTable(part.expected.columns, v.missing, { rowClass: () => "miss" })}</div>
              <div><div class="small muted" style="margin-bottom:4px">Returned but not expected (${v.extra.length})</div>${dataTable(res.columns, v.extra, { rowClass: () => "extra" })}</div></div>` : "";
          out.innerHTML = `<div class="callout bad">${esc(v.reason)}</div>${warn}${diff}
            <details class="fold"><summary>Your full result</summary><div class="fold-body">${resultHtml(res)}</div></details>
            <details class="fold"><summary>Expected output</summary><div class="fold-body">${dataTable(part.expected.columns, part.expected.rows, { tall: true })}</div></details>${note}`;
        }
        if (current === "submissions") paintTab();
      }

      // ---------------- resizable split
      const ws = root.querySelector("#ws"), split = root.querySelector("#split");
      const saved = Number(lsGet("sqlpedia.split", "48"));
      ws.style.setProperty("--left", `${Math.min(70, Math.max(30, saved))}%`);
      const setFrom = (x) => {
        const r = ws.getBoundingClientRect();
        const pct = Math.min(70, Math.max(30, ((x - r.left) / r.width) * 100));
        ws.style.setProperty("--left", `${pct}%`);
        lsSet("sqlpedia.split", String(Math.round(pct)));
      };
      split.addEventListener("pointerdown", (e) => {
        split.setPointerCapture(e.pointerId); split.classList.add("drag");
        const move = (ev) => setFrom(ev.clientX);
        const up = () => { split.classList.remove("drag"); split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); };
        split.addEventListener("pointermove", move); split.addEventListener("pointerup", up);
      });
      split.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const cur = parseFloat(ws.style.getPropertyValue("--left")) || 48;
        const r = ws.getBoundingClientRect();
        setFrom(r.left + ((cur + (e.key === "ArrowLeft" ? -3 : 3)) / 100) * r.width);
      });

      const off = state.onChange(() => { if (current !== "question") return; const m = body.querySelector(".ws-meta .status-ic"); if (m) m.outerHTML = statusIcon(key); });
      paintTab();
      return () => off();
    },
  };
}
