import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { Widget } from "@/types";

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!isNaN(n) && String(value).trim() !== "") {
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 10_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  return String(value);
}

function isNumericColumn(data: Record<string, unknown>[], col: string): boolean {
  return data.slice(0, 5).every((row) => {
    const v = row[col];
    return v === null || v === undefined || v === "" || !isNaN(Number(v));
  });
}

export function TableWidget({ widget }: { widget: Widget }) {
  const data = (widget.data ?? []) as Record<string, unknown>[];
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;

  if (!data.length) return (
    <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--text-3)" }}>No data</div>
  );

  const cols = Object.keys(data[0]);
  const numericCols = new Set(cols.filter((c) => isNumericColumn(data, c)));

  const sorted = sortKey ? [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  }) : data;

  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const rows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="h-full flex flex-col text-[11px]">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0" style={{ background: "#f8f9ff", zIndex: 1 }}>
            <tr>
              {cols.map((col) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="cursor-pointer select-none whitespace-nowrap"
                  style={{
                    padding: "6px 10px",
                    textAlign: numericCols.has(col) ? "right" : "left",
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: sortKey === col ? "var(--indigo)" : "var(--text-3)",
                    borderBottom: "1px solid var(--border)",
                    transition: "color 0.15s",
                  }}
                >
                  <div className="flex items-center gap-1" style={{ justifyContent: numericCols.has(col) ? "flex-end" : "flex-start" }}>
                    {col.replace(/_/g, " ")}
                    <span style={{ color: sortKey === col ? "var(--indigo)" : "rgba(156,163,175,0.5)", flexShrink: 0 }}>
                      {sortKey === col
                        ? (sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
                        : <ChevronsUpDown size={9} />}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "transparent" : "rgba(99,102,241,0.025)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(99,102,241,0.055)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "transparent" : "rgba(99,102,241,0.025)"; }}
              >
                {cols.map((col) => {
                  const isNum = numericCols.has(col);
                  const raw = row[col];
                  const display = formatCell(raw);
                  return (
                    <td
                      key={col}
                      style={{
                        padding: "5px 10px",
                        textAlign: isNum ? "right" : "left",
                        color: isNum ? "var(--text-1)" : "var(--text-2)",
                        fontWeight: isNum ? 500 : 400,
                        fontVariantNumeric: isNum ? "tabular-nums" : "normal",
                        borderBottom: "1px solid var(--border)",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={String(raw ?? "")}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.length)} of {data.length.toLocaleString()} rows
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-2)",
                cursor: page === 0 ? "not-allowed" : "pointer",
                opacity: page === 0 ? 0.35 : 1,
                transition: "opacity 0.15s",
              }}
            >‹ Prev</button>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-2)",
                cursor: page >= pages - 1 ? "not-allowed" : "pointer",
                opacity: page >= pages - 1 ? 0.35 : 1,
                transition: "opacity 0.15s",
              }}
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
