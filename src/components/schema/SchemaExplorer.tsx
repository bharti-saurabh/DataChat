import { useState } from "react";
import { ChevronDown, ChevronRight, Search, TableIcon, BarChart2, Hash, Type, Calendar, ToggleLeft, FolderOpen } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import type { TableSchema, ColumnInfo, QueryRow } from "@/types";
import { getDB } from "@/lib/db";

function typeIcon(type: string) {
  const t = type.toUpperCase();
  if (t.includes("INT")) return <Hash size={12} className="text-blue-500" />;
  if (t.includes("REAL") || t.includes("FLOAT") || t.includes("NUMERIC")) return <BarChart2 size={12} className="text-green-500" />;
  if (t.includes("DATE") || t.includes("TIME")) return <Calendar size={12} className="text-purple-500" />;
  if (t.includes("BOOL")) return <ToggleLeft size={12} className="text-orange-500" />;
  return <Type size={12} className="text-gray-400" />;
}

function PreviewTable({ rows }: { rows: QueryRow[] }) {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto mt-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {c}
              </th>
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

function TableItem({ table, onColumnClick }: { table: TableSchema; onColumnClick: (col: ColumnInfo, tableName: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
      >
        {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        <TableIcon size={14} className="shrink-0 text-blue-500" />
        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{table.name}</span>
        {table.rowCount !== undefined && (
          <span className="text-xs text-gray-400 shrink-0">{table.rowCount.toLocaleString()} rows</span>
        )}
      </button>

      {open && (
        <div className="px-3 py-2 bg-white dark:bg-gray-900 space-y-1">
          {/* Columns */}
          <div className="space-y-0.5">
            {table.columns.map((col) => (
              <button
                key={col.name}
                onClick={() => onColumnClick(col, table.name)}
                title={`Insert ${table.name}.${col.name}`}
                className="w-full flex items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 group"
              >
                <span className="shrink-0">{typeIcon(col.type)}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{col.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{col.type}</span>
                {col.pk === 1 && <span className="text-[10px] text-yellow-500 shrink-0">PK</span>}
              </button>
            ))}
          </div>

          {/* Preview toggle */}
          {table.preview && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              {showPreview ? "Hide preview" : "Show 5-row preview"}
            </button>
          )}
          {showPreview && table.preview && <PreviewTable rows={table.preview} />}

          {/* SQL */}
          <details className="mt-1">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View CREATE SQL</summary>
            <pre className="mt-1 text-[10px] bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400">
              {table.sql}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

interface SchemaExplorerProps {
  onColumnClick?: (col: ColumnInfo, tableName: string) => void;
}

export function SchemaExplorer({ onColumnClick }: SchemaExplorerProps) {
  const { schemas, context, setContext, setSchemas, clearMessages, setSuggestedQuestions } = useDataStore();
  const [search, setSearch] = useState("");

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
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
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
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
          <TableItem key={table.name} table={table} onColumnClick={onColumnClick ?? (() => {})} />
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No matches</p>}
      </div>

      {/* Context textarea */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
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
