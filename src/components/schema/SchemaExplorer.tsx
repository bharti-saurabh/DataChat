import { useState, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Search, TableIcon, BarChart2, Hash,
  Type, Calendar, ToggleLeft, FolderOpen, Sparkles, Loader2,
  AlertTriangle, Info,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { computeColumnStats } from "@/lib/explorerStats";
import { generateColumnDescription } from "@/lib/schemaAI";
import { getDB } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { TableSchema, ColumnInfo, ColumnStats, QueryRow } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  const t = type.toUpperCase();
  if (t.includes("INT"))                                 return <Hash size={11} className="text-blue-500" />;
  if (t.includes("REAL") || t.includes("FLOAT") || t.includes("NUMERIC")) return <BarChart2 size={11} className="text-green-500" />;
  if (t.includes("DATE") || t.includes("TIME"))          return <Calendar size={11} className="text-purple-500" />;
  if (t.includes("BOOL"))                                return <ToggleLeft size={11} className="text-orange-500" />;
  return <Type size={11} className="text-gray-400" />;
}

function fmt(v: unknown): string {
  if (v == null) return "–";
  if (typeof v === "number") return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
  return String(v).slice(0, 20);
}

// ── QA badges for a column ────────────────────────────────────────────────────
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

  if (col.pk === 1)
    badges.push({ label: "PK", color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400", tip: "Primary key" });

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
  col, stats, onRequestDescription,
}: {
  col: ColumnInfo;
  stats?: ColumnStats;
  onRequestDescription: (colName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        {expanded ? <ChevronDown size={11} className="shrink-0 text-gray-400" /> : <ChevronRight size={11} className="shrink-0 text-gray-400" />}
        <span className="shrink-0">{typeIcon(col.type)}</span>
        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate font-medium">{col.name}</span>
        <span className="text-[10px] text-gray-400 shrink-0 font-mono">{col.type}</span>
        {stats && stats.nullCount > 0 && stats.total > 0 && (
          <span className={cn(
            "text-[9px] px-1 py-0.5 rounded shrink-0",
            (stats.nullCount / stats.total) >= 0.5
              ? "bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800",
          )}>
            {Math.round((stats.nullCount / stats.total) * 100)}% ∅
          </span>
        )}
      </button>

      {expanded && stats && (
        <div className="px-3 pb-3 pt-1 bg-gray-50/60 dark:bg-gray-800/30 space-y-2">
          {/* Description */}
          {stats.description ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 italic leading-snug">
              {stats.description}
            </p>
          ) : (
            <button
              onClick={() => onRequestDescription(col.name)}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <Sparkles size={10} /> Generate description
            </button>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="Rows" value={fmt(stats.total)} />
            <Stat label="Distinct" value={fmt(stats.distinct)} />
            <Stat label="Nulls" value={String(stats.nullCount)} />
            {stats.min != null && <Stat label="Min" value={fmt(stats.min)} />}
            {stats.max != null && <Stat label="Max" value={fmt(stats.max)} />}
            {stats.avg != null && <Stat label="Avg" value={Number(stats.avg).toFixed(2)} />}
          </div>

          {/* Top values */}
          {stats.topValues && stats.topValues.length > 0 && (
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

          {/* QA badges */}
          <QABadges stats={stats} col={col} />
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

// ── Table item ────────────────────────────────────────────────────────────────
function TableItem({
  table,
  onStatsLoaded,
  onDescriptionGenerated,
}: {
  table: TableSchema;
  onStatsLoaded: (tableName: string, stats: ColumnStats[]) => void;
  onDescriptionGenerated: (tableName: string, colName: string, desc: string) => void;
}) {
  const { llmSettings } = useDataStore();
  const [open, setOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [descLoading, setDescLoading] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);

  const handleOpen = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !table.columnStats) {
      setStatsLoading(true);
      try {
        const db = await getDB();
        const stats = await computeColumnStats(db, table.name, table.columns);
        onStatsLoaded(table.name, stats);
      } catch { /* ignore */ }
      finally { setStatsLoading(false); }
    }
  }, [open, table, onStatsLoaded]);

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

  // Summary numbers
  const nullCols = table.columnStats
    ? table.columnStats.filter((s) => s.nullCount > 0).length
    : null;

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
        {table.rowCount !== undefined && (
          <span className="text-xs text-gray-400 shrink-0">{table.rowCount.toLocaleString()} rows</span>
        )}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900">
          {/* QA summary bar */}
          {table.columnStats && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-gray-100 dark:border-gray-800 text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">
                <strong className="text-gray-700 dark:text-gray-200">{table.columns.length}</strong> columns
              </span>
              {nullCols !== null && nullCols > 0 && (
                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle size={10} />
                  {nullCols} col{nullCols > 1 ? "s" : ""} with nulls
                </span>
              )}
              {nullCols === 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Info size={10} /> no nulls
                </span>
              )}
            </div>
          )}

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

// onColumnClick kept in props for future use (e.g. insert into SQL editor)
export function SchemaExplorer({ onColumnClick: _onColumnClick }: SchemaExplorerProps) {
  const { schemas, context, setContext, setSchemas, clearMessages, setSuggestedQuestions } = useDataStore();
  const [search, setSearch] = useState("");

  // Store computed stats + descriptions back into schemas via setSchemas
  const handleStatsLoaded = useCallback((tableName: string, stats: ColumnStats[]) => {
    setSchemas(schemas.map((t) => t.name === tableName ? { ...t, columnStats: stats } : t));
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
