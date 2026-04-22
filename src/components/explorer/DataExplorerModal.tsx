import { useState, useCallback } from "react";
import { X, BarChart2, ChevronRight, Loader2, Table2, Hash, Type, Sigma } from "lucide-react";
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type SortingState, getSortedRowModel,
} from "@tanstack/react-table";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { computeColumnStats } from "@/lib/explorerStats";
import type { ColumnStats, QueryRow } from "@/types";
import { cn } from "@/lib/utils";

interface TableStats {
  rows: QueryRow[];
  columnStats: ColumnStats[];
  loading: boolean;
}

function typeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("real") || t.includes("num") || t.includes("float") || t.includes("double"))
    return <Sigma size={11} className="text-indigo-500" />;
  if (t.includes("text") || t.includes("char") || t.includes("varchar"))
    return <Type size={11} className="text-emerald-500" />;
  return <Hash size={11} className="text-gray-400" />;
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-950/40 rounded-md px-1.5 py-0.5 text-indigo-700 dark:text-indigo-300">
      <span className="text-indigo-400 dark:text-indigo-500">{label}</span>
      {value}
    </span>
  );
}

function TableDetail({ tableName }: { tableName: string }) {
  const { schemas } = useDataStore();
  const schema = schemas.find((s) => s.name === tableName);
  const [stats, setStats] = useState<TableStats | null>(null);
  const [activeSection, setActiveSection] = useState<"profile" | "data">("profile");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadStats = useCallback(async () => {
    if (stats || !schema) return;
    setStats({ rows: [], columnStats: [], loading: true });
    const db = await getDB();
    const rows = db.exec(`SELECT * FROM ${JSON.stringify(tableName)} LIMIT 500`, { rowMode: "object" }) as QueryRow[];
    const columnStats = await computeColumnStats(db, tableName, schema.columns);
    setStats({ rows, columnStats, loading: false });
  }, [stats, schema, tableName]);

  // Load on mount
  if (!stats) loadStats();

  const columns = (schema?.columns ?? []).map((col) => ({
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

  if (!schema) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2 mb-1">
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

      {/* Section toggle */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0 px-6">
        {(["profile", "data"] as const).map((s) => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={cn(
              "py-2.5 px-1 mr-4 text-xs font-medium border-b-2 -mb-px transition-colors capitalize",
              activeSection === s
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}>
            {s === "profile" ? "Column Profiles" : "Data Preview"}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {stats?.loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 p-6">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : activeSection === "profile" ? (
          <div className="p-6 space-y-3">
            {stats?.columnStats.map((cs) => (
              <div key={cs.columnName}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {typeIcon(schema.columns.find((c) => c.name === cs.columnName)?.type ?? "")}
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cs.columnName}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {schema.columns.find((c) => c.name === cs.columnName)?.type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatBadge label="total" value={cs.total.toLocaleString()} />
                  <StatBadge label="distinct" value={cs.distinct.toLocaleString()} />
                  {cs.nullCount > 0 && <StatBadge label="nulls" value={cs.nullCount.toLocaleString()} />}
                  {cs.min !== undefined && <StatBadge label="min" value={String(cs.min)} />}
                  {cs.max !== undefined && <StatBadge label="max" value={String(cs.max)} />}
                  {cs.avg !== undefined && <StatBadge label="avg" value={Number(cs.avg).toFixed(2)} />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} onClick={h.column.getToggleSortingHandler()}
                          className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none border-b border-gray-200 dark:border-gray-700">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[160px] overflow-hidden text-ellipsis">
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
                <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} · {stats?.rows.length.toLocaleString()} rows loaded</span>
                <div className="flex gap-1">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">‹</button>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">›</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DataExplorerModal() {
  const { explorerOpen, toggleExplorer, schemas } = useDataStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const activeTable = selectedTable ?? schemas[0]?.name ?? null;

  if (!explorerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-white dark:bg-gray-950">
      {/* Left: table list */}
      <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-200 dark:border-gray-800">
          <BarChart2 size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Data Explorer</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {schemas.map((s) => (
            <button
              key={s.name}
              onClick={() => setSelectedTable(s.name)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors",
                activeTable === s.name
                  ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              )}
            >
              <Table2 size={13} className="shrink-0" />
              <span className="truncate flex-1">{s.name}</span>
              <ChevronRight size={11} className="shrink-0 opacity-40" />
            </button>
          ))}
        </div>
      </aside>

      {/* Right: table detail */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={toggleExplorer}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {activeTable ? (
            <TableDetail key={activeTable} tableName={activeTable} />
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
