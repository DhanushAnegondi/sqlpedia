# Errors — 2026-10-09 (session 2)

- Focus restore after a filter toggle did nothing in the hidden preview pane → requestAnimationFrame never fires while
  the document is hidden → focus directly in mount (DOM is already in place).
- Browser served stale library.js / catalog.json after rebuild → python http.server cache; forced reload via fetch(cache:'reload').
