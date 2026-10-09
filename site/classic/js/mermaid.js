// Lazy mermaid renderer for ER diagrams. Loaded only when a page has a diagram.
// Pinned version; if the CDN is unreachable the figure falls back to the source text.

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";
let mod = null;
let seq = 0;
const escHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export async function renderDiagrams(root, rerender = false) {
  const figs = [...root.querySelectorAll("figure.diagram")];
  if (!figs.length) return;
  try {
    mod ||= (await import(MERMAID_URL)).default;
  } catch {
    for (const f of figs) {
      const src = f.querySelector(".mermaid-src");
      const out = f.querySelector(".mermaid-out");
      if (src && out && !out.innerHTML) out.innerHTML = `<pre>${escHtml(src.textContent)}</pre>`;
    }
    return;
  }
  mod.initialize({
    startOnLoad: false,
    theme: isDark() ? "dark" : "neutral",
    securityLevel: "strict",
    fontFamily: "sans-serif",
    er: { useMaxWidth: true },
  });
  for (const f of figs) {
    const out = f.querySelector(".mermaid-out");
    if (!out || (out.dataset.done && !rerender)) continue;
    try {
      const { svg } = await mod.render(`mmd-${++seq}`, f.querySelector(".mermaid-src").textContent);
      out.innerHTML = svg;
      out.dataset.done = "1";
    } catch (e) {
      out.innerHTML = `<pre>${escHtml(f.querySelector(".mermaid-src").textContent)}</pre>`;
    }
  }
}
