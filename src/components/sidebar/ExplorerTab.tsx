import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, BarChart2, Loader2 } from "lucide-react";
import {
  useReactTable, getCoreRowModel, getPaginationRowModel,
  flexRender, type SortingState, getSortedRowModel,
} from "@tanstack/react-table";
import { useDataStore } from "@/store/useDataStore";
import { runQuery } from "@/lib/db";
import { computeColumnStats } from "@/lib/explorerStats";
import type { ColumnStats, QueryRow } from "@/types";

interface TableStats {
  rows: QueryRow[];
  columnStats: ColumnStats[];
  loading: boolean;
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-gray-600 dark:text-gray-400">
      <span className="font-medium text-gray-500">{label}</span> {value}
    </span>
  );
}

function TableExplorer({ tableName }: { tableName: string }) {
  const { schemas } = useDataStore();
  const schema = schemas.find((s) => s.name === tableName);
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<TableStats | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadStats = useCallback(async () => {
    if (stats || !schema) return;
    setStats({ rows: [], columnStats: [], loading: true });
    const rows = await runQuery(`SELECT * FROM "${tableName.replace(/"/g, '""')}"`);
    const columnStats = await computeColumnStats(tableName, schema.columns);
    setStats({ rows, columnStats, loading: false });
  }, [stats, schema, tableName]);

  const columns = (schema?.columns ?? []).map((col) => ({
    id: col.name,
    accessorKey: col.name,
    header: col.name,
    cell: ({ getValue }: { getValue: () => unknown }) => {
      const v = getValue();
      return <span className="whitespace-nowrap text-[11px]">{v === null || v === undefined ? <span className="text-gray-400 italic">null</span> : String(v)}</span>;
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
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) loadStats(); }}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
      >
        {open ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
        <BarChart2 size={13} className="shrink-0 text-blue-500" />
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{tableName}</span>
        {schema?.rowCount !== undefined && (
          <span className="text-[10px] text-gray-400">{schema.rowCount.toLocaleString()} rows</span>
        )}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900 px-3 py-2 space-y-3">
          {stats?.loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
              <Loader2 size={12} className="animate-spin" /> Computing stats…
            </div>
          )}

          {/* Column stats */}
          {stats && !stats.loading && stats.columnStats.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Column profiles</p>
              <div className="space-y-1.5">
                {stats.columnStats.map((cs) => (
                  <div key={cs.columnName} className="bg-gray-50 dark:bg-gray-800/50 rounded p-1.5">
                    <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">{cs.columnName}</p>
                    <div className="flex flex-wrap gap-1">
                      <StatBadge label="distinct" value={cs.distinct.toLocaleString()} />
                      {cs.nullCount > 0 && <StatBadge label="nulls" value={cs.nullCount.toLocaleString()} />}
                      {cs.min !== undefined && <StatBadge label="min" value={String(cs.min)} />}
                      {cs.max !== undefined && <StatBadge label="max" value={String(cs.max)} />}
                      {cs.avg !== undefined && <StatBadge label="avg" value={Number(cs.avg).toFixed(2)} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data grid */}
          {stats && !stats.loading && stats.rows.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Data</p>
              <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((h) => (
                          <th key={h.id} onClick={h.column.getToggleSortingHandler()}
                            className="px-2 py-1 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
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
                          <td key={cell.id} className="px-2 py-1 text-gray-700 dark:text-gray-300 max-w-[100px] overflow-hidden text-ellipsis">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                  <span>Page {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}</span>
                  <div className="flex gap-1">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40">‹</button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40">›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExplorerTab() {
  const { schemas } = useDataStore();

  if (!schemas.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2 p-4">
        <BarChart2 size={22} className="opacity-40" />
        <p className="text-xs text-center">Load a dataset to explore its tables</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Data Explorer</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">Browse data and column statistics</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {schemas.map((s) => <TableExplorer key={s.name} tableName={s.name} />)}
      </div>
    </div>
  );
}
