import { useState, useCallback } from "react";
import {
  X, BarChart2, Loader2, Table2, Hash, Type, Sigma,
  Calendar, ToggleLeft, ChevronRight, ArrowUpDown, Sparkles,
} from "lucide-react";
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type SortingState, getSortedRowModel,
} from "@tanstack/react-table";
import { useDataStore } from "@/store/useDataStore";
import { runQuery } from "@/lib/db";
import { computeColumnStats } from "@/lib/explorerStats";
import { generateColumnDescription } from "@/lib/schemaAI";
import type { ColumnInfo, ColumnStats, QueryRow, TableSchema } from "@/types";
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

// ── Table detail (right panel) ────────────────────────────────────────────────

type Section = "profile" | "data" | "dictionary";

function TableDetail({ tableName, schema }: { tableName: string; schema: TableSchema }) {
  const { llmSettings } = useDataStore();
  const [stats, setStats] = useState<TableStats | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);

  const loadStats = useCallback(async () => {
    if (stats) return;
    setStats({ rows: [], columnStats: [], loading: true });
    const [rows, columnStats] = await Promise.all([
      runQuery(`SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT 500`),
      computeColumnStats(tableName, schema.columns),
    ]);
    setStats({ rows, columnStats, loading: false });
  }, [stats, schema, tableName]);

  if (!stats) loadStats();

  const updateDescription = useCallback((colName: string, desc: string) => {
    setStats((prev) => prev ? {
      ...prev,
      columnStats: prev.columnStats.map((s) =>
        s.columnName === colName ? { ...s, description: desc } : s
      ),
    } : prev);
  }, []);

  const generateOne = useCallback(async (colName: string) => {
    if (!stats || generating.has(colName)) return;
    const cs = stats.columnStats.find((s) => s.columnName === colName);
    const colInfo = schema.columns.find((c) => c.name === colName);
    if (!cs || !colInfo) return;
    setGenerating((prev) => new Set(prev).add(colName));
    try {
      const desc = await generateColumnDescription(tableName, colInfo, cs, llmSettings);
      updateDescription(colName, desc);
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(colName); return n; });
    }
  }, [stats, generating, schema, tableName, llmSettings, updateDescription]);

  const generateAll = useCallback(async () => {
    if (!stats || generatingAll) return;
    setGeneratingAll(true);
    const pending = stats.columnStats.filter((cs) => !cs.description);
    for (const cs of pending) {
      const colInfo = schema.columns.find((c) => c.name === cs.columnName);
      if (!colInfo) continue;
      setGenerating((prev) => new Set(prev).add(cs.columnName));
      try {
        const desc = await generateColumnDescription(tableName, colInfo, cs, llmSettings);
        updateDescription(cs.columnName, desc);
      } finally {
        setGenerating((prev) => { const n = new Set(prev); n.delete(cs.columnName); return n; });
      }
    }
    setGeneratingAll(false);
  }, [stats, generatingAll, schema, tableName, llmSettings, updateDescription]);

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

  const describedCount = stats?.columnStats.filter((cs) => cs.description).length ?? 0;
  const totalCols = stats?.columnStats.length ?? 0;

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
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 shrink-0 px-6">
        <div className="flex flex-1">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveSection(key)}
              className={cn(
                "py-2.5 px-1 mr-5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeSection === key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}>
              {label}
              {key === "dictionary" && totalCols > 0 && (
                <span className={cn(
                  "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  describedCount === totalCols
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                )}>
                  {describedCount}/{totalCols}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Generate All button — only on dictionary tab */}
        {activeSection === "dictionary" && !stats?.loading && describedCount < totalCols && (
          <button
            onClick={generateAll}
            disabled={generatingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors disabled:opacity-50 mb-px"
          >
            {generatingAll
              ? <Loader2 size={11} className="animate-spin" />
              : <Sparkles size={11} />}
            Generate all
          </button>
        )}
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
              const isGenerating = generating.has(cs.columnName);
              return (
                <div key={cs.columnName} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                  {/* Left: type icon + name + type chip */}
                  <div className="w-56 shrink-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {typeIcon(colInfo.type)}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{cs.columnName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      {colInfo.type}
                    </span>
                  </div>

                  {/* Right: description or generate button */}
                  <div className="flex-1 min-w-0">
                    {isGenerating ? (
                      <div className="flex items-center gap-2 text-xs text-indigo-500">
                        <Loader2 size={11} className="animate-spin" />
                        Generating description…
                      </div>
                    ) : cs.description ? (
                      <div className="group flex items-start gap-2">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex-1">{cs.description}</p>
                        <button
                          onClick={() => generateOne(cs.columnName)}
                          title="Regenerate"
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-all"
                        >
                          <Sparkles size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateOne(cs.columnName)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                      >
                        <Sparkles size={11} />
                        Generate description
                      </button>
                    )}
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

function TableListItem({ schema, active, onClick }: { schema: TableSchema; active: boolean; onClick: () => void }) {
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
    </button>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function DataExplorerModal() {
  const { explorerOpen, toggleExplorer, schemas } = useDataStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const activeTable = selectedTable ?? schemas[0]?.name ?? null;
  const activeSchema = schemas.find((s) => s.name === activeTable);

  if (!explorerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-white dark:bg-gray-950">
      {/* Left: table list */}
      <aside className="w-60 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <BarChart2 size={15} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Data Explorer</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {schemas.length === 0 ? (
            <p className="text-xs text-gray-400 p-4">No tables loaded</p>
          ) : (
            schemas.map((s) => (
              <TableListItem
                key={s.name}
                schema={s}
                active={activeTable === s.name}
                onClick={() => setSelectedTable(s.name)}
              />
            ))
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

      {/* Right: table detail */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={toggleExplorer}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {activeTable && activeSchema ? (
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
