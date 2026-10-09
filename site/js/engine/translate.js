// Translate MySQL 8.0 or SQL Server (T-SQL) into DuckDB SQL for the in-browser engine.
//
// Scope: the functions and syntax used in SQLpedia's problems and handbook, plus the common
// interview vocabulary. Anything outside that raises a TranslateError with a plain message
// instead of silently returning a different answer. Pure ES module: runs in the browser and
// in Node (scripts/verify/engine_check.mjs tests it against real MySQL results).

export class TranslateError extends Error {}

// ------------------------------------------------------------------ tokenizer

function tokenize(sql, dialect) {
  const toks = [];
  let i = 0;
  const n = sql.length;
  const push = (type, text) => toks.push({ type, text });
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(sql[j])) j++; push("ws", sql.slice(i, j)); i = j; continue; }
    if (c === "-" && d === "-") { let j = sql.indexOf("\n", i); if (j < 0) j = n; push("ws", " "); i = j; continue; }
    if (c === "#" && dialect === "mysql") { let j = sql.indexOf("\n", i); if (j < 0) j = n; push("ws", " "); i = j; continue; }
    if (c === "/" && d === "*") { let j = sql.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; push("ws", " "); i = j; continue; }
    if (c === "'" || (c === '"' && dialect === "mysql") || ((c === "N" || c === "n") && d === "'" && dialect === "tsql" && !/[A-Za-z0-9_]/.test(sql[i - 1] || ""))) {
      const q = c === "N" || c === "n" ? "'" : c;
      let j = (c === "N" || c === "n") ? i + 2 : i + 1;
      let val = "";
      while (j < n) {
        if (sql[j] === "\\" && dialect === "mysql" && j + 1 < n) {
          const e = sql[j + 1];
          val += e === "n" ? "\n" : e === "t" ? "\t" : e === "r" ? "\r" : e === "0" ? "\0" : e === "Z" ? "\x1a" : (e === "%" || e === "_") ? "\\" + e : e;
          j += 2; continue;
        }
        if (sql[j] === q) { if (sql[j + 1] === q) { val += q; j += 2; continue; } j++; break; }
        val += sql[j++];
      }
      push("str", "'" + val.replace(/'/g, "''") + "'");
      i = j; continue;
    }
    if (c === "`" && dialect === "mysql") { const j = sql.indexOf("`", i + 1); if (j < 0) throw new TranslateError("Unclosed backtick."); push("ident", '"' + sql.slice(i + 1, j) + '"'); i = j + 1; continue; }
    if (c === "[" && dialect === "tsql") { const j = sql.indexOf("]", i + 1); if (j < 0) throw new TranslateError("Unclosed [bracket]."); push("ident", '"' + sql.slice(i + 1, j) + '"'); i = j + 1; continue; }
    if (c === '"') { const j = sql.indexOf('"', i + 1); if (j < 0) throw new TranslateError('Unclosed "quote".'); push("ident", sql.slice(i, j + 1)); i = j + 1; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(d || ""))) { let j = i; while (j < n && /[0-9.eE]/.test(sql[j])) j++; push("num", sql.slice(i, j)); i = j; continue; }
    if (/[A-Za-z_@#$]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_$#@]/.test(sql[j])) j++; push("word", sql.slice(i, j)); i = j; continue; }
    const three = sql.slice(i, i + 3), two = sql.slice(i, i + 2);
    if (three === "<=>") { push("op", three); i += 3; continue; }
    if (["<=", ">=", "<>", "!=", "||", "::", "//"].includes(two)) { push("op", two); i += 2; continue; }
    push(c === "(" || c === ")" || c === "," || c === ";" ? c : "op", c);
    i++;
  }
  return toks;
}

const W = (t, w) => t && t.type === "word" && t.text.toUpperCase() === w;
const isWs = (t) => t && t.type === "ws";
const text = (toks) => toks.map((t) => t.text).join("");

function nextNonWs(toks, i) { while (i < toks.length && isWs(toks[i])) i++; return i; }

function matchParen(toks, open) {
  let depth = 0;
  for (let i = open; i < toks.length; i++) {
    if (toks[i].type === "(") depth++;
    else if (toks[i].type === ")") { depth--; if (depth === 0) return i; }
  }
  throw new TranslateError("Unbalanced parentheses.");
}

function splitArgs(toks) {
  const out = [[]];
  let depth = 0;
  for (const t of toks) {
    if (t.type === "(") depth++;
    if (t.type === ")") depth--;
    if (t.type === "," && depth === 0) { out.push([]); continue; }
    out[out.length - 1].push(t);
  }
  return out.length === 1 && !out[0].some((t) => !isWs(t)) ? [] : out;
}

// ------------------------------------------------------------------ helpers

const trimT = (s) => s.trim();
const unquote = (s) => { const m = s.trim().match(/^'(.*)'$/s); return m ? m[1].replace(/''/g, "'") : null; };
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const UNIT = {
  year: "year", yy: "year", yyyy: "year", years: "year",
  quarter: "quarter", qq: "quarter", q: "quarter",
  month: "month", mm: "month", m: "month", months: "month",
  week: "week", wk: "week", ww: "week", weeks: "week",
  day: "day", dd: "day", d: "day", days: "day", dayofyear: "dayofyear", dy: "dayofyear", y: "dayofyear",
  weekday: "weekday", dw: "weekday",
  hour: "hour", hh: "hour", hours: "hour",
  minute: "minute", mi: "minute", n: "minute", minutes: "minute",
  second: "second", ss: "second", s: "second", seconds: "second",
  microsecond: "microsecond", mcs: "microsecond", millisecond: "millisecond", ms: "millisecond",
  iso_week: "isoweek", isowk: "isoweek", isoww: "isoweek",
};
function unit(raw) {
  const u = UNIT[String(raw).trim().replace(/^'|'$/g, "").toLowerCase()];
  if (!u) throw new TranslateError(`Unknown date part "${raw.trim()}".`);
  return u;
}
// '2024-03-15' / '2024-03-15 10:00:00' literals -> typed, so date functions accept them like MySQL / SQL Server do.
function asTemporal(x) {
  const v = unquote(x);
  if (v === null) return x;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `DATE ${x.trim()}`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) return `TIMESTAMP ${x.trim()}`;
  return x;
}

function addInterval(d, n, u) {
  d = asTemporal(d);
  if (u === "quarter") return `(${d} + INTERVAL (3 * (${n})) MONTH)`;
  if (u === "dayofyear" || u === "weekday") u = "day";
  return `(${d} + INTERVAL (${n}) ${u.toUpperCase()})`;
}

// MySQL DATE_FORMAT / STR_TO_DATE specifiers -> strftime
const MYSQL_FMT = { Y: "%Y", y: "%y", m: "%m", c: "%-m", d: "%d", e: "%-d", H: "%H", k: "%-H", h: "%I", I: "%I", l: "%-I",
  i: "%M", s: "%S", S: "%S", p: "%p", M: "%B", b: "%b", W: "%A", a: "%a", j: "%j", f: "%f", T: "%H:%M:%S",
  r: "%I:%M:%S %p", U: "%U", u: "%W", w: "%w", "%": "%%" };
function mysqlFmt(f) {
  return f.replace(/%(.)/g, (_, ch) => {
    if (!(ch in MYSQL_FMT)) throw new TranslateError(`DATE_FORMAT specifier %${ch} is not supported in the browser engine.`);
    return MYSQL_FMT[ch];
  });
}
// .NET custom date format (SQL Server FORMAT) -> strftime
function dotnetFmt(f) {
  const map = [["yyyy", "%Y"], ["yy", "%y"], ["MMMM", "%B"], ["MMM", "%b"], ["MM", "%m"], ["M", "%-m"], ["dddd", "%A"], ["ddd", "%a"],
    ["dd", "%d"], ["d", "%-d"], ["HH", "%H"], ["H", "%-H"], ["hh", "%I"], ["h", "%-I"], ["mm", "%M"], ["ss", "%S"], ["tt", "%p"]];
  let out = "", i = 0;
  while (i < f.length) {
    const hit = map.find(([k]) => f.startsWith(k, i));
    if (hit) { out += hit[1]; i += hit[0].length; } else { out += f[i] === "%" ? "%%" : f[i]; i++; }
  }
  return out;
}
const CONVERT_STYLE = { 23: "%Y-%m-%d", 120: "%Y-%m-%d %H:%M:%S", 121: "%Y-%m-%d %H:%M:%S.%f", 126: "%Y-%m-%dT%H:%M:%S",
  112: "%Y%m%d", 101: "%m/%d/%Y", 103: "%d/%m/%Y", 104: "%d.%m.%Y", 108: "%H:%M:%S", 110: "%m-%d-%Y", 111: "%Y/%m/%d" };

function mapType(t, dialect) {
  let s = t.trim();
  const u = s.toUpperCase();
  if (/^(N?VARCHAR|N?CHAR|N?TEXT|CHARACTER)\b/.test(u) || u === "CHAR") return "VARCHAR";
  if (/^SIGNED/.test(u)) return "BIGINT";
  if (/^UNSIGNED/.test(u)) return "UBIGINT";
  if (/^(DATETIME2?|SMALLDATETIME|DATETIMEOFFSET)\b/.test(u)) return "TIMESTAMP";
  if (u === "BIT") return "BOOLEAN";
  if (u === "MONEY") return "DECIMAL(19,4)";
  if (/^TINYINT\s*\(\s*1\s*\)$/.test(u)) return dialect === "mysql" ? "TINYINT" : s;
  if (/^(INT|INTEGER|BIGINT|SMALLINT|TINYINT|MEDIUMINT)\s*\(\d+\)/.test(u)) return u.replace(/\s*\(\d+\)/, "").replace("MEDIUMINT", "INTEGER");
  if (u === "MEDIUMINT") return "INTEGER";
  if (/^ENUM\s*\(/.test(u)) return "VARCHAR";
  return s;
}

// ------------------------------------------------------------------ function rules

const DATE_FNS_1 = ["YEAR", "MONTH", "DAY", "QUARTER", "HOUR", "MINUTE", "SECOND", "DAYNAME", "MONTHNAME", "DAYOFYEAR", "LAST_DAY"];
const COMMON = {
  ...Object.fromEntries(DATE_FNS_1.map((f) => [f, (a) => `${f.toLowerCase()}(${a.map(asTemporal).join(", ")})`])),
  CAST(a, ctx) {
    const inner = ctx.rawArgs[0];
    const asAt = findTopWord(inner, "AS");
    if (asAt < 0) throw new TranslateError("CAST needs AS <type>.");
    const expr = ctx.tx(inner.slice(0, asAt));
    return `CAST(${expr} AS ${mapType(text(inner.slice(asAt + 1)), ctx.dialect)})`;
  },
  TRY_CAST(a, ctx) { return COMMON.CAST(a, ctx).replace(/^CAST/, "TRY_CAST"); },
  NULLIF: (a) => `NULLIF(${a[0]}, ${a[1]})`,
  COALESCE: (a) => `COALESCE(${a.join(", ")})`,
};

const MYSQL = {
  CONCAT: (a) => (a.length === 1 ? `CAST(${a[0]} AS VARCHAR)` : `(${a.map((x) => `CAST(${x} AS VARCHAR)`).join(" || ")})`),
  GROUP_CONCAT(a, ctx) {
    // GROUP_CONCAT([DISTINCT] expr [ORDER BY ...] [SEPARATOR 'x'])
    let toks = ctx.rawArgsJoined;
    let sep = "','";
    const sepAt = findTopWord(toks, "SEPARATOR");
    if (sepAt >= 0) { sep = text(toks.slice(sepAt + 1)).trim(); toks = toks.slice(0, sepAt); }
    const ordAt = findTopWord(toks, "ORDER");
    let order = "";
    if (ordAt >= 0) { order = " " + ctx.tx(toks.slice(ordAt)); toks = toks.slice(0, ordAt); }
    let distinct = "";
    const first = nextNonWs(toks, 0);
    if (W(toks[first], "DISTINCT")) { distinct = "DISTINCT "; toks = toks.slice(first + 1); }
    const arg = ctx.tx(toks).trim();
    if (distinct && order) {
      const m = order.trim().match(/^ORDER\s+BY\s+([\s\S]+?)(\s+(ASC|DESC))?$/i);
      if (m && m[1].trim() === arg) order = ` ORDER BY CAST(${arg} AS VARCHAR)${m[2] || ""}`;
      else throw new TranslateError("GROUP_CONCAT(DISTINCT x ORDER BY y) only works in the browser engine when y is x.");
    }
    return `string_agg(${distinct}CAST(${arg} AS VARCHAR), ${sep}${order})`;
  },
  DATE_FORMAT(a) {
    a = [asTemporal(a[0]), a[1]];
    const f = unquote(a[1]);
    if (f === null) throw new TranslateError("DATE_FORMAT needs a literal format string in the browser engine.");
    return `strftime(${a[0]}, ${lit(mysqlFmt(f))})`;
  },
  STR_TO_DATE(a) {
    const f = unquote(a[1]);
    if (f === null) throw new TranslateError("STR_TO_DATE needs a literal format string in the browser engine.");
    const hasTime = /%[HhIiklsSpTrf]/.test(f);
    return `CAST(strptime(${a[0]}, ${lit(mysqlFmt(f))}) AS ${hasTime ? "TIMESTAMP" : "DATE"})`;
  },
  DATEDIFF: (a) => {
    if (a.length !== 2) throw new TranslateError("MySQL DATEDIFF takes two arguments: DATEDIFF(later, earlier).");
    return `date_diff('day', CAST(${asTemporal(a[1])} AS DATE), CAST(${asTemporal(a[0])} AS DATE))`;
  },
  TIMESTAMPDIFF: (a) => `date_sub('${unit(a[0])}', CAST(${a[1]} AS TIMESTAMP), CAST(${a[2]} AS TIMESTAMP))`,
  PERIOD_DIFF: (a) => `(((${a[0]}) // 100 * 12 + (${a[0]}) % 100) - ((${a[1]}) // 100 * 12 + (${a[1]}) % 100))`,
  PERIOD_ADD: (a) => `((((${a[0]}) // 100 * 12 + (${a[0]}) % 100 - 1 + (${a[1]})) // 12) * 100 + (((${a[0]}) // 100 * 12 + (${a[0]}) % 100 - 1 + (${a[1]})) % 12) + 1)`,
  TIMESTAMPADD: (a) => addInterval(a[2], a[1], unit(a[0])),
  DATE_ADD: (a) => (/^\s*INTERVAL\b/i.test(a[1]) ? `(${asTemporal(a[0])} + ${a[1]})` : addInterval(a[0], a[1], "day")),
  ADDDATE: (a) => MYSQL.DATE_ADD(a),
  DATE_SUB: (a) => (/^\s*INTERVAL\b/i.test(a[1]) ? `(${asTemporal(a[0])} - ${a[1]})` : `(${asTemporal(a[0])} - INTERVAL (${a[1]}) DAY)`),
  SUBDATE: (a) => MYSQL.DATE_SUB(a),
  CURDATE: () => "current_date", CURRENT_DATE: () => "current_date", SYSDATE: () => "now()", NOW: () => "now()",
  UTC_DATE: () => "current_date",
  DATE: (a) => `CAST(${a[0]} AS DATE)`,
  TIME: (a) => `CAST(${a[0]} AS TIME)`,
  DAYOFWEEK: (a) => `(dayofweek(${asTemporal(a[0])}) + 1)`,
  WEEKDAY: (a) => `((dayofweek(${asTemporal(a[0])}) + 6) % 7)`,
  SUBSTRING: (a, ctx) => {
    if (ctx && findTopWord(ctx.rawArgsJoined, "FROM") >= 0) {
      const t = ctx.rawArgsJoined, f = findTopWord(t, "FROM"), g = findTopWord(t, "FOR");
      a = [ctx.tx(t.slice(0, f)).trim(), ctx.tx(t.slice(f + 1, g >= 0 ? g : t.length)).trim(), ...(g >= 0 ? [ctx.tx(t.slice(g + 1)).trim()] : [])];
    }
    return a[1] && a[1].trim() === "0" ? "''" : `substring(CAST(${a[0]} AS VARCHAR), ${a.slice(1).join(", ")})`;
  },
  SUBSTR: (a, ctx) => MYSQL.SUBSTRING(a, ctx),
  DAYOFMONTH: (a) => `day(${a[0]})`,
  WEEK: (a) => {
    const mode = a[1] ? a[1].trim() : "0";
    if (mode === "0") return `CAST(strftime(${asTemporal(a[0])}, '%U') AS INTEGER)`;
    if (mode === "3") return `week(${asTemporal(a[0])})`;
    if (mode === "1") { const d = asTemporal(a[0]); return `(CASE WHEN CAST(strftime(${d}, '%G') AS INTEGER) < year(${d}) THEN 0 WHEN CAST(strftime(${d}, '%G') AS INTEGER) > year(${d}) THEN 53 ELSE week(${d}) END)`; }
    throw new TranslateError(`WEEK(date, ${mode}) is not supported in the browser engine (modes 0, 1, 3 are).`);
  },
  YEARWEEK: (a) => {
    const mode = a[1] ? a[1].trim() : "0";
    if (mode === "3" || mode === "1") return `CAST(strftime(${a[0]}, '%G%V') AS INTEGER)`;
    // mode 0: year and Sunday-week of the Sunday that starts this date's week
    if (mode === "0") { const sun = `(CAST(${asTemporal(a[0])} AS DATE) - CAST(dayofweek(${asTemporal(a[0])}) AS INTEGER))`; return `(year(${sun}) * 100 + CAST(strftime(${sun}, '%U') AS INTEGER))`; }
    throw new TranslateError(`YEARWEEK(date, ${mode}) is not supported in the browser engine (modes 0 and 3 are).`);
  },
  CONVERT_TZ: (a) => {
    const off = (x) => {
      const m = (unquote(x) || "").match(/^([+-])(\d{1,2}):(\d{2})$/);
      if (!m) throw new TranslateError("CONVERT_TZ supports fixed offsets like '+00:00' in the browser engine, not named time zones.");
      return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    };
    return `(CAST(${a[0]} AS TIMESTAMP) + INTERVAL (${off(a[2]) - off(a[1])}) MINUTE)`;
  },
  MAKEDATE: (a) => `CAST(make_date(${a[0]}, 1, 1) + (${a[1]} - 1) AS DATE)`,
  UNIX_TIMESTAMP: (a) => (a.length ? `CAST(epoch(${a[0]}) AS BIGINT)` : "CAST(epoch(now()) AS BIGINT)"),
  FROM_UNIXTIME: (a) => `to_timestamp(${a[0]})`,
  LOCATE: (a) => (a.length === 3
    ? `(CASE WHEN instr(substring(${a[1]}, ${a[2]}), ${a[0]}) = 0 THEN 0 ELSE instr(substring(${a[1]}, ${a[2]}), ${a[0]}) + ${a[2]} - 1 END)`
    : `instr(${a[1]}, ${a[0]})`),
  POSITION: null,
  SUBSTRING_INDEX: (a) => `(CASE WHEN ${a[2]} >= 0 THEN array_to_string(string_split(${a[0]}, ${a[1]})[1:${a[2]}], ${a[1]}) ELSE array_to_string(string_split(${a[0]}, ${a[1]})[${a[2]}:], ${a[1]}) END)`,
  MID: (a) => `substring(${a.join(", ")})`,
  CHAR_LENGTH: (a) => `length(${a[0]})`, CHARACTER_LENGTH: (a) => `length(${a[0]})`,
  LENGTH: (a) => `strlen(${a[0]})`,
  LCASE: (a) => `lower(${a[0]})`, UCASE: (a) => `upper(${a[0]})`,
  SPACE: (a) => `repeat(' ', ${a[0]})`,
  STRCMP: (a) => `(CASE WHEN ${a[0]} < ${a[1]} THEN -1 WHEN ${a[0]} > ${a[1]} THEN 1 ELSE 0 END)`,
  FORMAT: (a) => `format('{:,.${unquote(a[1]) ?? a[1].trim()}f}', ${a[0]})`,
  TRUNCATE: (a) => `trunc(${a[0]}, ${a[1]})`,
  LOG: (a) => (a.length === 2 ? `(ln(${a[1]}) / ln(${a[0]}))` : `ln(${a[0]})`),
  RAND: () => "random()",
  ISNULL: (a) => `(${a[0]} IS NULL)`,
  GREATEST: (a) => `(CASE WHEN ${a.map((x) => `(${x}) IS NULL`).join(" OR ")} THEN NULL ELSE greatest(${a.join(", ")}) END)`,
  LEAST: (a) => `(CASE WHEN ${a.map((x) => `(${x}) IS NULL`).join(" OR ")} THEN NULL ELSE least(${a.join(", ")}) END)`,
  CONVERT(a, ctx) {
    if (findTopWord(ctx.rawArgsJoined, "USING") >= 0) return a[0].replace(/\s+USING\s+\w+$/i, "");
    return `CAST(${a[0]} AS ${mapType(a[1], "mysql")})`;
  },
};

const TSQL = {
  ISNULL: (a) => `COALESCE(${a[0]}, ${a[1]})`,
  IIF: (a) => `(CASE WHEN ${a[0]} THEN ${a[1]} ELSE ${a[2]} END)`,
  LEN: (a) => `length(rtrim(CAST(${a[0]} AS VARCHAR)))`,
  DATALENGTH: (a) => `strlen(CAST(${a[0]} AS VARCHAR))`,
  CHARINDEX: (a) => (a.length === 3
    ? `(CASE WHEN instr(substring(${a[1]}, ${a[2]}), ${a[0]}) = 0 THEN 0 ELSE instr(substring(${a[1]}, ${a[2]}), ${a[0]}) + ${a[2]} - 1 END)`
    : `instr(${a[1]}, ${a[0]})`),
  PATINDEX: () => { throw new TranslateError("PATINDEX is not supported in the browser engine."); },
  REPLICATE: (a) => `repeat(${a[0]}, ${a[1]})`,
  SPACE: (a) => `repeat(' ', ${a[0]})`,
  STUFF: (a) => `(substring(${a[0]}, 1, ${a[1]} - 1) || ${a[3]} || substring(${a[0]}, ${a[1]} + ${a[2]}))`,
  DATEADD: (a) => addInterval(a[2], a[1], unit(a[0])),
  DATEDIFF: (a) => {
    if (a.length !== 3) throw new TranslateError("SQL Server DATEDIFF takes three arguments: DATEDIFF(part, start, end).");
    const u = unit(a[0]);
    if (u === "week") {
      const sun = (x) => `(CAST(${asTemporal(x)} AS DATE) - CAST(dayofweek(${asTemporal(x)}) AS INTEGER))`;
      return `(date_diff('day', ${sun(a[1])}, ${sun(a[2])}) // 7)`;
    }
    return `date_diff('${u === "dayofyear" || u === "weekday" ? "day" : u}', ${asTemporal(a[1])}, ${asTemporal(a[2])})`;
  },
  DATEDIFF_BIG: (a) => TSQL.DATEDIFF(a),
  DATEPART: (a) => tsqlDatePart(unit(a[0]), asTemporal(a[1])),
  DATENAME: (a) => {
    const u = unit(a[0]);
    if (u === "month") return `monthname(${a[1]})`;
    if (u === "weekday") return `dayname(${a[1]})`;
    return `CAST(${tsqlDatePart(u, a[1])} AS VARCHAR)`;
  },
  DATETRUNC: (a) => { const u = unit(a[0]); return `date_trunc('${u === "isoweek" ? "week" : u}', ${asTemporal(a[1])})`; },
  EOMONTH: (a) => (a.length === 2 ? `last_day(CAST(${addInterval(a[0], a[1], "month")} AS DATE))` : `last_day(CAST(${asTemporal(a[0])} AS DATE))`),
  DATEFROMPARTS: (a) => `make_date(${a[0]}, ${a[1]}, ${a[2]})`,
  GETDATE: () => "now()", SYSDATETIME: () => "now()", GETUTCDATE: () => "now()", SYSUTCDATETIME: () => "now()",
  CONVERT(a, ctx) {
    const target = mapType(a[0], "tsql");
    if (a.length === 3 && (target.toUpperCase() === "DATE" || target === "TIMESTAMP")) {
      const f = CONVERT_STYLE[a[2].trim()];
      if (!f) throw new TranslateError(`CONVERT style ${a[2].trim()} is not supported in the browser engine.`);
      return `CAST(strptime(CAST(${a[1]} AS VARCHAR), ${lit(f)}) AS ${target})`;
    }
    if (a.length === 3 && target === "VARCHAR") {
      const f = CONVERT_STYLE[a[2].trim()];
      if (!f) throw new TranslateError(`CONVERT style ${a[2].trim()} is not supported in the browser engine.`);
      return `strftime(CAST(${a[1]} AS TIMESTAMP), ${lit(f)})`;
    }
    return `CAST(${a[1]} AS ${target})`;
  },
  TRY_CONVERT: (a) => `TRY_CAST(${a[1]} AS ${mapType(a[0], "tsql")})`,
  FORMAT(a) {
    const f = unquote(a[1]);
    if (f === null) throw new TranslateError("FORMAT needs a literal format string in the browser engine.");
    const num = f.match(/^([NnFf])(\d*)$/);
    if (num) return `format('{:${/[Nn]/.test(num[1]) ? "," : ""}.${num[2] || 2}f}', ${a[0]})`;
    if (/^[Pp](\d*)$/.test(f)) return `(format('{:.${f.slice(1) || 2}f}', (${a[0]}) * 100) || '%')`;
    return `strftime(CAST(${a[0]} AS TIMESTAMP), ${lit(dotnetFmt(f))})`;
  },
  LOG: (a) => (a.length === 2 ? `(ln(${a[0]}) / ln(${a[1]}))` : `ln(${a[0]})`),
  SQUARE: (a) => `((${a[0]}) * (${a[0]}))`,
  ROUND: (a) => (a.length === 3 && a[2].trim() !== "0" ? `trunc(${a[0]}, ${a[1]})` : `round(${a.slice(0, 2).join(", ")})`),
  RAND: () => "random()",
  CHOOSE: (a) => `[${a.slice(1).join(", ")}][${a[0]}]`,
  STRING_AGG: null, // handled with WITHIN GROUP lookahead
  NEWID: () => "uuid()",
  OPTION: () => "",   // OPTION (MAXRECURSION n) etc. - query hints have no effect in the browser engine
};

function tsqlDatePart(u, d) {
  if (u === "weekday") return `(dayofweek(${d}) + 1)`;
  if (u === "dayofyear") return `dayofyear(${d})`;
  if (u === "isoweek") return `week(${d})`;
  if (u === "week") return `(CAST(strftime(${d}, '%U') AS INTEGER) + CASE WHEN dayofweek(make_date(year(${d}), 1, 1)) = 0 THEN 0 ELSE 1 END)`;
  return `date_part('${u}', ${d})`;
}

const STRING_FIRST_ARG = new Set(["LEFT", "RIGHT", "SUBSTRING", "SUBSTR", "UPPER", "LOWER", "TRIM", "LTRIM", "RTRIM",
  "REPLACE", "LPAD", "RPAD", "REVERSE", "INSTR", "REPEAT"]);

// Functions that exist only in the other dialect (or only in DuckDB / Postgres). Accepting them would let
// a query pass here and then fail in Workbench / SSMS.
const NOT_MYSQL = { DATEADD: "DATE_ADD(d, INTERVAL n unit)", DATEPART: "EXTRACT / YEAR() / MONTH()", DATENAME: "DAYNAME() / MONTHNAME()",
  CHARINDEX: "LOCATE(sub, str) or INSTR(str, sub)", LEN: "CHAR_LENGTH()", GETDATE: "NOW()", IIF: "IF(cond, a, b)", EOMONTH: "LAST_DAY()",
  DATEFROMPARTS: "MAKEDATE / STR_TO_DATE", STRING_AGG: "GROUP_CONCAT()", REPLICATE: "REPEAT()", DATETRUNC: "DATE_FORMAT(d, '%Y-%m-01')",
  DATE_TRUNC: "DATE_FORMAT(d, '%Y-%m-01')", GENERATE_SERIES: "a recursive CTE", STRFTIME: "DATE_FORMAT()", STRPTIME: "STR_TO_DATE()",
  LIST: "GROUP_CONCAT()", ARRAY_AGG: "GROUP_CONCAT()", EPOCH: "UNIX_TIMESTAMP()", TRY_CAST: "CAST()", TRY_CONVERT: "CAST()", SQUARE: "POWER(x, 2)" };
const NOT_TSQL = { DATE_ADD: "DATEADD(unit, n, d)", DATE_SUB: "DATEADD(unit, -n, d)", DATE_FORMAT: "FORMAT(d, 'yyyy-MM') or CONVERT(VARCHAR, d, style)",
  GROUP_CONCAT: "STRING_AGG(x, ',') WITHIN GROUP (ORDER BY ...)", IFNULL: "ISNULL(a, b) or COALESCE", CURDATE: "CAST(GETDATE() AS DATE)",
  NOW: "GETDATE()", LOCATE: "CHARINDEX(sub, str)", INSTR: "CHARINDEX(sub, str)", CHAR_LENGTH: "LEN()", LAST_DAY: "EOMONTH()",
  STR_TO_DATE: "CONVERT(DATE, s, style)", TIMESTAMPDIFF: "DATEDIFF(unit, a, b)", SUBSTRING_INDEX: "CHARINDEX + SUBSTRING",
  IF: "IIF(cond, a, b)", DAYOFWEEK: "DATEPART(weekday, d)", WEEKDAY: "DATEPART(weekday, d)", MAKEDATE: "DATEFROMPARTS()",
  YEARWEEK: "DATEPART(year/week, d)", LPAD: "RIGHT(REPLICATE('0', n) + s, n)", RPAD: "LEFT(s + REPLICATE(' ', n), n)",
  DATE_TRUNC: "DATETRUNC(unit, d)", GENERATE_SERIES: "a recursive CTE", STRFTIME: "FORMAT()", STRPTIME: "CONVERT()", LIST: "STRING_AGG()",
  ARRAY_AGG: "STRING_AGG()", NTH_VALUE: "ROW_NUMBER() and a filter" };

function findTopWord(toks, w) {
  let depth = 0;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].type === "(") depth++;
    else if (toks[i].type === ")") depth--;
    else if (depth === 0 && W(toks[i], w)) return i;
  }
  return -1;
}

// ------------------------------------------------------------------ rewriter

function rewrite(toks, dialect) {
  const rules = dialect === "mysql" ? MYSQL : TSQL;
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];

    // function call: word followed by "("
    if (t.type === "word") {
      const up = t.text.toUpperCase();
      const j = nextNonWs(toks, i + 1);
      if (toks[j] && toks[j].type === "(" && !isKeywordNotFn(up)) {
        const close = matchParen(toks, j);
        const inner = toks.slice(j + 1, close);
        const rawArgs = splitArgs(inner);
        const tx = (ts) => text(rewrite(ts, dialect));
        const banned = (dialect === "mysql" ? NOT_MYSQL : NOT_TSQL)[up];
        if (banned) throw new TranslateError(`${t.text}() isn't ${dialect === "mysql" ? "MySQL" : "SQL Server"} syntax — use ${banned}.`);
        const rule = Object.prototype.hasOwnProperty.call(rules, up) ? rules[up] : (COMMON[up] || undefined);

        // STRING_AGG(x, sep) WITHIN GROUP (ORDER BY ...)
        if (up === "STRING_AGG") {
          const a = rawArgs.map((x) => tx(x).trim());
          let k = nextNonWs(toks, close + 1);
          let order = "";
          if (W(toks[k], "WITHIN")) {
            const g = nextNonWs(toks, k + 1);
            const p = nextNonWs(toks, g + 1);
            if (!W(toks[g], "GROUP") || toks[p].type !== "(") throw new TranslateError("Expected WITHIN GROUP (ORDER BY ...).");
            const pc = matchParen(toks, p);
            order = " " + tx(toks.slice(p + 1, pc)).trim();
            i = pc;
          } else i = close;
          out.push({ type: "raw", text: `string_agg(CAST(${a[0]} AS VARCHAR), ${a[1] ?? "','"}${order})` });
          continue;
        }
        if (rule === null) { /* explicitly native */ }
        else if (typeof rule === "function") {
          const args = rawArgs.map((x) => tx(x).trim());
          const repl = rule(args, { rawArgs, rawArgsJoined: inner, tx, dialect });
          out.push({ type: "raw", text: repl });
          i = close;
          continue;
        }
        // MySQL and SQL Server implicitly treat numbers/dates as text in string functions; DuckDB won't.
        if (STRING_FIRST_ARG.has(up) && rawArgs.length && findTopWord(inner, "FROM") < 0) {
          const args = rawArgs.map((x) => tx(x).trim());
          args[0] = `CAST(${args[0]} AS VARCHAR)`;
          out.push({ type: "raw", text: `${t.text}(${args.join(", ")})` });
          i = close;
          continue;
        }
        out.push(t, ...toks.slice(i + 1, j));
        out.push({ type: "(", text: "(" }, ...rewrite(inner, dialect), { type: ")", text: ")" });
        i = close;
        continue;
      }
    }

    if (dialect === "mysql") {
      // LIMIT offset, count  ->  LIMIT count OFFSET offset
      if (W(t, "LIMIT")) {
        const a = nextNonWs(toks, i + 1), c = nextNonWs(toks, a + 1), b = nextNonWs(toks, c + 1);
        if (toks[a]?.type === "num" && toks[c]?.type === "," && toks[b]?.type === "num") {
          out.push({ type: "raw", text: `LIMIT ${toks[b].text} OFFSET ${toks[a].text}` });
          i = b; continue;
        }
      }
      if (W(t, "DIV")) { out.push({ type: "op", text: "//" }); continue; }
      if (t.type === "op" && t.text === "||") { out.push({ type: "raw", text: " OR " }); continue; } // MySQL: || is logical OR
      if (W(t, "QUALIFY") || W(t, "ILIKE")) throw new TranslateError(`${t.text.toUpperCase()} isn't MySQL syntax.`);
      if (W(t, "TOP")) { const pv = [...out].reverse().find((x) => x.type !== "ws"); if (pv && (W(pv, "SELECT") || W(pv, "DISTINCT"))) throw new TranslateError("MySQL has no TOP — use LIMIT n at the end of the query."); }
      // MySQL LIKE is case-insensitive under the default collation.
      if (W(t, "LIKE")) { out.push({ type: "word", text: "ILIKE" }); continue; }
      if (W(t, "REGEXP") || W(t, "RLIKE")) throw new TranslateError("REGEXP is not supported in the browser engine yet; use LIKE.");
      if (t.type === "op" && t.text === "<=>") { out.push({ type: "raw", text: "IS NOT DISTINCT FROM" }); continue; }
      if (W(t, "AUTO_INCREMENT") || W(t, "UNSIGNED")) continue;  // DDL-only; CAST(... AS UNSIGNED) is handled by the CAST rule
    }

    if (dialect === "tsql") {
      if (W(t, "GO")) { out.push({ type: ";", text: ";" }); continue; }
      if (W(t, "WITH")) {
        const a = nextNonWs(toks, i + 1);
        const prev = [...out].reverse().find((x) => x.type !== "ws");
        const startsCte = toks[a] && (toks[a].type === "word" || toks[a].type === "ident") && !W(toks[a], "TIES") && !W(toks[a], "RECURSIVE");
        if (startsCte && !(prev && W(prev, "TOP"))) { out.push({ type: "raw", text: "WITH RECURSIVE" }); continue; }
      }
      if (W(t, "OPTION")) {
        const a = nextNonWs(toks, i + 1);
        if (toks[a] && toks[a].type === "(") { i = matchParen(toks, a); continue; }
      }
      if (W(t, "LIKE")) { out.push({ type: "word", text: "ILIKE" }); continue; }
      if (W(t, "TOP")) throw new TranslateError("TOP must directly follow SELECT.");
      if (W(t, "LIMIT")) throw new TranslateError("SQL Server has no LIMIT — use SELECT TOP (n) or OFFSET ... FETCH NEXT n ROWS ONLY.");
      if (W(t, "QUALIFY") || W(t, "ILIKE")) throw new TranslateError(`${t.text.toUpperCase()} isn't SQL Server syntax.`);
      if (t.type === "str" && /\[[^\]]+\]/.test(t.text) && [...out].reverse().find((x) => x.type !== "ws")?.text === "ILIKE")
        throw new TranslateError("LIKE character classes like [abc] aren't supported in the browser engine.");
      // string literal + x  /  x + string literal  ->  ||
      if (t.type === "op" && t.text === "+") {
        const prev = [...out].reverse().find((x) => x.type !== "ws");
        const nx = toks[nextNonWs(toks, i + 1)];
        if ((prev && prev.type === "str") || (nx && nx.type === "str")) { out.push({ type: "op", text: "||" }); continue; }
      }
      if (t.text.startsWith("@") || t.text.startsWith("#")) throw new TranslateError("Variables and #temp tables aren't supported in the browser engine.");
    }

    if (t.type === "op" && t.text === "::") throw new TranslateError(":: casts aren't MySQL or SQL Server syntax — use CAST(x AS type).");
    if (W(t, "FILTER") && toks[nextNonWs(toks, i + 1)]?.type === "(") throw new TranslateError("FILTER (WHERE ...) isn't MySQL or SQL Server syntax — use SUM(CASE WHEN ... THEN 1 ELSE 0 END).");

    // INTERVAL <expression> <unit>  ->  INTERVAL (<expression>) <unit>
    // (expression may be a literal, a column, a function call or a window function)
    if (W(t, "INTERVAL")) {
      let depth = 0, k = i + 1, unitAt = -1;
      for (; k < toks.length; k++) {
        const x = toks[k];
        if (x.type === "(") depth++;
        else if (x.type === ")") { if (depth === 0) break; depth--; }
        else if (depth === 0 && (x.type === "," || x.type === ";")) break;
        else if (depth === 0 && x.type === "word" && UNIT[x.text.toLowerCase()] && k > nextNonWs(toks, i + 1)) {
          // a unit word right after an expression (not e.g. DATE_SUB's own args)
          const prev = [...toks.slice(i + 1, k)].reverse().find((y) => !isWs(y));
          if (prev && prev.text !== "." && !(prev.type === "word" && /^(OVER|BY|AND|OR)$/i.test(prev.text))) { unitAt = k; break; }
        }
      }
      if (unitAt > 0) {
        const exprToks = toks.slice(i + 1, unitAt);
        const expr = text(rewrite(exprToks, dialect)).trim();
        const u = UNIT[toks[unitAt].text.toLowerCase()];
        out.push({ type: "raw", text: u === "quarter" ? `INTERVAL (3 * (${expr})) MONTH` : `INTERVAL (${expr}) ${u.toUpperCase()}` });
        i = unitAt; continue;
      }
    }
    out.push(t);
  }
  return out;
}

function isKeywordNotFn(up) {
  return ["IN", "AS", "AND", "OR", "NOT", "ON", "FROM", "JOIN", "WHERE", "SELECT", "VALUES", "EXISTS", "OVER", "INTO",
    "USING", "THEN", "ELSE", "WHEN", "WITH", "BY", "UNION", "ALL", "ANY", "SOME", "TABLE", "KEY", "REFERENCES",
    "WINDOW", "FILTER", "RECURSIVE", "LIMIT", "OFFSET", "ROWS", "HAVING", "INTERVAL"].includes(up);
}

// T-SQL: SELECT TOP (n) ... -> ... LIMIT n at the end of that SELECT
function moveTop(toks) {
  for (let i = 0; i < toks.length; i++) {
    if (!W(toks[i], "SELECT")) continue;
    let k = nextNonWs(toks, i + 1);
    let distinct = null;
    if (W(toks[k], "DISTINCT")) { distinct = k; k = nextNonWs(toks, k + 1); }
    if (!W(toks[k], "TOP")) continue;
    let n, end;
    const a = nextNonWs(toks, k + 1);
    if (toks[a].type === "(") { const c = matchParen(toks, a); n = text(toks.slice(a + 1, c)).trim(); end = c; }
    else { n = toks[a].text; end = a; }
    const after = nextNonWs(toks, end + 1);
    if (W(toks[after], "PERCENT")) throw new TranslateError("TOP ... PERCENT is not supported in the browser engine.");
    let withTies = false;
    if (W(toks[after], "WITH")) {
      const t2 = nextNonWs(toks, after + 1);
      if (!W(toks[t2], "TIES")) throw new TranslateError("Unexpected WITH after TOP.");
      withTies = true; end = t2;
    }
    // find end of this SELECT block at the same depth
    let depth = 0, stop = toks.length;
    for (let j = end + 1; j < toks.length; j++) {
      if (toks[j].type === "(") depth++;
      else if (toks[j].type === ")") { if (depth === 0) { stop = j; break; } depth--; }
      else if (depth === 0 && (toks[j].type === ";" || W(toks[j], "UNION") || W(toks[j], "EXCEPT") || W(toks[j], "INTERSECT"))) { stop = j; break; }
    }
    if (withTies) {
      // emulate with a rank filter on the query's own ORDER BY
      let ob = -1, d2 = 0;
      for (let j = end + 1; j < stop; j++) {
        if (toks[j].type === "(") d2++; else if (toks[j].type === ")") d2--;
        else if (d2 === 0 && W(toks[j], "ORDER") && W(toks[nextNonWs(toks, j + 1)], "BY")) ob = j;
      }
      if (ob < 0) throw new TranslateError("TOP ... WITH TIES needs an ORDER BY.");
      const orderText = text(toks.slice(nextNonWs(toks, ob + 1) + 1, stop)).trim();
      toks.splice(ob, 0, { type: "raw", text: ` QUALIFY RANK() OVER (ORDER BY ${orderText}) <= ${n} ` });
    } else toks.splice(stop, 0, { type: "raw", text: ` LIMIT ${n} ` });
    toks.splice(k, end - k + 1);
    i = -1; // rescan (positions shifted)
  }
  return toks;
}

// ------------------------------------------------------------------ public API

export const SESSION_SETUP = {
  mysql: ["SET default_null_order = 'nulls_first_on_asc_last_on_desc'", "SET default_collation = 'nocase'", "SET ieee_floating_point_ops = false"],
  tsql: ["SET default_null_order = 'nulls_first_on_asc_last_on_desc'", "SET default_collation = 'nocase'", "SET ieee_floating_point_ops = false"],
};

export function translate(sql, dialect = "mysql") {
  if (dialect !== "mysql" && dialect !== "tsql") throw new TranslateError(`Unknown dialect ${dialect}.`);
  let toks = tokenize(sql, dialect);
  if (dialect === "tsql") toks = moveTop(toks);
  const out = text(rewrite(toks, dialect));
  return out;
}

// Split translated DuckDB SQL into statements (respects quotes).
export function splitStatements(sql) {
  const toks = tokenize(sql, "duck");
  const stmts = [];
  let cur = [];
  for (const t of toks) {
    if (t.type === ";") { if (cur.some((x) => !isWs(x))) stmts.push(cur); cur = []; continue; }
    cur.push(t);
  }
  if (cur.some((x) => !isWs(x))) stmts.push(cur);
  return stmts.map((s) => {
    const raw = s.map((t) => t.text).join("").trim();
    return raw;
  });
}

export const NOTES = {
  tsql: "SQL Server runs here through an emulator: integer ÷ integer and AVG on integer columns return decimals (real SQL Server truncates them), and dividing by zero returns NULL (real SQL Server raises an error).",
  mysql: "",
};
