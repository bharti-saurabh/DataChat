import { useState, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Search, TableIcon, BarChart2, Hash,
  Type, Calendar, ToggleLeft, FolderOpen, Sparkles, Loader2,
  AlertTriangle, CheckCircle2, Link2, KeyRound, ShieldAlert,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { computeColumnStats, loadForeignKeys } from "@/lib/explorerStats";
import { generateColumnDescription } from "@/lib/schemaAI";
import { getDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { TableSchema, ColumnInfo, ColumnStats, ForeignKeyInfo, QueryRow } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  const t = type.toUpperCase();
  if (t.includes("INT"))                                              return <Hash size={11} className="text-blue-500" />;
  if (t.includes("REAL") || t.includes("FLOAT") || t.includes("NUMERIC")) return <BarChart2 size={11} className="text-emerald-500" />;
  if (t.includes("DATE") || t.includes("TIME"))                      return <Calendar size={11} className="text-purple-500" />;
  if (t.includes("BOOL"))                                             return <ToggleLeft size={11} className="text-orange-500" />;
  return <Type size={11} className="text-gray-400" />;
}

function fmt(v: unknown): string {
  if (v == null) return "–";
  if (typeof v === "number") return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
  return String(v).slice(0, 22);
}

// ── QA health score (0–100) ────────────────────────────────────────────────
function healthScore(stats: ColumnStats[]): number {
  if (!stats.length) return 100;
  const total = stats.length;
  let deductions = 0;
  for (const s of stats) {
    const nullPct = s.total > 0 ? (s.nullCount / s.total) * 100 : 0;
    if (nullPct >= 50) deductions += 2;
    else if (nullPct >= 10) deductions += 1;
  }
  return Math.max(0, Math.round(((total - deductions) / total) * 100));
}

// ── Inline column-level QA badges ────────────────────────────────────────────
function QABadges({ stats, col }: { stats: ColumnStats; col: ColumnInfo }) {
  const nullPct = stats.total > 0 ? (stats.nullCount / stats.total) * 100 : 0;
  const distinctPct = stats.total > 0 ? (stats.distinct / stats.total) * 100 : 0;
  const isNumeric = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL/i.test(col.type);

  const badges: { label: string; color: string; tip: string }[] = [];

  if (nullPct >= 50)
    badges.push({ label: `${Math.round(nullPct)}% null`, color: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400", tip: "More than half the values are missing" });
  else if (nullPct >= 10)
    badges.push({ label: `${Math.round(nullPct)}% null`, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400", tip: `${Math.round(nullPct)}% null values` });
  else if (stats.nullCount === 0)
    badges.push({ label: "no nulls", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400", tip: "No missing values" });

  if (distinctPct > 90 && !isNumeric && stats.total > 50)
    badges.push({ label: "high cardinality", color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400", tip: `${stats.distinct} distinct values — likely an ID or free-text column` });
  else if (stats.distinct === 1)
    badges.push({ label: "constant", color: "bg-gray-100 text-gray-500 dark:bg-gray-800", tip: "Only one unique value" });
  else if (isNumeric && stats.distinct <= 5 && stats.total > 20)
    badges.push({ label: "low distinct", color: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400", tip: `Only ${stats.distinct} distinct numeric values — may be a flag/category` });

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b) => (
        <span key={b.label} title={b.tip} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", b.color)}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Per-column expanded row ───────────────────────────────────────────────────
function ColumnRow({
  col,
  stats,
  fk,
  onRequestDescription,
}: {
  col: ColumnInfo;
  stats?: ColumnStats;
  fk?: ForeignKeyInfo;       // FK info if this column is a FK
  onRequestDescription: (colName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const nullPct = stats && stats.total > 0 ? (stats.nullCount / stats.total) * 100 : 0;
  const isPK = col.pk > 0;
  const isFK = Boolean(fk);
  const isNotNull = col.notnull === 1;
  const hasDefault = col.dflt_value != null;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      {/* ── Collapsed row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        {expanded
          ? <ChevronDown size={10} className="shrink-0 text-gray-400" />
          : <ChevronRight size={10} className="shrink-0 text-gray-400" />}

        <span className="shrink-0">{typeIcon(col.type)}</span>

        {/* PK badge */}
        {isPK && (
          <span title="Primary Key" className="shrink-0">
            <KeyRound size={11} className="text-amber-500" />
          </span>
        )}

        {/* FK badge */}
        {isFK && (
          <span title={`Foreign Key → ${fk!.refTable}(${fk!.refColumn})`} className="shrink-0">
            <Link2 size={11} className="text-sky-500" />
          </span>
        )}

        <span className={cn(
          "text-xs flex-1 truncate font-medium",
          isPK ? "text-amber-700 dark:text-amber-400" : isFK ? "text-sky-700 dark:text-sky-400" : "text-gray-700 dark:text-gray-300",
        )}>
          {col.name}
        </span>

        {/* NOT NULL indicator */}
        {isNotNull && !isPK && (
          <span title="NOT NULL constraint" className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400 font-mono">
            NN
          </span>
        )}

        {/* Default value indicator */}
        {hasDefault && (
          <span title={`Default: ${col.dflt_value}`} className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-gray-100 text-gray-400 dark:bg-gray-800 font-mono">
            D
          </span>
        )}

        <span className="text-[10px] text-gray-400 shrink-0 font-mono">{col.type || "TEXT"}</span>

        {/* Null % pill */}
        {stats && stats.nullCount > 0 && stats.total > 0 && (
          <span className={cn(
            "text-[9px] px-1 py-0.5 rounded shrink-0 font-medium",
            nullPct >= 50
              ? "bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400"
              : "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400",
          )}>
            {Math.round(nullPct)}% ∅
          </span>
        )}
        {stats && stats.nullCount === 0 && (
          <span title="No nulls" className="shrink-0">
            <CheckCircle2 size={10} className="text-green-400" />
          </span>
        )}
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-gray-50/60 dark:bg-gray-800/30 space-y-2">

          {/* FK reference callout */}
          {isFK && (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 rounded-lg px-2.5 py-1.5">
              <Link2 size={11} />
              References <strong className="font-semibold">{fk!.refTable}</strong>({fk!.refColumn})
            </div>
          )}

          {/* AI Description */}
          {stats?.description ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 italic leading-snug">
              {stats.description}
            </p>
          ) : (
            <button
              onClick={() => onRequestDescription(col.name)}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <Sparkles size={10} /> Generate AI description
            </button>
          )}

          {/* Stats grid */}
          {stats && (
            <div className="grid grid-cols-3 gap-1.5">
              <Stat label="Rows" value={fmt(stats.total)} />
              <Stat label="Distinct" value={fmt(stats.distinct)} />
              <Stat label="Nulls" value={String(stats.nullCount)} />
              {stats.min != null && <Stat label="Min" value={fmt(stats.min)} />}
              {stats.max != null && <Stat label="Max" value={fmt(stats.max)} />}
              {stats.avg != null && <Stat label="Avg" value={Number(stats.avg).toFixed(2)} />}
            </div>
          )}

          {/* Top values */}
          {stats?.topValues && stats.topValues.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Top values</p>
              <div className="flex flex-wrap gap-1">
                {stats.topValues.map((v) => (
                  <span key={v} className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 font-mono max-w-[120px] truncate" title={v}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Constraints & QA badges */}
          <div className="flex flex-wrap gap-1">
            {isPK && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-1">
                <KeyRound size={9} /> Primary Key
              </span>
            )}
            {isNotNull && !isPK && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                NOT NULL
              </span>
            )}
            {hasDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                DEFAULT {col.dflt_value}
              </span>
            )}
          </div>
          {stats && <QABadges stats={stats} col={col} />}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded px-2 py-1 border border-gray-100 dark:border-gray-700">
      <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{value}</p>
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ rows }: { rows: QueryRow[] }) {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto mt-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Data quality summary bar ──────────────────────────────────────────────────
function QASummaryBar({ table, fkCount }: { table: TableSchema; fkCount: number }) {
  const stats = table.columnStats;
  if (!stats) return null;

  const pkCount = table.columns.filter((c) => c.pk > 0).length;
  const nullCols = stats.filter((s) => s.nullCount > 0).length;
  const score = healthScore(stats);

  const scoreColor =
    score >= 90 ? "text-green-600 dark:text-green-400"
    : score >= 70 ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
      {/* Score + counts row */}
      <div className="flex items-center gap-3 text-[11px] flex-wrap">
        <span className={cn("font-bold tabular-nums", scoreColor)} title="Data quality score">
          {score}% quality
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          <strong className="text-gray-700 dark:text-gray-200">{table.columns.length}</strong> cols
        </span>
        {pkCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <KeyRound size={10} /> {pkCount} PK
          </span>
        )}
        {fkCount > 0 && (
          <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
            <Link2 size={10} /> {fkCount} FK
          </span>
        )}
        {nullCols > 0 ? (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle size={10} /> {nullCols} col{nullCols > 1 ? "s" : ""} with nulls
          </span>
        ) : (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 size={10} /> no nulls
          </span>
        )}
      </div>

      {/* Quality score bar */}
      <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Table item ────────────────────────────────────────────────────────────────
function TableItem({
  table,
  onStatsLoaded,
  onDescriptionGenerated,
  onFKsLoaded,
}: {
  table: TableSchema;
  onStatsLoaded: (tableName: string, stats: ColumnStats[]) => void;
  onDescriptionGenerated: (tableName: string, colName: string, desc: string) => void;
  onFKsLoaded: (tableName: string, fks: ForeignKeyInfo[]) => void;
}) {
  const { llmSettings } = useDataStore();
  const [open, setOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [descLoading, setDescLoading] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);

  const handleOpen = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && (!table.columnStats || !table.foreignKeys)) {
      setStatsLoading(true);
      try {
        const db = await getDB();
        if (!table.columnStats) {
          const stats = await computeColumnStats(db, table.name, table.columns);
          onStatsLoaded(table.name, stats);
        }
        if (!table.foreignKeys) {
          const fks = loadForeignKeys(db, table.name);
          onFKsLoaded(table.name, fks);
        }
      } catch { /* ignore */ }
      finally { setStatsLoading(false); }
    }
  }, [open, table, onStatsLoaded, onFKsLoaded]);

  const handleRequestDescription = useCallback(async (colName: string) => {
    if (!table.columnStats) return;
    const col = table.columns.find((c) => c.name === colName);
    const stats = table.columnStats.find((s) => s.columnName === colName);
    if (!col || !stats) return;
    setDescLoading((p) => ({ ...p, [colName]: true }));
    try {
      const desc = await generateColumnDescription(table.name, col, stats, llmSettings);
      onDescriptionGenerated(table.name, colName, desc);
    } catch { /* ignore */ }
    finally { setDescLoading((p) => ({ ...p, [colName]: false })); }
  }, [table, llmSettings, onDescriptionGenerated]);

  const statsMap: Record<string, ColumnStats> = {};
  (table.columnStats ?? []).forEach((s) => { statsMap[s.columnName] = s; });

  // FK lookup by column name
  const fkMap: Record<string, ForeignKeyInfo> = {};
  (table.foreignKeys ?? []).forEach((fk) => { fkMap[fk.column] = fk; });

  const pkCount = table.columns.filter((c) => c.pk > 0).length;
  const fkCount = (table.foreignKeys ?? []).length;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Table header */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
      >
        {open ? <ChevronDown size={13} className="shrink-0 text-gray-400" /> : <ChevronRight size={13} className="shrink-0 text-gray-400" />}
        <TableIcon size={13} className="shrink-0 text-blue-500" />
        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{table.name}</span>
        {statsLoading && <Loader2 size={12} className="animate-spin text-gray-400 shrink-0" />}

        {/* PK/FK chips always visible in table header */}
        {pkCount > 0 && !open && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-amber-500" title={`${pkCount} primary key${pkCount > 1 ? "s" : ""}`}>
            <KeyRound size={10} />{pkCount}
          </span>
        )}
        {fkCount > 0 && !open && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-sky-500" title={`${fkCount} foreign key${fkCount > 1 ? "s" : ""}`}>
            <Link2 size={10} />{fkCount}
          </span>
        )}

        {table.rowCount !== undefined && (
          <span className="text-xs text-gray-400 shrink-0">{table.rowCount.toLocaleString()} rows</span>
        )}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900">

          {/* QA summary bar */}
          <QASummaryBar table={table} fkCount={fkCount} />

          {/* FK relationship overview */}
          {fkCount > 0 && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-sky-50/40 dark:bg-sky-950/20">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 mb-1.5">Relationships</p>
              <div className="flex flex-col gap-1">
                {(table.foreignKeys ?? []).map((fk) => (
                  <div key={fk.column} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                    <Link2 size={10} className="text-sky-400 shrink-0" />
                    <span className="text-sky-700 dark:text-sky-300 font-medium">{fk.column}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-600 dark:text-gray-300">{fk.refTable}</span>
                    <span className="text-gray-400">({fk.refColumn})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data quality issues panel */}
          {table.columnStats && (() => {
            const issues: string[] = [];
            for (const s of table.columnStats) {
              const nullPct = s.total > 0 ? (s.nullCount / s.total) * 100 : 0;
              if (nullPct >= 50) issues.push(`${s.columnName}: ${Math.round(nullPct)}% null`);
            }
            if (!issues.length) return null;
            return (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-red-50/40 dark:bg-red-950/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1 flex items-center gap-1">
                  <ShieldAlert size={10} /> Data Quality Issues
                </p>
                <div className="flex flex-col gap-0.5">
                  {issues.map((iss) => (
                    <p key={iss} className="text-[11px] text-red-600 dark:text-red-400">{iss}</p>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Columns */}
          <div>
            {table.columns.map((col) => (
              <div key={col.name} className="relative">
                {descLoading[col.name] && (
                  <div className="absolute right-2 top-2 z-10">
                    <Loader2 size={10} className="animate-spin text-indigo-400" />
                  </div>
                )}
                <ColumnRow
                  col={col}
                  stats={statsMap[col.name]}
                  fk={fkMap[col.name]}
                  onRequestDescription={handleRequestDescription}
                />
              </div>
            ))}
          </div>

          {/* Preview toggle */}
          {table.preview && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showPreview ? "Hide preview" : "Show 5-row preview"}
              </button>
              {showPreview && <PreviewTable rows={table.preview} />}
            </div>
          )}

          {/* SQL */}
          <details className="px-3 pb-2 border-t border-gray-100 dark:border-gray-800">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 py-1">View CREATE SQL</summary>
            <pre className="mt-1 text-[10px] bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400">
              {table.sql}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ── SchemaExplorer ────────────────────────────────────────────────────────────

interface SchemaExplorerProps {
  onColumnClick?: (col: ColumnInfo, tableName: string) => void;
}

export function SchemaExplorer({ onColumnClick: _onColumnClick }: SchemaExplorerProps) {
  const { schemas, context, setContext, setSchemas, clearMessages, setSuggestedQuestions } = useDataStore();
  const [search, setSearch] = useState("");

  const handleStatsLoaded = useCallback((tableName: string, stats: ColumnStats[]) => {
    setSchemas(schemas.map((t) => t.name === tableName ? { ...t, columnStats: stats } : t));
  }, [schemas, setSchemas]);

  const handleFKsLoaded = useCallback((tableName: string, fks: ForeignKeyInfo[]) => {
    setSchemas(schemas.map((t) => t.name === tableName ? { ...t, foreignKeys: fks } : t));
  }, [schemas, setSchemas]);

  const handleDescriptionGenerated = useCallback((tableName: string, colName: string, desc: string) => {
    setSchemas(schemas.map((t) => {
      if (t.name !== tableName) return t;
      const newStats = (t.columnStats ?? []).map((s) =>
        s.columnName === colName ? { ...s, description: desc } : s,
      );
      return { ...t, columnStats: newStats };
    }));
  }, [schemas, setSchemas]);

  const filtered = search
    ? schemas.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase())),
      )
    : schemas;

  async function handleLoadNewData() {
    const db = await getDB();
    db.dropAllTables();
    setSchemas([]);
    clearMessages();
    setSuggestedQuestions([]);
  }

  if (!schemas.length) return null;

  // Overall dataset health
  const allStats = schemas.flatMap((t) => t.columnStats ?? []);
  const overallScore = allStats.length ? healthScore(allStats) : null;
  const totalFKs = schemas.reduce((n, t) => n + (t.foreignKeys?.length ?? 0), 0);
  const totalPKs = schemas.reduce((n, t) => n + t.columns.filter((c) => c.pk > 0).length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Schema</h2>
          <button
            onClick={handleLoadNewData}
            title="Clear data and load new dataset"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-colors"
          >
            <FolderOpen size={11} /> Load new
          </button>
        </div>

        {/* Dataset-level KPIs */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            <strong className="text-gray-700 dark:text-gray-200">{schemas.length}</strong> table{schemas.length !== 1 ? "s" : ""}
          </span>
          {totalPKs > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400">
              <KeyRound size={10} /> {totalPKs} PK{totalPKs > 1 ? "s" : ""}
            </span>
          )}
          {totalFKs > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-sky-600 dark:text-sky-400">
              <Link2 size={10} /> {totalFKs} FK{totalFKs > 1 ? "s" : ""}
            </span>
          )}
          {overallScore !== null && (
            <span className={cn(
              "text-[11px] font-medium",
              overallScore >= 90 ? "text-green-600 dark:text-green-400"
              : overallScore >= 70 ? "text-yellow-600 dark:text-yellow-400"
              : "text-red-600 dark:text-red-400",
            )}>
              {overallScore}% quality
            </span>
          )}
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables & columns…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((table) => (
          <TableItem
            key={table.name}
            table={table}
            onStatsLoaded={handleStatsLoaded}
            onDescriptionGenerated={handleDescriptionGenerated}
            onFKsLoaded={handleFKsLoaded}
          />
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No matches</p>}
      </div>

      {/* Context textarea */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">Dataset context</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add notes about this dataset to improve query accuracy…"
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </label>
      </div>
    </div>
  );
}
