// Lightweight SQL editor: a transparent <textarea> over a highlighted <pre>, with a line gutter.
// Keys: Tab / Shift+Tab indent, Enter keeps indentation, Ctrl/Cmd+Enter = run, Ctrl/Cmd+Shift+Enter = submit.

import { highlightSql, esc } from "../util.js";

const LINE = 20.8; // 13px * 1.6
const PAD = 28;    // top + bottom padding

export function createEditor(host, { value = "", onRun, onSubmit, onChange, autoHeight = false, label = "SQL editor" } = {}) {
  host.classList.add("editor");
  if (autoHeight) host.classList.add("small");
  host.innerHTML = `<div class="gutter" aria-hidden="true"></div><pre aria-hidden="true"><code></code></pre>` +
    `<textarea spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="${esc(label)}"></textarea>`;
  const ta = host.querySelector("textarea");
  const code = host.querySelector("code");
  const pre = host.querySelector("pre");
  const gutter = host.querySelector(".gutter");
  ta.value = value;

  const paint = () => {
    code.innerHTML = highlightSql(ta.value) + "\n";
    const lines = ta.value.split("\n").length;
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join("");
    if (autoHeight) host.style.height = `${Math.min(Math.max(lines, 2), 24) * LINE + PAD}px`;
  };
  const sync = () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; };

  const replaceSel = (text, selStart, selEnd) => {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    if (selStart !== undefined) ta.setSelectionRange(selStart, selEnd);
    ta.dispatchEvent(new Event("input"));
  };

  ta.addEventListener("input", () => { paint(); sync(); onChange && onChange(ta.value); });
  ta.addEventListener("scroll", sync);
  ta.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "Enter") { e.preventDefault(); (e.shiftKey ? onSubmit : onRun)?.(); return; }
    if (e.key === "Tab" && !mod && !e.altKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      if (e.shiftKey || s !== en) {
        const block = v.slice(lineStart, en);
        const out = e.shiftKey ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, "  ");
        ta.setSelectionRange(lineStart, en);
        replaceSel(out, lineStart, lineStart + out.length);
      } else replaceSel("  ");
      return;
    }
    if (e.key === "Enter" && !mod) {
      const v = ta.value, s = ta.selectionStart;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      const indent = (v.slice(lineStart, s).match(/^\s*/) || [""])[0];
      if (indent) { e.preventDefault(); replaceSel("\n" + indent); }
    }
  });
  paint();

  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; paint(); sync(); },
    focus() { ta.focus(); },
    element: ta,
  };
}
