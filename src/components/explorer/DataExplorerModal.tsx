import { useState, useCallback } from "react";
import {
  X, BarChart2, Loader2, Table2, Hash, Type, Sigma,
  Calendar, ToggleLeft, ChevronRight, ArrowUpDown, Sparkles,
  GitFork, AlertTriangle, Shield, RefreshCw, Info, Search,
} from "lucide-react";
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type SortingState, getSortedRowModel,
} from "@tanstack/react-table";
import { useDataStore } from "@/store/useDataStore";
import { runQuery } from "@/lib/db";
import { computeColumnStats } from "@/lib/explorerStats";
import { generateSchemaInsights } from "@/lib/schemaInsights";
import type { ColumnInfo, ColumnStats, QueryRow, TableSchema, SchemaInsights } from "@/types";
import { cn } from "@/lib/utils";

interface TableStats {
  rows: QueryRow[];
  columnStats: ColumnStats[];
  loading: boolean;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

function typeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("real") || t.includes("num") || t.includes("float") || t.includes("double") || t.includes("decimal"))
    return <Sigma size={12} className="text-indigo-400" />;
  if (t.includes("bool"))
    return <ToggleLeft size={12} className="text-blue-400" />;
  if (t.includes("date") || t.includes("time") || t.includes("timestamp"))
    return <Calendar size={12} className="text-amber-400" />;
  if (t.includes("text") || t.includes("char") || t.includes("varchar") || t.includes("string"))
    return <Type size={12} className="text-emerald-400" />;
  return <Hash size={12} className="text-gray-400" />;
}

function isNumericType(type: string) {
  return /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL|BIGINT|HUGEINT/i.test(type);
}

function formatNum(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(2).replace(/\.?0+$/, "");
}

// ── Fill rate bar ─────────────────────────────────────────────────────────────

function FillBar({ pct }: { pct: number }) {
  const color = pct === 100 ? "bg-emerald-500" : pct >= 90 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Column profile card ───────────────────────────────────────────────────────

function ColumnCard({ cs, colInfo }: { cs: ColumnStats; colInfo: ColumnInfo }) {
  const fillPct = cs.total > 0 ? ((cs.total - cs.nullCount) / cs.total) * 100 : 100;
  const uniquePct = cs.total > 0 ? (cs.distinct / cs.total) * 100 : 0;
  const numeric = isNumericType(colInfo.type);
  const maxCount = cs.topValueCounts?.[0]?.count ?? 1;
  const nonNull = cs.total - cs.nullCount;

  const cardinalityLabel =
    uniquePct === 100 ? { text: "unique key", cls: "text-indigo-500" } :
    uniquePct > 50    ? { text: "high cardinality", cls: "text-blue-500" } :
    uniquePct <= 5 && cs.total > 10 ? { text: "low cardinality", cls: "text-amber-500" } :
    null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/60">
        {typeIcon(colInfo.type)}
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cs.columnName}</span>
        <span className="ml-auto shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {colInfo.type}
        </span>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Fill rate */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1.5">
            <span className="text-gray-400 font-medium">Fill rate</span>
            <span className={cn(
              "font-semibold",
              fillPct === 100 ? "text-emerald-500" : fillPct >= 90 ? "text-yellow-500" : "text-red-500"
            )}>
              {fillPct.toFixed(1)}%
              {cs.nullCount > 0 && (
                <span className="text-gray-400 font-normal ml-1.5">
                  {cs.nullCount.toLocaleString()} null{cs.nullCount !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
          <FillBar pct={fillPct} />
        </div>

        {/* Cardinality row */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400 font-medium">Cardinality</span>
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-semibold">{cs.distinct.toLocaleString()}</span>
            <span className="text-gray-400 ml-1">
              unique ({uniquePct < 0.1 ? "<0.1" : uniquePct < 1 ? uniquePct.toFixed(2) : uniquePct.toFixed(1)}%)
            </span>
            {cardinalityLabel && (
              <span className={`ml-1.5 font-medium ${cardinalityLabel.cls}`}>{cardinalityLabel.text}</span>
            )}
          </span>
        </div>

        {/* Numeric stats grid */}
        {numeric && cs.min !== undefined && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Min",     value: formatNum(cs.min) },
              { label: "Max",     value: formatNum(cs.max) },
              { label: "Avg",     value: cs.avg != null ? formatNum(cs.avg) : "—" },
              { label: "Std dev", value: cs.stddev != null ? formatNum(cs.stddev) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2 py-2 text-center">
                <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate" title={value}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top value frequency bars */}
        {cs.topValueCounts && cs.topValueCounts.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Top values
            </p>
            <div className="space-y-2">
              {cs.topValueCounts.map(({ value, count }) => {
                const pct = nonNull > 0 ? (count / nonNull) * 100 : 0;
                return (
                  <div key={value}>
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[55%]" title={value}>
                        {value}
                      </span>
                      <span className="text-gray-400 shrink-0 tabular-nums">
                        {count.toLocaleString()}
                        <span className="text-gray-500 ml-1">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400/70"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auto-description from stats ───────────────────────────────────────────────

function autoDescription(cs: ColumnStats, colType: string): string {
  const parts: string[] = [];
  const isNum = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL|BIGINT/i.test(colType);
  const isDate = /DATE|TIME|TIMESTAMP/i.test(colType);
  if (cs.total > 0) {
    const fillPct = Math.round(((cs.total - cs.nullCount) / cs.total) * 100);
    if (fillPct < 100) parts.push(`${fillPct}% filled`);
    const uniquePct = Math.round((cs.distinct / cs.total) * 100);
    if (uniquePct === 100) parts.push("all values unique");
    else parts.push(`${cs.distinct.toLocaleString()} distinct values`);
  }
  if ((isNum || isDate) && cs.min != null && cs.max != null) {
    parts.push(`range ${formatNum(cs.min)} – ${formatNum(cs.max)}`);
    if (isNum && cs.avg != null) parts.push(`avg ${formatNum(cs.avg)}`);
  }
  if (!isNum && !isDate && cs.topValueCounts?.length) {
    parts.push(`e.g. ${cs.topValueCounts.slice(0, 3).map((t) => t.value).join(", ")}`);
  }
  return parts.join(" · ");
}

// ── Table detail (right panel) ────────────────────────────────────────────────

type Section = "profile" | "data" | "dictionary";

function TableDetail({ tableName, schema }: { tableName: string; schema: TableSchema }) {
  const [stats, setStats] = useState<TableStats | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadStats = useCallback(async () => {
    if (stats) return;
    setStats({ rows: [], columnStats: [], loading: true });
    const cachedStats = schema.columnStats;
    const [rows, columnStats] = await Promise.all([
      runQuery(`SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT 500`),
      cachedStats ? Promise.resolve(cachedStats) : computeColumnStats(tableName, schema.columns),
    ]);
    setStats({ rows, columnStats, loading: false });
  }, [stats, schema, tableName]);

  if (!stats) loadStats();

  const columns = schema.columns.map((col) => ({
    id: col.name,
    accessorKey: col.name,
    header: col.name,
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const v = getValue();
      return (
        <span className="whitespace-nowrap text-xs">
          {v === null || v === undefined
            ? <span className="text-gray-400 italic text-[10px]">null</span>
            : String(v)}
        </span>
      );
    },
  }));

  const table = useReactTable({
    data: stats?.rows ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const TABS: { key: Section; label: string }[] = [
    { key: "profile",    label: "Column Profiles" },
    { key: "data",       label: "Data Preview" },
    { key: "dictionary", label: "Dictionary" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <Table2 size={16} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{tableName}</h2>
          {schema.rowCount !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-medium">
              {schema.rowCount.toLocaleString()} rows
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">{schema.columns.length} columns</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 px-6">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={cn(
              "py-2.5 px-1 mr-5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeSection === key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {stats?.loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 p-8">
            <Loader2 size={14} className="animate-spin" /> Analysing columns…
          </div>
        ) : activeSection === "profile" ? (
          <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {stats?.columnStats.map((cs) => {
              const colInfo = schema.columns.find((c) => c.name === cs.columnName);
              if (!colInfo) return null;
              return <ColumnCard key={cs.columnName} cs={cs} colInfo={colInfo} />;
            })}
          </div>
        ) : activeSection === "data" ? (
          <div className="p-6">
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} onClick={h.column.getToggleSortingHandler()}
                          className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <ArrowUpDown size={10} className="opacity-30" />
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] overflow-hidden text-ellipsis">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                <span>
                  Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  {" · "}{stats?.rows.length.toLocaleString()} rows loaded
                </span>
                <div className="flex gap-1">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">‹</button>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">›</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Dictionary tab */
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {stats?.columnStats.map((cs) => {
              const colInfo = schema.columns.find((c) => c.name === cs.columnName);
              if (!colInfo) return null;
              const desc = cs.description || autoDescription(cs, colInfo.type);
              return (
                <div key={cs.columnName} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                  <div className="w-56 shrink-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {typeIcon(colInfo.type)}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{cs.columnName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      {colInfo.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-relaxed",
                      cs.description ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500 italic"
                    )}>{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Left panel table row ──────────────────────────────────────────────────────

function TableListItem({ schema, active, onClick, matchingCols }: {
  schema: TableSchema; active: boolean; onClick: () => void; matchingCols?: string[];
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 transition-colors",
        active
          ? "bg-indigo-50 dark:bg-indigo-950/50 border-l-2 border-l-indigo-500"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/40 border-l-2 border-l-transparent",
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Table2 size={12} className={active ? "text-indigo-500" : "text-gray-400"} />
        <span className={cn(
          "text-sm font-medium truncate",
          active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300",
        )}>
          {schema.name}
        </span>
        <ChevronRight size={10} className="ml-auto shrink-0 opacity-30" />
      </div>
      <div className="pl-[20px] flex gap-3 text-[10px] text-gray-400">
        {schema.rowCount !== undefined && (
          <span>{schema.rowCount.toLocaleString()} rows</span>
        )}
        <span>{schema.columns.length} cols</span>
      </div>
      {matchingCols && matchingCols.length > 0 && (
        <div className="pl-5 mt-1 flex flex-wrap gap-1">
          {matchingCols.slice(0, 5).map((c) => (
            <span key={c} className="text-[9px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded font-mono">
              {c}
            </span>
          ))}
          {matchingCols.length > 5 && (
            <span className="text-[9px] text-gray-400">+{matchingCols.length - 5}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ── AI Schema Insights view ───────────────────────────────────────────────────

const PATTERN_META: Record<string, { label: string; cls: string }> = {
  star_schema: { label: "Star Schema",         cls: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300" },
  snowflake:   { label: "Snowflake",           cls: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300" },
  flat:        { label: "Flat / Denormalized", cls: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" },
  mixed:       { label: "Mixed",               cls: "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300" },
  unknown:     { label: "Unknown",             cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
};

const TABLE_TYPE_META: Record<string, { label: string; cls: string }> = {
  fact:      { label: "Fact",      cls: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" },
  dimension: { label: "Dimension", cls: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  lookup:    { label: "Lookup",    cls: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" },
  bridge:    { label: "Bridge",    cls: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  unknown:   { label: "Unknown",   cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700" },
};

const CONFIDENCE_CLS: Record<string, string> = {
  high:   "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  low:    "text-red-600 dark:text-red-400",
};

function SeverityIcon({ s }: { s: string }) {
  if (s === "high")   return <AlertTriangle size={10} className="text-red-500 shrink-0 mt-0.5" />;
  if (s === "medium") return <AlertTriangle size={10} className="text-amber-500 shrink-0 mt-0.5" />;
  return <Info size={10} className="text-blue-400 shrink-0 mt-0.5" />;
}

function InsightsResults({ insights, onReanalyze, loading }: { insights: SchemaInsights; onReanalyze: () => void; loading: boolean }) {
  const { tables, relationships, modelingRecommendations, architecturePattern, generatedAt } = insights;
  const pm = PATTERN_META[architecturePattern] ?? PATTERN_META.unknown;

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Results header bar */}
      <div className="px-6 py-3.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Sparkles size={13} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Schema Analysis</span>
          <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full", pm.cls)}>{pm.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400">
            {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={onReanalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            Re-analyze
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-8">
        {/* Table Intelligence */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Table Intelligence · {tables.length} tables
          </h3>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {tables.map((t) => {
              const tm = TABLE_TYPE_META[t.tableType] ?? TABLE_TYPE_META.unknown;
              return (
                <div key={t.name} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700/60">
                    <Table2 size={12} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate flex-1">{t.name}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", tm.cls)}>{tm.label}</span>
                    <span className={cn("text-[10px] ml-1 shrink-0 font-medium", CONFIDENCE_CLS[t.typeConfidence])}>
                      {t.typeConfidence}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{t.description}</p>

                    {/* PK + PII badges */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {t.primaryKeyColumns.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">PK</span>
                          {t.primaryKeyColumns.map((c) => (
                            <span key={c} className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      {t.piiColumns.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Shield size={10} className="text-red-500 shrink-0" />
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">PII</span>
                          {t.piiColumns.map((c) => (
                            <span key={c} className="text-[10px] font-mono bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quality Issues */}
                    {t.qualityIssues.length > 0 && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 px-3 py-2 space-y-1.5">
                        {t.qualityIssues.map((qi, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px]">
                            <SeverityIcon s={qi.severity} />
                            <span className="text-gray-400 font-mono shrink-0">{qi.column}:</span>
                            <span className="text-gray-600 dark:text-gray-400">{qi.issue}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {t.recommendations.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-700/60 pt-2.5 space-y-1">
                        {t.recommendations.map((r, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px]">
                            <span className="text-indigo-400 font-bold shrink-0 mt-px">›</span>
                            <span className="text-gray-600 dark:text-gray-400">{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Detected Relationships */}
        {relationships.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <GitFork size={12} /> Detected Relationships · {relationships.length}
            </h3>
            <div className="space-y-2">
              {relationships.map((rel, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-indigo-500">{rel.fromTable}.{rel.fromColumn}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-mono text-indigo-500">{rel.toTable}.{rel.toColumn}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border",
                        rel.confidence === "high"   ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" :
                        rel.confidence === "medium" ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                                                      "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
                      )}>
                        {rel.type}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{rel.description}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium shrink-0", CONFIDENCE_CLS[rel.confidence])}>
                    {rel.confidence}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Global Modeling Recommendations */}
        {modelingRecommendations.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Global Modeling Recommendations
            </h3>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {modelingRecommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <span className="text-indigo-400 font-bold text-sm shrink-0 leading-tight">{i + 1}.</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function InsightsView() {
  const { schemas, llmSettings, schemaInsights, setSchemaInsights } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const analyze = async () => {
    if (loading || schemas.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const insights = await generateSchemaInsights(schemas, llmSettings);
      setSchemaInsights(insights);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Check your LLM settings.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Analyzing schema with AI…</p>
          <p className="text-xs text-gray-400 mt-1">This may take 15–30 seconds</p>
        </div>
      </div>
    );
  }

  if (schemaInsights) {
    return <InsightsResults insights={schemaInsights} onReanalyze={analyze} loading={loading} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-gray-400 px-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
        <Sparkles size={28} className="text-indigo-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1.5">AI Schema Intelligence</h3>
        <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
          Detect table types, PII columns, data quality issues, relationships, and architecture patterns — powered by your LLM.
        </p>
      </div>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-4 py-2 rounded-lg max-w-sm">
          {error}
        </p>
      )}
      <button
        onClick={analyze}
        disabled={schemas.length === 0}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
      >
        <Sparkles size={14} />
        Analyze {schemas.length} Table{schemas.length !== 1 ? "s" : ""}
      </button>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

type ExplorerView = "tables" | "insights";

export function DataExplorerModal() {
  const { explorerOpen, toggleExplorer, schemas } = useDataStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [view, setView] = useState<ExplorerView>("tables");
  const [colSearch, setColSearch] = useState("");

  const activeTable = selectedTable ?? schemas[0]?.name ?? null;
  const activeSchema = schemas.find((s) => s.name === activeTable);

  const filteredSchemas = colSearch.trim()
    ? schemas.filter((s) =>
        s.name.toLowerCase().includes(colSearch.toLowerCase()) ||
        s.columns.some((c) => c.name.toLowerCase().includes(colSearch.toLowerCase()))
      )
    : schemas;

  if (!explorerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-white dark:bg-gray-950">
      {/* Left: table list */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <BarChart2 size={15} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Data Explorer</span>
        </div>

        {/* Top-level view tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
          {(["tables", "insights"] as ExplorerView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("shrink-0 flex-1 py-2 px-1 text-xs font-medium transition-colors whitespace-nowrap",
                view === v
                  ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}>
              {v === "tables" ? "Tables" : "✦ AI Insights"}
            </button>
          ))}
        </div>

        {/* Cross-column search */}
        {view === "tables" && schemas.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
                placeholder="Search tables & columns…"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {schemas.length === 0 ? (
            <p className="text-xs text-gray-400 p-4">No tables loaded</p>
          ) : (
            filteredSchemas.map((s) => {
              const matchingCols = colSearch.trim()
                ? s.columns.filter((c) => c.name.toLowerCase().includes(colSearch.toLowerCase())).map((c) => c.name)
                : undefined;
              return (
                <TableListItem
                  key={s.name}
                  schema={s}
                  active={view === "tables" && activeTable === s.name}
                  onClick={() => { setSelectedTable(s.name); setView("tables"); setColSearch(""); }}
                  matchingCols={matchingCols}
                />
              );
            })
          )}
          {colSearch.trim() && filteredSchemas.length === 0 && (
            <p className="text-xs text-gray-400 p-4">No matches for "{colSearch}"</p>
          )}
        </div>

        {/* Summary footer */}
        {schemas.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <p className="text-[10px] text-gray-400">
              {schemas.length} table{schemas.length !== 1 ? "s" : ""} ·{" "}
              {schemas.reduce((sum, s) => sum + (s.rowCount ?? 0), 0).toLocaleString()} total rows
            </p>
          </div>
        )}
      </aside>

      {/* Right: content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={toggleExplorer}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {view === "insights" ? (
            <InsightsView />
          ) : activeTable && activeSchema ? (
            <TableDetail key={activeTable} tableName={activeTable} schema={activeSchema} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Table2 size={36} className="opacity-20" />
              <p className="text-sm">Load a dataset to explore its tables</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
