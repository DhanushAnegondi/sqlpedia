# Errors — 2026-10-07

- Navbox overflow (page 2714px wide at 1366px) -> links joined with no whitespace, so no line-break opportunity -> join with ' · ' spaced. site/js/views/parts.js.
- Copy setup.sql did nothing -> handler matched [data-copy] only, buttons use data-copy-text -> selector covers both. site/js/app.js.
- Main page "nULLs" -> blind lowercase of first char -> only lowercase when 2nd char is lowercase. site/js/views/main.js.
- Background browser tab navigation denied (localhost and 127.0.0.1) -> tested in the user's tab with a storage snapshot/restore instead.
- Docker daemon not running, no MySQL creds -> ports unexecuted; reviewer reasoned statically; user to run in Workbench.
