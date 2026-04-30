import { useState, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Search, TableIcon,
  Hash, Type, Calendar, ToggleLeft, BarChart2, FolderOpen,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { dropAllTables } from "@/lib/db";
import type { TableSchema, ColumnInfo } from "@/types";

function typeIcon(type: string) {
  const t = type.toUpperCase();
  if (t.includes("INT"))                                                    return <Hash size={10} className="text-blue-400 shrink-0" />;
  if (t.includes("REAL") || t.includes("FLOAT") || t.includes("NUMERIC"))  return <BarChart2 size={10} className="text-emerald-400 shrink-0" />;
  if (t.includes("DATE") || t.includes("TIME"))                             return <Calendar size={10} className="text-purple-400 shrink-0" />;
  if (t.includes("BOOL"))                                                   return <ToggleLeft size={10} className="text-orange-400 shrink-0" />;
  return <Type size={10} className="text-gray-400 shrink-0" />;
}

function TableItem({ table, search }: { table: TableSchema; search: string }) {
  const [open, setOpen] = useState(false);

  const cols: ColumnInfo[] = search
    ? table.columns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : table.columns;

  const matchesSearch = !search || table.name.toLowerCase().includes(search.toLowerCase()) || cols.length > 0;
  if (!matchesSearch) return null;

  const showOpen = open || Boolean(search);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        {showOpen
          ? <ChevronDown size={11} className="shrink-0 text-gray-400" />
          : <ChevronRight size={11} className="shrink-0 text-gray-400" />}
        <TableIcon size={11} className="shrink-0 text-indigo-400" />
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{table.name}</span>
        {table.rowCount !== undefined && (
          <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
            {table.rowCount >= 1000 ? `${(table.rowCount / 1000).toFixed(0)}K` : table.rowCount}
          </span>
        )}
      </button>

      {showOpen && (
        <div className="pb-1">
          {cols.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-1.5 pl-8 pr-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
            >
              {typeIcon(col.type)}
              <span className="text-[11px] text-gray-700 dark:text-gray-300 flex-1 truncate">{col.name}</span>
              <span className="text-[9px] font-mono text-gray-400 shrink-0">{col.type.split("(")[0]}</span>
            </div>
          ))}
          {cols.length === 0 && search && (
            <p className="text-[10px] text-gray-400 pl-8 py-1">No matching columns</p>
          )}
        </div>
      )}
    </div>
  );
}

interface SchemaExplorerProps {
  onColumnClick?: (col: ColumnInfo, tableName: string) => void;
}

export function SchemaExplorer({ onColumnClick: _onColumnClick }: SchemaExplorerProps) {
  const { schemas, context, setContext, setSchemas, clearMessages, setSuggestedQuestions } = useDataStore();
  const [search, setSearch] = useState("");

  const handleLoadNewData = useCallback(async () => {
    await dropAllTables();
    setSchemas([]);
    clearMessages();
    setSuggestedQuestions([]);
  }, [setSchemas, clearMessages, setSuggestedQuestions]);

  if (!schemas.length) return null;

  const totalCols = schemas.reduce((n, t) => n + t.columns.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {schemas.length} table{schemas.length !== 1 ? "s" : ""} · {totalCols} cols
          </span>
          <button
            onClick={handleLoadNewData}
            title="Clear and load new data"
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
          >
            <FolderOpen size={10} /> Load new
          </button>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tables & columns…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
        {schemas.map((table) => (
          <TableItem key={table.name} table={table} search={search} />
        ))}
        {schemas.length > 0 && search && schemas.every((t) =>
          !t.name.toLowerCase().includes(search.toLowerCase()) &&
          !t.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        ) && (
          <p className="text-xs text-gray-400 text-center py-6">No matches for "{search}"</p>
        )}
      </div>

      {/* Dataset context */}
      <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Dataset context</p>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Notes to improve query accuracy…"
          rows={3}
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none"
        />
      </div>
    </div>
  );
}
