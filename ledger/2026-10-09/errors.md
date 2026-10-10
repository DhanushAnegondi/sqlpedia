# Errors — 2026-10-09 (session 2)

## Session 3
- fill_expected.py intermittently reports "<id> solution 2: returned no result set" on a random problem (seen in parts 3, 6); re-runs pass. Suspect concurrent load on the throwaway MySQL from 4-7 writers. To check once writers finish: run all parts sequentially; if it persists, retry/inspect stderr in verify_mysql.run.
  Resolved: cause = Windows ephemeral port exhaustion (ERROR 2003 ... (10048)) from 7 writers each spawning a mysql.exe per query. Sequential runs are clean (93/93). Next time: stagger writers' verifier runs or accept re-runs.

- Focus restore after a filter toggle did nothing in the hidden preview pane → requestAnimationFrame never fires while
  the document is hidden → focus directly in mount (DOM is already in place).
- Browser served stale library.js / catalog.json after rebuild → python http.server cache; forced reload via fetch(cache:'reload').
