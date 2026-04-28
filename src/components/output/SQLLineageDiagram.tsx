import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import type { TableSchema } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedTable {
  rawName: string;
  alias: string;
  joinType: string;  // "FROM" | "LEFT" | "INNER" | etc.
  joinKey: string;   // column on THIS table's side of the ON clause
  onClause: string;  // full ON condition string
}

interface ParsedLineage {
  tables: ParsedTable[];
  aliasMap: Record<string, string>;  // alias.lower → table.lower
  whereConditions: string[];
  selectColsByTable: Record<string, string[]>;
  totalSelect: number;
}

type FieldRole = "pk" | "fk" | "join" | "filter" | "select" | "col";

interface FieldInfo {
  name: string;
  colType: string;
  role: FieldRole;
  filterHint?: string; // condensed filter condition
}

// ── SQL Parser ────────────────────────────────────────────────────────────────

const STOP = new Set([
  "ON", "JOIN", "LEFT", "RIGHT", "INNER", "FULL", "CROSS", "OUTER",
  "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "UNION", "EXCEPT", "INTERSECT",
]);

function splitByComma(s: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function extractJoinKey(onClause: string, alias: string): string {
  const m = onClause.match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/);
  if (!m) return "";
  if (m[1].toLowerCase() === alias) return m[2];
  if (m[3].toLowerCase() === alias) return m[4];
  return m[2];
}

function parseSQL(sql: string): ParsedLineage {
  const clean = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliasMap: Record<string, string> = {};
  const tables: ParsedTable[] = [];
  const tokens = clean.split(/\s+/);

  // FROM
  const fromM = clean.match(/\bFROM\s+([\w.]+)(?:\s+(?:AS\s+)?(\w+))?/i);
  if (fromM) {
    const name = fromM[1].toLowerCase();
    const alias = (fromM[2] ?? fromM[1]).toLowerCase();
    aliasMap[alias] = name;
    tables.push({ rawName: name, alias, joinType: "FROM", joinKey: "", onClause: "" });
  }

  // JOINs
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].toUpperCase() !== "JOIN") continue;

    let jtype = "INNER";
    if (i >= 1) {
      const p1 = tokens[i - 1].toUpperCase();
      if (["LEFT", "RIGHT", "INNER", "FULL", "CROSS"].includes(p1)) jtype = p1;
      else if (p1 === "OUTER" && i >= 2) {
        const p2 = tokens[i - 2].toUpperCase();
        if (["LEFT", "RIGHT", "FULL"].includes(p2)) jtype = p2;
      }
    }

    const name = tokens[i + 1]?.replace(/[`"[\];,]/g, "").toLowerCase() ?? "";
    if (!name || tables.find(t => t.rawName === name)) continue;

    let j = i + 2;
    if (tokens[j]?.toUpperCase() === "AS") j++;
    let alias = name;
    if (j < tokens.length && !STOP.has(tokens[j]?.toUpperCase())) {
      alias = tokens[j].toLowerCase(); j++;
    }
    aliasMap[alias] = name;

    let joinKey = "", onClause = "";
    if (tokens[j]?.toUpperCase() === "ON") {
      j++;
      const cond: string[] = [];
      while (j < tokens.length && !STOP.has(tokens[j]?.toUpperCase())) { cond.push(tokens[j]); j++; }
      onClause = cond.join(" ");
      joinKey = extractJoinKey(onClause, alias);
    }

    tables.push({ rawName: name, alias, joinType: jtype, joinKey, onClause });
  }

  // Set FROM table's join key from first ON clause
  if (tables[0]) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toUpperCase() !== "ON") continue;
      const cond: string[] = [];
      let j = i + 1;
      while (j < tokens.length && !STOP.has(tokens[j]?.toUpperCase())) { cond.push(tokens[j]); j++; }
      const oc = cond.join(" ");
      tables[0].joinKey = extractJoinKey(oc, tables[0].alias) || (oc.match(/(\w+)\.(\w+)/)?.[2] ?? "");
      break;
    }
  }

  // WHERE
  const whereM = clean.match(/\bWHERE\s+([\s\S]+?)(?:\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|$)/i);
  const whereConditions = whereM
    ? whereM[1].split(/\bAND\b|\bOR\b/i).map(s => s.trim()).filter(s => s && s.length < 80)
    : [];

  // SELECT
  const selectM = clean.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i);
  const selectColsByTable: Record<string, string[]> = {};
  let totalSelect = 0;
  if (selectM) {
    const cols = splitByComma(selectM[1]);
    totalSelect = cols.filter(c => !c.trim().match(/^\s*\*\s*$/)).length || cols.length;
    for (const col of cols) {
      const m = col.trim().match(/\b(\w+)\.(\w+)/);
      if (m) {
        const t = aliasMap[m[1].toLowerCase()] ?? m[1].toLowerCase();
        if (!selectColsByTable[t]) selectColsByTable[t] = [];
        selectColsByTable[t].push(m[2]);
      }
    }
  }

  return { tables, aliasMap, whereConditions, selectColsByTable, totalSelect };
}

// ── Field resolution ──────────────────────────────────────────────────────────

function resolveFields(
  table: ParsedTable,
  schema: TableSchema | undefined,
  selectCols: string[],
  whereConditions: string[],
  aliasMap: Record<string, string>,
): FieldInfo[] {
  const schemaCols = schema?.columns ?? [];
  const declaredFKs = new Set(schema?.foreignKeys?.map(f => f.column) ?? []);
  const seen = new Set<string>();
  const fields: FieldInfo[] = [];

  function add(name: string, role: FieldRole, filterHint?: string) {
    if (seen.has(name) || fields.length >= 6) return;
    seen.add(name);
    const colType = schemaCols.find(c => c.name === name)?.type ?? "";
    fields.push({ name, colType, role, filterHint });
  }

  // 1. Schema PKs
  for (const c of schemaCols) if (c.pk) add(c.name, "pk");

  // 2. Join key (if not already a PK)
  if (table.joinKey) {
    const isPK = schemaCols.find(c => c.name === table.joinKey && c.pk);
    if (!isPK) add(table.joinKey, table.joinType === "FROM" ? "join" : "fk");
  }

  // 3. Declared FK columns
  for (const col of declaredFKs) add(col, "fk");

  // 4. Filter columns from WHERE (belonging to this table)
  for (const cond of whereConditions) {
    const m = cond.match(/\b(\w+)\.(\w+)/);
    if (!m) continue;
    const tRef = aliasMap[m[1].toLowerCase()] ?? m[1].toLowerCase();
    if (tRef === table.rawName) {
      const hint = cond.replace(/\w+\.\w+/, m[2]).trim();
      add(m[2], "filter", hint.slice(0, 22));
    }
  }

  // 5. Selected columns
  for (const col of selectCols) add(col, "select");

  // 6. Fill remainder from schema
  for (const c of schemaCols) add(c.name, "col");

  return fields;
}

// ── SVG drawing constants ─────────────────────────────────────────────────────

const SRC_W  = 175;
const RES_W  = 182;
const HDR_H  = 28;
const FLD_H  = 16;
const PAD    = 6;
const CARD_GAP = 12;
const LEFT_X   = 8;
const VW       = 690;
const RIGHT_X  = VW - RES_W - 8;

function cardH(n: number) { return HDR_H + PAD + n * FLD_H + PAD; }

const ROLE_COLOR: Record<FieldRole, string> = {
  pk:     "#d97706",
  fk:     "#0ea5e9",
  join:   "#6366f1",
  filter: "#8b5cf6",
  select: "#22c55e",
  col:    "#94a3b8",
};
const ROLE_LABEL: Record<FieldRole, string> = {
  pk: "PK", fk: "FK", join: "JK", filter: "F", select: "→", col: "",
};
const JOIN_BORDER: Record<string, string> = {
  FROM: "#6366f1", LEFT: "#0ea5e9", RIGHT: "#f59e0b",
  INNER: "#22c55e", FULL: "#a855f7", CROSS: "#ef4444",
};

function tr(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

// ── TableCard (pure SVG, no hooks) ───────────────────────────────────────────

function TableCard({
  x, y, table, fields, schema,
}: {
  x: number; y: number;
  table: ParsedTable;
  fields: FieldInfo[];
  schema?: TableSchema;
}) {
  const h = cardH(fields.length);
  const bc = JOIN_BORDER[table.joinType] ?? "#cbd5e1";
  const isBase = table.joinType === "FROM";
  const badgeTxt = isBase ? "BASE" : `${table.joinType} JOIN`;
  const badgeW = badgeTxt.length * 5.2 + 8;

  return (
    <g>
      {/* Shadow */}
      <rect x={x + 2} y={y + 3} width={SRC_W} height={h} rx={7} fill="rgba(0,0,0,0.055)" />
      {/* Body */}
      <rect x={x} y={y} width={SRC_W} height={h} rx={7}
        fill="white" stroke={bc} strokeWidth={isBase ? 2 : 1} />
      {/* Left accent */}
      <rect x={x} y={y + 7} width={3} height={h - 14} rx={1.5} fill={bc} />

      {/* Table name */}
      <text x={x + 11} y={y + 12} fontSize={9} fontWeight="700"
        fill="#1e293b" fontFamily="system-ui,sans-serif">
        {tr(table.rawName, 19)}
      </text>
      {/* Row count */}
      {schema?.rowCount != null && (
        <text x={x + 11} y={y + 22} fontSize={6.5} fill="#94a3b8" fontFamily="system-ui,sans-serif">
          {schema.rowCount >= 1000 ? `${(schema.rowCount / 1000).toFixed(0)}K` : schema.rowCount} rows
        </text>
      )}
      {/* Join type badge */}
      <rect x={x + SRC_W - badgeW - 6} y={y + 5} width={badgeW} height={11} rx={3}
        fill={bc + "22"} />
      <text x={x + SRC_W - badgeW / 2 - 6} y={y + 13.5} textAnchor="middle"
        fontSize={6.5} fontWeight="700" fill={bc} fontFamily="system-ui,sans-serif">
        {badgeTxt}
      </text>

      {/* Separator */}
      <line x1={x + 8} y1={y + HDR_H} x2={x + SRC_W - 8} y2={y + HDR_H}
        stroke="#f1f5f9" strokeWidth={1} />

      {/* Field rows */}
      {fields.map((f, fi) => {
        const fy  = y + HDR_H + PAD + fi * FLD_H;
        const col = ROLE_COLOR[f.role];
        const lbl = ROLE_LABEL[f.role];
        const important = f.role === "pk" || f.role === "fk" || f.role === "join" || f.role === "filter";
        const lblW = lbl ? lbl.length * 5.2 + 6 : 0;
        const textX = x + (lbl ? 10 + lblW + 4 : 10);
        const displayName = f.filterHint ?? f.name;

        return (
          <g key={fi}>
            {/* Row highlight for important fields */}
            {important && (
              <rect x={x + 5} y={fy} width={SRC_W - 10} height={FLD_H - 1} rx={2}
                fill={col + "14"} />
            )}
            {/* Role badge */}
            {lbl && (
              <>
                <rect x={x + 10} y={fy + 2} width={lblW} height={10} rx={2}
                  fill={col + "30"} />
                <text x={x + 10 + lblW / 2} y={fy + 10} textAnchor="middle"
                  fontSize={6.5} fontWeight="700" fill={col} fontFamily="monospace">
                  {lbl}
                </text>
              </>
            )}
            {/* Dot for non-badged fields */}
            {!lbl && (
              <circle cx={x + 13} cy={fy + 7} r={2} fill={col} />
            )}
            {/* Field name / filter hint */}
            <text x={textX} y={fy + 11} fontSize={8}
              fill={important ? "#1e293b" : "#64748b"}
              fontWeight={important ? "600" : "400"}
              fontFamily="monospace,system-ui,sans-serif"
            >
              {tr(displayName, 19)}
            </text>
            {/* Column type */}
            {!f.filterHint && f.colType && (
              <text x={x + SRC_W - 7} y={fy + 11} textAnchor="end"
                fontSize={6} fill="#d1d5db" fontFamily="monospace">
                {f.colType.split("(")[0].toUpperCase().slice(0, 7)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SQLLineageDiagram({ sql }: { sql: string }) {
  const { schemas } = useDataStore();

  const lineage = useMemo(() => parseSQL(sql), [sql]);

  const schemaMap = useMemo(() => {
    const m: Record<string, TableSchema> = {};
    for (const s of schemas) m[s.name.toLowerCase()] = s;
    return m;
  }, [schemas]);

  const tableData = useMemo(() => lineage.tables.map(t => ({
    table: t,
    schema: schemaMap[t.rawName],
    fields: resolveFields(
      t, schemaMap[t.rawName],
      lineage.selectColsByTable[t.rawName] ?? [],
      lineage.whereConditions,
      lineage.aliasMap,
    ),
  })), [lineage, schemaMap]);

  if (lineage.tables.length < 2) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          <GitBranch size={18} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Single-table query — no joins to diagram
        </p>
      </div>
    );
  }

  // Card positions (left column, stacked)
  let curY = 10;
  const cards = tableData.map(td => {
    const h = cardH(td.fields.length);
    const y = curY;
    curY += h + CARD_GAP;
    return { ...td, y, h };
  });
  const totalSrcH = curY - CARD_GAP + 10;

  // Result card sizing
  const joinRows  = lineage.tables.length;
  const filterRows = Math.min(lineage.whereConditions.length, 4);
  const sepRow = filterRows > 0 ? 1 : 0;
  const resFields = joinRows + filterRows + sepRow;
  const resH = cardH(resFields);
  const VH  = Math.max(totalSrcH, resH + 40);
  const resY  = (VH - resH) / 2;
  const resLX = RIGHT_X;
  const resCY = resY + resH / 2;
  const resCX = RIGHT_X + RES_W / 2;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        Data Lineage · {lineage.tables.length} source tables
      </p>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 p-2 overflow-x-auto">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" style={{ minWidth: 500 }}>
          <defs>
            <marker id="la-jn" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
            </marker>
            <marker id="la-fk" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
            </marker>
            <linearGradient id="res-g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* ── Source table cards + arrows ─────────────────────────────────── */}
          {cards.map((card, i) => {
            const cardRX = LEFT_X + SRC_W;
            const cardCY = card.y + card.h / 2;
            const isBase = card.table.joinType === "FROM";
            const cpx = cardRX + (resLX - cardRX) * 0.55;
            const lx  = (cardRX + resLX) / 2;
            const ly  = (cardCY + resCY) / 2;

            return (
              <g key={i}>
                {/* Arrow: card → result */}
                <path
                  d={`M ${cardRX} ${cardCY} C ${cpx} ${cardCY} ${cpx} ${resCY} ${resLX} ${resCY}`}
                  fill="none"
                  stroke={isBase ? "#6366f1" : "#cbd5e1"}
                  strokeWidth={isBase ? 2 : 1.5}
                  strokeDasharray={isBase ? "none" : "5 3"}
                  markerEnd={isBase ? "url(#la-jn)" : "url(#la-fk)"}
                />

                {/* Join key label on arrow */}
                {card.table.joinKey && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={lx - 33} y={ly - 9} width={66} height={15} rx={4}
                      fill="white" stroke={isBase ? "#c7d2fe" : "#e2e8f0"} strokeWidth={0.8} />
                    <text x={lx} y={ly + 3} textAnchor="middle" fontSize={7.5}
                      fill={isBase ? "#6366f1" : "#94a3b8"} fontFamily="monospace" fontWeight="600">
                      {tr(card.table.joinKey, 12)}
                    </text>
                  </g>
                )}

                {/* Table card */}
                <TableCard
                  x={LEFT_X} y={card.y}
                  table={card.table}
                  fields={card.fields}
                  schema={card.schema}
                />
              </g>
            );
          })}

          {/* ── Result card ──────────────────────────────────────────────────── */}
          <rect x={RIGHT_X + 2} y={resY + 3} width={RES_W} height={resH} rx={7} fill="rgba(0,0,0,0.07)" />
          <rect x={RIGHT_X} y={resY} width={RES_W} height={resH} rx={7} fill="url(#res-g)" />

          {/* Result header */}
          <text x={resCX} y={resY + 13} textAnchor="middle" fontSize={10}
            fontWeight="800" fill="white" fontFamily="system-ui,sans-serif">
            Query Result
          </text>
          <text x={resCX} y={resY + 23} textAnchor="middle" fontSize={7}
            fill="rgba(199,210,254,0.9)" fontFamily="system-ui,sans-serif">
            {lineage.totalSelect > 0 ? `${lineage.totalSelect} cols` : "all cols"} · {lineage.tables.length} tables
          </text>

          {/* Separator */}
          <line x1={RIGHT_X + 10} y1={resY + HDR_H} x2={RIGHT_X + RES_W - 10} y2={resY + HDR_H}
            stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

          {/* Join rows */}
          {lineage.tables.map((t, i) => {
            const ry = resY + HDR_H + PAD + i * FLD_H;
            const isBase = t.joinType === "FROM";
            return (
              <g key={i}>
                <text x={RIGHT_X + 12} y={ry + 11} fontSize={7.5}
                  fill={isBase ? "rgba(255,255,255,0.95)" : "rgba(199,210,254,0.85)"}
                  fontFamily="monospace" fontWeight={isBase ? "700" : "400"}>
                  {isBase ? "■" : "→"} {tr(t.rawName, 14)}
                  {t.joinKey ? `  :  ${t.joinKey}` : ""}
                </text>
              </g>
            );
          })}

          {/* Filter section */}
          {filterRows > 0 && (() => {
            const sepY = resY + HDR_H + PAD + joinRows * FLD_H + 2;
            return (
              <>
                <line x1={RIGHT_X + 10} y1={sepY} x2={RIGHT_X + RES_W - 10} y2={sepY}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />
                <text x={RIGHT_X + 12} y={sepY + 11} fontSize={7}
                  fill="rgba(255,255,255,0.5)" fontFamily="system-ui,sans-serif" fontWeight="700">
                  FILTERS
                </text>
                {lineage.whereConditions.slice(0, 4).map((cond, fi) => {
                  const ry = resY + HDR_H + PAD + (joinRows + 1 + fi) * FLD_H;
                  return (
                    <text key={fi} x={RIGHT_X + 12} y={ry + 11} fontSize={7}
                      fill="rgba(199,210,254,0.8)" fontFamily="monospace">
                      {tr(cond.replace(/\b\w+\./g, ""), 22)}
                    </text>
                  );
                })}
              </>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {([
          ["PK", "#d97706", "Primary key"],
          ["FK", "#0ea5e9", "Foreign key"],
          ["JK", "#6366f1", "Join key"],
          ["F",  "#8b5cf6", "Filter column"],
        ] as const).map(([lbl, col, desc]) => (
          <div key={lbl} className="flex items-center gap-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: col + "28", color: col }}>
              {lbl}
            </span>
            <span className="text-[9px] text-gray-400">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
