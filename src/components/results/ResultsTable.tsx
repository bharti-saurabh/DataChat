import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, FileJson, Sheet, SlidersHorizontal, X } from "lucide-react";
import type { QueryRow } from "@/types";
import { exportCSV, exportExcel, exportJSON } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  data: QueryRow[];
  question?: string;
}

// ── Column format types ───────────────────────────────────────────────────────
type FormatType = "raw" | "number" | "currency" | "percent" | "custom";

interface ColFormat {
  type: FormatType;
  decimals: number;
  prefix: string;
  suffix: string;
}

const DEFAULT_FORMAT: ColFormat = { type: "raw", decimals: 0, prefix: "", suffix: "" };

function applyFormat(value: unknown, fmt: ColFormat): string {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  const isNum = !isNaN(num) && value !== "" && value !== true && value !== false;

  if (!isNum || fmt.type === "raw") return String(value);

  let formatted: string;
  if (fmt.type === "number") {
    formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: fmt.decimals,
      maximumFractionDigits: fmt.decimals,
    });
  } else if (fmt.type === "currency") {
    formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: fmt.decimals || 2,
      maximumFractionDigits: fmt.decimals || 2,
    });
    return `${fmt.prefix || "$"}${formatted}${fmt.suffix}`;
  } else if (fmt.type === "percent") {
    formatted = `${(num * (fmt.prefix === "×100" ? 100 : 1)).toLocaleString("en-US", {
      minimumFractionDigits: fmt.decimals || 1,
      maximumFractionDigits: fmt.decimals || 1,
    })}%`;
    return `${formatted}${fmt.suffix}`;
  } else {
    // custom
    formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: fmt.decimals,
      maximumFractionDigits: fmt.decimals,
    });
  }
  return `${fmt.prefix}${formatted}${fmt.suffix}`;
}

// ── Format popover for a column ───────────────────────────────────────────────
const FORMAT_PRESETS: { label: string; fmt: Partial<ColFormat>; example: string }[] = [
  { label: "None",       fmt: { type: "raw" },                                       example: "1234.5"    },
  { label: "Number",     fmt: { type: "number",   decimals: 0, prefix: "", suffix: "" }, example: "1,235"    },
  { label: "Decimal",    fmt: { type: "number",   decimals: 2, prefix: "", suffix: "" }, example: "1,234.50" },
  { label: "Currency $", fmt: { type: "currency", decimals: 2, prefix: "$", suffix: "" }, example: "$1,234.50"},
  { label: "Currency €", fmt: { type: "currency", decimals: 2, prefix: "€", suffix: "" }, example: "€1,234.50"},
  { label: "Percent",    fmt: { type: "percent",  decimals: 1, prefix: "",   suffix: "" }, example: "1,234.5%"  },
  { label: "Pct ×100",   fmt: { type: "percent",  decimals: 1, prefix: "×100", suffix: "" }, example: "12.3%"  },
];

function FormatPopover({
  col, format, onUpdate, onClose,
}: {
  col: string;
  format: ColFormat;
  onUpdate: (fmt: ColFormat) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<ColFormat>({ ...format });
  const apply = () => { onUpdate(local); onClose(); };

  return (
    <div className="absolute top-full left-0 z-30 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Format: <span className="text-indigo-600">{col}</span></p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {FORMAT_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setLocal((prev) => ({ ...prev, ...p.fmt }))}
            className={cn(
              "flex flex-col items-start px-2 py-1.5 rounded-lg text-left border transition-colors",
              local.type === p.fmt.type && (p.fmt.prefix === undefined || local.prefix === (p.fmt.prefix ?? ""))
                && (p.fmt.suffix === undefined || local.suffix === (p.fmt.suffix ?? ""))
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50"
                : "border-gray-200 dark:border-gray-700 hover:border-indigo-300",
            )}
          >
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{p.label}</span>
            <span className="text-[10px] text-gray-400 font-mono">{p.example}</span>
          </button>
        ))}
      </div>

      {/* Custom controls */}
      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Prefix</label>
            <input value={local.prefix} onChange={(e) => setLocal((p) => ({ ...p, prefix: e.target.value }))}
              placeholder="$, €, ¥…"
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Suffix</label>
            <input value={local.suffix} onChange={(e) => setLocal((p) => ({ ...p, suffix: e.target.value }))}
              placeholder="%, K, M…"
              className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Decimal places</label>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((d) => (
              <button key={d} onClick={() => setLocal((p) => ({ ...p, decimals: d }))}
                className={cn("w-8 h-6 rounded text-xs font-medium transition-colors",
                  local.decimals === d ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50")}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={apply}
        className="mt-2 w-full text-xs py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
        Apply
      </button>
    </div>
  );
}

// ── ResultsTable ──────────────────────────────────────────────────────────────

export function ResultsTable({ data }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [colFormats, setColFormats] = useState<Record<string, ColFormat>>({});
  const [formatOpen, setFormatOpen] = useState<string | null>(null);
  const [showFormatBar, setShowFormatBar] = useState(false);

  const colKeys = useMemo(() => Object.keys(data[0] ?? {}), [data]);

  const getFormat = (col: string) => colFormats[col] ?? DEFAULT_FORMAT;
  const setFormat = (col: string, fmt: ColFormat) => setColFormats((p) => ({ ...p, [col]: fmt }));
  const isNumericCol = (col: string) => data.some((row) => {
    const v = row[col];
    return v !== null && v !== undefined && !isNaN(Number(v)) && String(v).trim() !== "";
  });

  const columns = useMemo(
    () =>
      colKeys.map((key) => ({
        id: key,
        accessorKey: key,
        header: key,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue();
          if (v === null || v === undefined) return <span className="text-gray-400 italic whitespace-nowrap">null</span>;
          const fmt = getFormat(key);
          const formatted = applyFormat(v, fmt);
          const isNum = isNumericCol(key);
          return (
            <span className={cn("whitespace-nowrap tabular-nums", isNum && fmt.type !== "raw" && "text-right block")}>
              {formatted}
            </span>
          );
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colKeys, colFormats],
  );

  const filtered = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [data, searchQuery]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  // Count columns that have non-default formatting
  const activeFormats = Object.values(colFormats).filter((f) => f.type !== "raw").length;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">
          {data.length.toLocaleString()} row{data.length !== 1 ? "s" : ""}
          {filtered.length !== data.length && ` (${filtered.length.toLocaleString()} filtered)`}
        </span>

        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter results…"
          className="ml-auto text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36" />

        {/* Format toggle */}
        <button onClick={() => setShowFormatBar((v) => !v)}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors",
            showFormatBar
              ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400",
          )}>
          <SlidersHorizontal size={12} />
          Format{activeFormats > 0 ? ` (${activeFormats})` : ""}
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => exportCSV(filtered)} title="Download CSV"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => exportExcel(filtered)} title="Download Excel"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <Sheet size={12} /> Excel
          </button>
          <button onClick={() => exportJSON(filtered)} title="Download JSON"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <FileJson size={12} /> JSON
          </button>
        </div>
      </div>

      {/* Format bar — quick presets per numeric column */}
      {showFormatBar && (
        <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          {colKeys.filter(isNumericCol).map((col) => {
            const fmt = getFormat(col);
            return (
              <div key={col} className="relative">
                <button
                  onClick={() => setFormatOpen((v) => (v === col ? null : col))}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors",
                    fmt.type !== "raw"
                      ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-300 hover:text-indigo-600",
                  )}>
                  <SlidersHorizontal size={10} />
                  <span className="max-w-[80px] truncate">{col}</span>
                  {fmt.type !== "raw" && (
                    <span className="text-[9px] bg-indigo-200 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 rounded">
                      {fmt.type === "currency" ? (fmt.prefix || "$") : fmt.type === "percent" ? "%" : "#"}
                    </span>
                  )}
                </button>
                {formatOpen === col && (
                  <FormatPopover
                    col={col}
                    format={fmt}
                    onUpdate={(f) => setFormat(col, f)}
                    onClose={() => setFormatOpen(null)}
                  />
                )}
              </div>
            );
          })}
          {colKeys.filter(isNumericCol).length === 0 && (
            <p className="text-xs text-gray-400">No numeric columns detected</p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const col = header.id;
                  const fmt = getFormat(col);
                  const isNum = isNumericCol(col);
                  return (
                    <th key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none",
                        isNum && fmt.type !== "raw" && "text-right",
                      )}>
                      <div className={cn("flex items-center gap-1", isNum && fmt.type !== "raw" && "justify-end")}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? <ArrowUp size={11} />
                          : header.column.getIsSorted() === "desc" ? <ArrowDown size={11} />
                          : <ArrowUpDown size={11} className="opacity-30" />}
                        {isNum && fmt.type !== "raw" && (
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-1 rounded ml-0.5">
                            {fmt.type === "currency" ? (fmt.prefix || "$") : fmt.type === "percent" ? "%" : "#,#"}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {row.getVisibleCells().map((cell) => {
                  const col = cell.column.id;
                  const fmt = getFormat(col);
                  const isNum = isNumericCol(col);
                  return (
                    <td key={cell.id}
                      className={cn(
                        "px-3 py-1.5 text-gray-700 dark:text-gray-300 text-xs max-w-[200px] overflow-hidden text-ellipsis",
                        isNum && fmt.type !== "raw" && "text-right font-mono",
                      )}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <div className="flex gap-1">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">‹</button>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
