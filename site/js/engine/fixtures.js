// Build MySQL DDL + INSERTs for a problem's own tables (per-question fixtures).
// tables: [{ name, columns: [{ name, type }], rows: [[...]] }]

const sqlLit = (v) => (v === null || v === undefined ? "NULL"
  : typeof v === "number" ? String(v)
  : typeof v === "boolean" ? (v ? "1" : "0")
  : "'" + String(v).replace(/'/g, "''") + "'");

export function tablesToSql(tables = []) {
  const parts = [];
  for (const t of [...tables].reverse()) parts.push(`DROP TABLE IF EXISTS ${t.name}`);
  for (const t of tables) {
    parts.push(`CREATE TABLE ${t.name} (\n  ${t.columns.map((c) => `${c.name} ${c.type}`).join(",\n  ")}\n)`);
    if (t.rows.length)
      parts.push(`INSERT INTO ${t.name} (${t.columns.map((c) => c.name).join(", ")}) VALUES\n  ` +
        t.rows.map((r) => `(${r.map(sqlLit).join(", ")})`).join(",\n  "));
  }
  return parts.join(";\n") + ";";
}
