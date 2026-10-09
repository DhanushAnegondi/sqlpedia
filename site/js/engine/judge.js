// Compare a query result with the expected output.
// Rows are compared as a multiset (order ignored) unless `ordered`; numbers within 0.005;
// a DATETIME at midnight equals the DATE; booleans equal 1/0; column names only warn.

function norm(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(s)) return { n: Number(s) };
  if (s === "true") return { n: 1 };
  if (s === "false") return { n: 0 };
  if (/^\d{4}-\d{2}-\d{2} 00:00:00(\.0+)?$/.test(s)) s = s.slice(0, 10);
  return { s };
}
function same(a, b) {
  const x = norm(a), y = norm(b);
  if (x === null || y === null) return x === null && y === null;
  if ("n" in x && "n" in y) return Math.abs(x.n - y.n) <= 0.005 + 1e-9;
  return x.s === y.s && x.s !== undefined;
}
const rowEq = (a, b) => a.length === b.length && a.every((v, i) => same(v, b[i]));
const keyOf = (r) => JSON.stringify(r.map((v) => { const n = norm(v); return n === null ? null : "n" in n ? Math.round(n.n * 100) / 100 : n.s; }));

export function judge(expected, result, { ordered = false } = {}) {
  const exp = expected.rows, got = result.rows;
  const warnings = [];
  // An empty expected result is stored without column names (MySQL exports none for 0 rows).
  if (!expected.columns.length && !exp.length)
    return got.length ? { verdict: "wrong", reason: `Expected no rows; you returned ${got.length}.`, missing: [], extra: got, warnings } : { verdict: "accepted", warnings };
  if (result.columns.length !== expected.columns.length)
    return { verdict: "wrong", reason: `Your result has ${result.columns.length} column(s); expected ${expected.columns.length} (${expected.columns.join(", ")}).`, missing: [], extra: [], warnings };
  const renamed = expected.columns.filter((c, i) => String(result.columns[i]).toLowerCase() !== String(c).toLowerCase());
  if (renamed.length) warnings.push(`Column names differ from the expected (${expected.columns.join(", ")}) — values were compared by position.`);

  // multiset matching
  const pool = got.map((r, i) => ({ r, i, used: false }));
  const missing = [];
  for (const e of exp) {
    const hit = pool.find((p) => !p.used && rowEq(e, p.r));
    if (hit) hit.used = true; else missing.push(e);
  }
  const extra = pool.filter((p) => !p.used).map((p) => p.r);
  if (!missing.length && !extra.length) {
    if (ordered && !exp.every((e, i) => rowEq(e, got[i])))
      return { verdict: "wrong", reason: "Right rows, wrong order. Check the ORDER BY the question asks for.", missing: [], extra: [], warnings };
    return { verdict: "accepted", warnings };
  }
  const reason = `${missing.length} expected row(s) missing, ${extra.length} unexpected row(s).` +
    (got.length !== exp.length ? ` You returned ${got.length} row(s); expected ${exp.length}.` : "");
  return { verdict: "wrong", reason, missing, extra, warnings };
}

export { keyOf };
