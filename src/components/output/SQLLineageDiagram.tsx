import { useMemo } from "react";
import { GitBranch } from "lucide-react";

interface ParsedJoin {
  table: string;
  condition: string;
  type: string;
}

interface ParsedLineage {
  fromTable: string | null;
  joins: ParsedJoin[];
}

const STOP_KEYWORDS = new Set([
  "ON", "JOIN", "LEFT", "RIGHT", "INNER", "FULL", "CROSS",
  "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "UNION", "EXCEPT", "INTERSECT",
]);

function parseLineage(sql: string): ParsedLineage {
  const normalized = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const fromM = normalized.match(/\bFROM\s+([\w.]+)/i);
  const fromTable = fromM?.[1] ?? null;

  const tokens = normalized.split(/\s+/);
  const joins: ParsedJoin[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].toUpperCase() !== "JOIN") continue;

    // Determine join type from preceding token(s)
    let type = "INNER";
    if (i >= 1) {
      const p1 = tokens[i - 1].toUpperCase();
      if (["LEFT", "RIGHT", "INNER", "FULL", "CROSS"].includes(p1)) {
        type = p1;
      } else if (p1 === "OUTER" && i >= 2) {
        const p2 = tokens[i - 2].toUpperCase();
        if (["LEFT", "RIGHT", "FULL"].includes(p2)) type = p2;
      }
    }

    const rawTable = tokens[i + 1]?.replace(/[`"[\];,]/g, "") ?? "";
    if (!rawTable || seen.has(rawTable)) continue;

    let j = i + 2;
    // Skip optional AS keyword
    if (tokens[j]?.toUpperCase() === "AS") j++;
    // Skip alias token
    if (j < tokens.length && !STOP_KEYWORDS.has(tokens[j]?.toUpperCase())) j++;

    let condition = "";
    if (tokens[j]?.toUpperCase() === "ON") {
      j++;
      const condTokens: string[] = [];
      while (j < tokens.length && !STOP_KEYWORDS.has(tokens[j]?.toUpperCase())) {
        condTokens.push(tokens[j]);
        j++;
      }
      const onClause = condTokens.join(" ");
      const condM = onClause.match(/\w+\.(\w+)\s*=\s*\w+\.(\w+)/);
      if (condM) {
        condition = condM[1] === condM[2] ? condM[1] : `${condM[1]}=${condM[2]}`;
      } else {
        condition = onClause.slice(0, 20).trim();
      }
    }

    seen.add(rawTable);
    joins.push({ table: rawTable, condition, type });
  }

  return { fromTable, joins };
}

const JOIN_COLOR: Record<string, string> = {
  LEFT: "#0ea5e9",
  RIGHT: "#f59e0b",
  INNER: "#22c55e",
  FULL: "#a855f7",
  CROSS: "#ef4444",
};

function jColor(type: string) {
  return JOIN_COLOR[type] ?? "#64748b";
}

function tr(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const NW = 128;
const NH = 38;
const ROW_H = 54;
const BASE_X = 12;
const JOIN_X = 210;
const VW = 512;

export function SQLLineageDiagram({ sql }: { sql: string }) {
  const { fromTable, joins } = useMemo(() => parseLineage(sql), [sql]);

  if (!fromTable || joins.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          <GitBranch size={18} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Single-table query — no joins to diagram</p>
      </div>
    );
  }

  const n = joins.length;
  const VH = Math.max(120, n * ROW_H + 40);
  const baseY = (VH - NH) / 2;
  const resultX = VW - NW - 12;
  const resultY = (VH - NH) / 2;
  const joinTotalH = n * ROW_H - (ROW_H - NH);
  const joinStartY = (VH - joinTotalH) / 2;

  const bRX = BASE_X + NW;   // base right x
  const bRY = baseY + NH / 2; // base right y (center)
  const rLX = resultX;        // result left x
  const rLY = resultY + NH / 2; // result left y (center)

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        Data Lineage · {n + 1} tables merged
      </p>
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 p-2">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto">
          <defs>
            <marker id="la" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
            </marker>
            <marker id="lar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#818cf8" />
            </marker>
            <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* ── Base (FROM) table ── */}
          <rect x={BASE_X} y={baseY} width={NW} height={NH} rx={6}
            fill="#eef2ff" stroke="#6366f1" strokeWidth={1.5} />
          <text x={BASE_X + NW / 2} y={baseY + 16} textAnchor="middle"
            fontSize={9} fontWeight="700" fill="#3730a3" fontFamily="system-ui,sans-serif">
            {tr(fromTable, 17)}
          </text>
          <text x={BASE_X + NW / 2} y={baseY + 30} textAnchor="middle"
            fontSize={7} fill="#818cf8" fontFamily="system-ui,sans-serif">
            FROM (base)
          </text>

          {/* ── Joined tables + arrows ── */}
          {joins.map((join, i) => {
            const jy = joinStartY + i * ROW_H;
            const jCY = jy + NH / 2;
            const jRX = JOIN_X + NW;
            const col = jColor(join.type);

            const bcp = bRX + (JOIN_X - bRX) * 0.6;
            const rcp = jRX + (rLX - jRX) * 0.4;

            // Label midpoint on base→join curve
            const lx = (bRX + JOIN_X) / 2;
            const ly = (bRY + jCY) / 2;

            return (
              <g key={i}>
                {/* base → join */}
                <path
                  d={`M ${bRX} ${bRY} C ${bcp} ${bRY} ${bcp} ${jCY} ${JOIN_X} ${jCY}`}
                  fill="none" stroke="#cbd5e1" strokeWidth={1.5}
                  markerEnd="url(#la)"
                />

                {/* ON condition label */}
                {join.condition && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={lx - 30} y={ly - 8} width={60} height={13} rx={3}
                      fill="white" stroke="#e2e8f0" strokeWidth={0.5} opacity={0.95} />
                    <text x={lx} y={ly + 2} textAnchor="middle"
                      fontSize={7} fill="#475569" fontFamily="monospace">
                      {tr(join.condition, 12)}
                    </text>
                  </g>
                )}

                {/* join → result */}
                <path
                  d={`M ${jRX} ${jCY} C ${rcp} ${jCY} ${rcp} ${rLY} ${rLX} ${rLY}`}
                  fill="none" stroke="#c7d2fe" strokeWidth={1}
                  strokeDasharray="3 2" markerEnd="url(#lar)"
                />

                {/* Join node */}
                <rect x={JOIN_X} y={jy} width={NW} height={NH} rx={6}
                  fill="white" stroke="#e2e8f0" strokeWidth={1} />
                <rect x={JOIN_X} y={jy + 4} width={3} height={NH - 8} rx={1.5} fill={col} />
                <text x={JOIN_X + 12} y={jy + 16} fontSize={9} fontWeight="600"
                  fill="#1e293b" fontFamily="system-ui,sans-serif">
                  {tr(join.table, 16)}
                </text>
                <text x={JOIN_X + 12} y={jy + 29} fontSize={7}
                  fill={col} fontWeight="500" fontFamily="system-ui,sans-serif">
                  {join.type} JOIN
                </text>
              </g>
            );
          })}

          {/* ── Result node ── */}
          <rect x={resultX} y={resultY} width={NW} height={NH} rx={6}
            fill="url(#rg)" stroke="#6366f1" strokeWidth={1.5} />
          <text x={resultX + NW / 2} y={resultY + 16} textAnchor="middle"
            fontSize={9} fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">
            Query Result
          </text>
          <text x={resultX + NW / 2} y={resultY + 30} textAnchor="middle"
            fontSize={7.5} fill="#c7d2fe" fontFamily="system-ui,sans-serif">
            {n + 1} tables merged
          </text>
        </svg>
      </div>
    </div>
  );
}
