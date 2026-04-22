import { useState, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Search, TableIcon, BarChart2, Hash,
  Type, Calendar, ToggleLeft, FolderOpen, Sparkles, Loader2,
  AlertTriangle, CheckCircle2, Link2, KeyRound, ShieldAlert, Columns2,
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

// ── QA badges ────────────────────────────────────────────────────────────────
function QABadges({ stats, col }: { stats: ColumnStats; col: ColumnInfo }) {
  const nullPct = stats.total > 0 ? (stats.nullCount / stats.total) * 100 : 0;
  const distinctPct = stats.total > 0 ? (stats.distinct / stats.total) * 100 : 0;
  const isNumeric = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL/i.test(col.type);
  const badges: { label: string; color: string; tip: string }[] = [];
  if (nullPct >= 50) badges.push({ label: `${Math.round(nullPct)}% null`, color: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400", tip: "More than half missing" });
  else if (nullPct >= 10) badges.push({ label: `${Math.round(nullPct)}% null`, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400", tip: `${Math.round(nullPct)}% null` });
  else if (stats.nullCount === 0) badges.push({ label: "no nulls", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400", tip: "No missing values" });
  if (distinctPct > 90 && !isNumeric && stats.total > 50)
    badges.push({ label: "high cardinality", color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400", tip: `${stats.distinct} distinct` });
  else if (stats.distinct === 1)
    badges.push({ label: "constant", color: "bg-gray-100 text-gray-500 dark:bg-gray-800", tip: "Only one unique value" });
  else if (isNumeric && stats.distinct <= 5 && stats.total > 20)
    badges.push({ label: "low distinct", color: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400", tip: `Only ${stats.distinct} distinct numeric values` });
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b) => (
        <span key={b.label} title={b.tip} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", b.color)}>{b.label}</span>
      ))}
    </div>
  );
}

// ── ColumnRow (schema tab) ───────────────────────────────────────────────────
function ColumnRow({ col, stats, fk, onRequestDescription }: {
  col: ColumnInfo; stats?: ColumnStats; fk?: ForeignKeyInfo;
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
      <button onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {expanded ? <ChevronDown size={10} className="shrink-0 text-gray-400" /> : <ChevronRight size={10} className="shrink-0 text-gray-400" />}
        <span className="shrink-0">{typeIcon(col.type)}</span>
        {isPK && <span title="Primary Key" className="shrink-0"><KeyRound size={11} className="text-amber-500" /></span>}
        {isFK && <span title={`FK → ${fk!.refTable}(${fk!.refColumn})`} className="shrink-0"><Link2 size={11} className="text-sky-500" /></span>}
        <span className={cn("text-xs flex-1 truncate font-medium",
          isPK ? "text-amber-700 dark:text-amber-400" : isFK ? "text-sky-700 dark:text-sky-400" : "text-gray-700 dark:text-gray-300")}>
          {col.name}
        </span>
        {isNotNull && !isPK && <span title="NOT NULL" className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400 font-mono">NN</span>}
        {hasDefault && <span title={`Default: ${col.dflt_value}`} className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-gray-100 text-gray-400 dark:bg-gray-800 font-mono">D</span>}
        <span className="text-[10px] text-gray-400 shrink-0 font-mono">{col.type || "TEXT"}</span>
        {stats && stats.nullCount > 0 && stats.total > 0 && (
          <span className={cn("text-[9px] px-1 py-0.5 rounded shrink-0 font-medium",
            nullPct >= 50 ? "bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400" : "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400")}>
            {Math.round(nullPct)}% ∅
          </span>
        )}
        {stats && stats.nullCount === 0 && <span title="No nulls" className="shrink-0"><CheckCircle2 size={10} className="text-green-400" /></span>}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-gray-50/60 dark:bg-gray-800/30 space-y-2">
          {isFK && (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 rounded-lg px-2.5 py-1.5">
              <Link2 size={11} /> References <strong>{fk!.refTable}</strong>({fk!.refColumn})
            </div>
          )}
          {stats?.description ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 italic leading-snug">{stats.description}</p>
          ) : (
            <button onClick={() => onRequestDescription(col.name)}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors">
              <Sparkles size={10} /> Generate AI description
            </button>
          )}
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
          {stats?.topValues && stats.topValues.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Top values</p>
              <div className="flex flex-wrap gap-1">
                {stats.topValues.map((v) => (
                  <span key={v} className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 font-mono max-w-[120px] truncate" title={v}>{v}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {isPK && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-1"><KeyRound size={9} /> Primary Key</span>}
            {isNotNull && !isPK && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">NOT NULL</span>}
            {hasDefault && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 dark:bg-gray-800">DEFAULT {col.dflt_value}</span>}
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
          <tr>{cols.map((c) => <th key={c} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {cols.map((c) => <td key={c} className="px-2 py-1 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">{String(row[c] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── QA summary bar ────────────────────────────────────────────────────────────
function QASummaryBar({ table, fkCount }: { table: TableSchema; fkCount: number }) {
  const stats = table.columnStats;
  if (!stats) return null;
  const pkCount = table.columns.filter((c) => c.pk > 0).length;
  const nullCols = stats.filter((s) => s.nullCount > 0).length;
  const score = healthScore(stats);
  const scoreColor = score >= 90 ? "text-green-600 dark:text-green-400" : score >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-gray-100 dark:border-gray-800 space-y-1.5">
      <div className="flex items-center gap-3 text-[11px] flex-wrap">
        <span className={cn("font-bold tabular-nums", scoreColor)}>{score}% quality</span>
        <span className="text-gray-500 dark:text-gray-400"><strong className="text-gray-700 dark:text-gray-200">{table.columns.length}</strong> cols</span>
        {pkCount > 0 && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><KeyRound size={10} /> {pkCount} PK</span>}
        {fkCount > 0 && <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium"><Link2 size={10} /> {fkCount} FK</span>}
        {nullCols > 0 ? <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><AlertTriangle size={10} /> {nullCols} with nulls</span>
          : <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 size={10} /> no nulls</span>}
      </div>
      <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Table item ────────────────────────────────────────────────────────────────
function TableItem({ table, onStatsLoaded, onDescriptionGenerated, onFKsLoaded }: {
  table: TableSchema;
  onStatsLoaded: (t: string, s: ColumnStats[]) => void;
  onDescriptionGenerated: (t: string, c: string, d: string) => void;
  onFKsLoaded: (t: string, fks: ForeignKeyInfo[]) => void;
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
        if (!table.columnStats) { const stats = await computeColumnStats(db, table.name, table.columns); onStatsLoaded(table.name, stats); }
        if (!table.foreignKeys) { const fks = loadForeignKeys(db, table.name); onFKsLoaded(table.name, fks); }
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
    try { const desc = await generateColumnDescription(table.name, col, stats, llmSettings); onDescriptionGenerated(table.name, colName, desc); }
    catch { /* ignore */ }
    finally { setDescLoading((p) => ({ ...p, [colName]: false })); }
  }, [table, llmSettings, onDescriptionGenerated]);

  const statsMap: Record<string, ColumnStats> = {};
  (table.columnStats ?? []).forEach((s) => { statsMap[s.columnName] = s; });
  const fkMap: Record<string, ForeignKeyInfo> = {};
  (table.foreignKeys ?? []).forEach((fk) => { fkMap[fk.column] = fk; });
  const pkCount = table.columns.filter((c) => c.pk > 0).length;
  const fkCount = (table.foreignKeys ?? []).length;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors">
        {open ? <ChevronDown size={13} className="shrink-0 text-gray-400" /> : <ChevronRight size={13} className="shrink-0 text-gray-400" />}
        <TableIcon size={13} className="shrink-0 text-blue-500" />
        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{table.name}</span>
        {statsLoading && <Loader2 size={12} className="animate-spin text-gray-400 shrink-0" />}
        {pkCount > 0 && !open && <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-amber-500"><KeyRound size={10} />{pkCount}</span>}
        {fkCount > 0 && !open && <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-sky-500"><Link2 size={10} />{fkCount}</span>}
        {table.rowCount !== undefined && <span className="text-xs text-gray-400 shrink-0">{table.rowCount.toLocaleString()} rows</span>}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900">
          <QASummaryBar table={table} fkCount={fkCount} />
          {fkCount > 0 && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-sky-50/40 dark:bg-sky-950/20">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 mb-1.5">Relationships</p>
              <div className="flex flex-col gap-1">
                {(table.foreignKeys ?? []).map((fk) => (
                  <div key={fk.column} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                    <Link2 size={10} className="text-sky-400 shrink-0" />
                    <span className="text-sky-700 dark:text-sky-300 font-medium">{fk.column}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-600 dark:text-gray-300">{fk.refTable}({fk.refColumn})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {table.columnStats && (() => {
            const issues = table.columnStats.filter((s) => s.total > 0 && (s.nullCount / s.total) >= 0.5).map((s) => `${s.columnName}: ${Math.round((s.nullCount / s.total) * 100)}% null`);
            if (!issues.length) return null;
            return (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-red-50/40 dark:bg-red-950/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1 flex items-center gap-1"><ShieldAlert size={10} /> Quality Issues</p>
                {issues.map((iss) => <p key={iss} className="text-[11px] text-red-600 dark:text-red-400">{iss}</p>)}
              </div>
            );
          })()}
          <div>
            {table.columns.map((col) => (
              <div key={col.name} className="relative">
                {descLoading[col.name] && <div className="absolute right-2 top-2 z-10"><Loader2 size={10} className="animate-spin text-indigo-400" /></div>}
                <ColumnRow col={col} stats={statsMap[col.name]} fk={fkMap[col.name]} onRequestDescription={handleRequestDescription} />
              </div>
            ))}
          </div>
          {table.preview && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setShowPreview((v) => !v)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                {showPreview ? "Hide preview" : "Show 5-row preview"}
              </button>
              {showPreview && <PreviewTable rows={table.preview} />}
            </div>
          )}
          <details className="px-3 pb-2 border-t border-gray-100 dark:border-gray-800">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 py-1">View CREATE SQL</summary>
            <pre className="mt-1 text-[10px] bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400">{table.sql}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ── Columns tab — flat view of all columns with descriptions ─────────────────

function ColumnsTab({
  schemas,
  onDescriptionGenerated,
}: {
  schemas: TableSchema[];
  onDescriptionGenerated: (tableName: string, colName: string, desc: string) => void;
}) {
  const { llmSettings } = useDataStore();
  const [search, setSearch] = useState("");
  const [descLoading, setDescLoading] = useState<Record<string, boolean>>({});

  // Flatten all columns from all tables
  const allColumns = schemas.flatMap((t) =>
    t.columns.map((col) => {
      const stats = (t.columnStats ?? []).find((s) => s.columnName === col.name);
      const fk = (t.foreignKeys ?? []).find((f) => f.column === col.name);
      return { table: t, col, stats, fk };
    }),
  );

  const filtered = search
    ? allColumns.filter(
        ({ table, col }) =>
          col.name.toLowerCase().includes(search.toLowerCase()) ||
          table.name.toLowerCase().includes(search.toLowerCase()) ||
          (col.type || "").toLowerCase().includes(search.toLowerCase()),
      )
    : allColumns;

  const handleGenerate = async (tableName: string, col: ColumnInfo, stats: ColumnStats | undefined) => {
    if (!stats) return;
    const key = `${tableName}.${col.name}`;
    setDescLoading((p) => ({ ...p, [key]: true }));
    try {
      const desc = await generateColumnDescription(tableName, col, stats, llmSettings);
      onDescriptionGenerated(tableName, col.name, desc);
    } catch { /* ignore */ }
    finally { setDescLoading((p) => ({ ...p, [key]: false })); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          {filtered.length} column{filtered.length !== 1 ? "s" : ""} across {schemas.length} table{schemas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Column list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {filtered.map(({ table, col, stats, fk }) => {
          const key = `${table.name}.${col.name}`;
          const loading = !!descLoading[key];
          const nullPct = stats && stats.total > 0 ? Math.round((stats.nullCount / stats.total) * 100) : null;
          const description = stats?.description;

          return (
            <div key={key} className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              {/* Header row */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="shrink-0">{typeIcon(col.type)}</span>
                {col.pk > 0 && <KeyRound size={10} className="text-amber-500 shrink-0" />}
                {fk && <Link2 size={10} className="text-sky-500 shrink-0" />}
                <span className={cn(
                  "text-xs font-semibold",
                  col.pk > 0 ? "text-amber-700 dark:text-amber-400" : fk ? "text-sky-700 dark:text-sky-400" : "text-gray-800 dark:text-gray-200",
                )}>
                  {col.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">{col.type || "TEXT"}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">in</span>
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{table.name}</span>

                {/* Badges */}
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {col.pk > 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">PK</span>}
                  {fk && <span className="text-[9px] px-1 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 font-medium">FK</span>}
                  {col.notnull === 1 && !col.pk && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400 font-mono">NN</span>}
                  {nullPct !== null && nullPct > 0 && (
                    <span className={cn("text-[9px] px-1 py-0.5 rounded font-medium",
                      nullPct >= 50 ? "bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400" : "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400")}>
                      {nullPct}% ∅
                    </span>
                  )}
                  {nullPct === 0 && <CheckCircle2 size={10} className="text-green-400" />}
                </div>
              </div>

              {/* FK reference */}
              {fk && (
                <p className="text-[10px] text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1">
                  <Link2 size={9} /> References {fk.refTable}({fk.refColumn})
                </p>
              )}

              {/* Description */}
              {description ? (
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">{description}</p>
              ) : stats ? (
                <div className="flex items-start gap-2">
                  <p className="text-[11px] text-gray-400 italic flex-1">
                    {/* Auto-built description from stats */}
                    {col.pk > 0 ? "Primary key" : fk ? `Foreign key referencing ${fk.refTable}` : ""}
                    {stats.total > 0 && ` · ${stats.distinct.toLocaleString()} distinct value${stats.distinct !== 1 ? "s" : ""}`}
                    {stats.min != null && stats.max != null && `, range ${fmt(stats.min)}–${fmt(stats.max)}`}
                    {nullPct !== null && nullPct > 0 && `, ${nullPct}% missing`}
                    {stats.topValues?.length ? ` · e.g. ${stats.topValues.slice(0, 3).join(", ")}` : ""}
                  </p>
                  <button onClick={() => handleGenerate(table.name, col, stats)}
                    disabled={loading}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-40">
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    AI describe
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">Expand the table above to load stats &amp; descriptions</p>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No columns match "{search}"</p>}
      </div>
    </div>
  );
}

// ── SchemaExplorer ────────────────────────────────────────────────────────────

type SchemaTab = "schema" | "columns";

interface SchemaExplorerProps {
  onColumnClick?: (col: ColumnInfo, tableName: string) => void;
}

export function SchemaExplorer({ onColumnClick: _onColumnClick }: SchemaExplorerProps) {
  const { schemas, context, setContext, setSchemas, clearMessages, setSuggestedQuestions } = useDataStore();
  const [search, setSearch] = useState("");
  const [schemaTab, setSchemaTab] = useState<SchemaTab>("schema");

  const handleStatsLoaded = useCallback((tableName: string, stats: ColumnStats[]) => {
    setSchemas(schemas.map((t) => t.name === tableName ? { ...t, columnStats: stats } : t));
  }, [schemas, setSchemas]);

  const handleFKsLoaded = useCallback((tableName: string, fks: ForeignKeyInfo[]) => {
    setSchemas(schemas.map((t) => t.name === tableName ? { ...t, foreignKeys: fks } : t));
  }, [schemas, setSchemas]);

  const handleDescriptionGenerated = useCallback((tableName: string, colName: string, desc: string) => {
    setSchemas(schemas.map((t) => {
      if (t.name !== tableName) return t;
      return { ...t, columnStats: (t.columnStats ?? []).map((s) => s.columnName === colName ? { ...s, description: desc } : s) };
    }));
  }, [schemas, setSchemas]);

  const filtered = search
    ? schemas.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase())))
    : schemas;

  async function handleLoadNewData() {
    const db = await getDB();
    db.dropAllTables();
    setSchemas([]); clearMessages(); setSuggestedQuestions([]);
  }

  if (!schemas.length) return null;

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
          <button onClick={handleLoadNewData} title="Clear and load new data"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-colors">
            <FolderOpen size={11} /> Load new
          </button>
        </div>

        {/* Dataset KPIs */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] text-gray-500"><strong className="text-gray-700 dark:text-gray-200">{schemas.length}</strong> table{schemas.length !== 1 ? "s" : ""}</span>
          {totalPKs > 0 && <span className="flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400"><KeyRound size={10} /> {totalPKs} PK{totalPKs > 1 ? "s" : ""}</span>}
          {totalFKs > 0 && <span className="flex items-center gap-0.5 text-[11px] text-sky-600 dark:text-sky-400"><Link2 size={10} /> {totalFKs} FK{totalFKs > 1 ? "s" : ""}</span>}
          {overallScore !== null && (
            <span className={cn("text-[11px] font-medium",
              overallScore >= 90 ? "text-green-600 dark:text-green-400" : overallScore >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400")}>
              {overallScore}% quality
            </span>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-2">
          <button onClick={() => setSchemaTab("schema")}
            className={cn("flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              schemaTab === "schema" ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700")}>
            <TableIcon size={11} /> Schema
          </button>
          <button onClick={() => setSchemaTab("columns")}
            className={cn("flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              schemaTab === "columns" ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700")}>
            <Columns2 size={11} /> Columns
          </button>
        </div>

        {/* Search (schema tab only) */}
        {schemaTab === "schema" && (
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables & columns…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* Schema tab */}
      {schemaTab === "schema" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((table) => (
            <TableItem key={table.name} table={table}
              onStatsLoaded={handleStatsLoaded}
              onDescriptionGenerated={handleDescriptionGenerated}
              onFKsLoaded={handleFKsLoaded} />
          ))}
          {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No matches</p>}
        </div>
      )}

      {/* Columns tab */}
      {schemaTab === "columns" && (
        <ColumnsTab schemas={schemas} onDescriptionGenerated={handleDescriptionGenerated} />
      )}

      {/* Context textarea */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 block">Dataset context</span>
          <textarea value={context} onChange={(e) => setContext(e.target.value)}
            placeholder="Add notes about this dataset to improve query accuracy…"
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </label>
      </div>
    </div>
  );
}
