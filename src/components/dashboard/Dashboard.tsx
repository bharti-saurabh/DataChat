import { useState, useRef } from "react";
import {
  X, FileDown, LayoutDashboard, Trash2, ChevronUp, ChevronDown,
  Plus, Type, Heading, Minus, BarChart2, Table2, Lightbulb, Edit3, Check,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { RechartsDisplay } from "@/components/output/RechartsDisplay";
import { ResultsTable } from "@/components/results/ResultsTable";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DashboardBlock, BlockType } from "@/types";

// ── Block renderers ───────────────────────────────────────────────────────────

function HeadingBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (patch: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "Untitled");
  const ref = useRef<HTMLInputElement>(null);

  const save = () => { onUpdate({ content: draft }); setEditing(false); };
  const level = block.level ?? 1;
  const cls = level === 1 ? "text-2xl font-bold" : level === 2 ? "text-lg font-semibold" : "text-base font-medium";

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className={cn("flex-1 bg-transparent outline-none border-b-2 border-indigo-400", cls)}
        />
        <button onClick={save} className="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-950"><Check size={14} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group/text cursor-text" onClick={() => setEditing(true)}>
      <span className={cn(cls, "text-gray-900 dark:text-gray-100 flex-1")}>{block.content || "Click to edit…"}</span>
      <Edit3 size={12} className="opacity-0 group-hover/text:opacity-40 text-gray-400 shrink-0" />
    </div>
  );
}

function TextBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (patch: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "");

  const save = () => { onUpdate({ content: draft }); setEditing(false); };

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") save(); }}
          rows={3}
          className="w-full text-sm bg-transparent outline-none border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 resize-none text-gray-700 dark:text-gray-300"
        />
        <button onClick={save} className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white">Save</button>
      </div>
    );
  }

  return (
    <div className="cursor-text group/text flex items-start gap-2" onClick={() => setEditing(true)}>
      <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-relaxed whitespace-pre-wrap">
        {block.content || <span className="text-gray-400 italic">Click to add text…</span>}
      </p>
      <Edit3 size={12} className="opacity-0 group-hover/text:opacity-40 text-gray-400 shrink-0 mt-0.5" />
    </div>
  );
}

function ChartBlock({ block }: { block: DashboardBlock }) {
  if (!block.chartConfig || !block.data) return <div className="text-sm text-gray-400">No chart data</div>;
  return (
    <div className="space-y-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{block.title}</p>}
      <div className="h-64">
        <RechartsDisplay config={block.chartConfig} data={block.data} />
      </div>
    </div>
  );
}

function TableBlock({ block }: { block: DashboardBlock }) {
  if (!block.data?.length) return <div className="text-sm text-gray-400">No table data</div>;
  return (
    <div className="space-y-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{block.title}</p>}
      <ResultsTable data={block.data} />
    </div>
  );
}

function InsightsBlock({ block }: { block: DashboardBlock }) {
  return (
    <div className="space-y-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{block.title}</p>}
      <InsightsCard insights={block.insights ?? block.content} />
    </div>
  );
}

// ── Block shell with controls ─────────────────────────────────────────────────

function BlockShell({ block, index, total, onMove, onRemove, onUpdate }: {
  block: DashboardBlock;
  index: number;
  total: number;
  onMove: (dir: "up" | "down") => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<DashboardBlock>) => void;
}) {
  const isDivider = block.type === "divider";

  return (
    <div className={cn("notion-block pl-10", !isDivider && "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow")}>
      {/* Side controls */}
      <div className="notion-block-controls">
        <button onClick={() => onMove("up")} disabled={index === 0}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors">
          <ChevronUp size={12} />
        </button>
        <button onClick={() => onMove("down")} disabled={index === total - 1}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors">
          <ChevronDown size={12} />
        </button>
        <button onClick={onRemove}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>

      {/* Content */}
      {block.type === "divider"   && <hr className="border-gray-200 dark:border-gray-700 my-1" />}
      {block.type === "heading"   && <HeadingBlock block={block} onUpdate={onUpdate} />}
      {block.type === "text"      && <TextBlock block={block} onUpdate={onUpdate} />}
      {block.type === "chart"     && <ChartBlock block={block} />}
      {block.type === "table"     && <TableBlock block={block} />}
      {block.type === "insights"  && <InsightsBlock block={block} />}
    </div>
  );
}

// ── Add block menu ────────────────────────────────────────────────────────────

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ReactNode; sub?: string }[] = [
  { type: "heading",  label: "Heading",  icon: <Heading size={14} />,    sub: "H1 / H2 / H3" },
  { type: "text",     label: "Text",     icon: <Type size={14} />,       sub: "Paragraph"     },
  { type: "divider",  label: "Divider",  icon: <Minus size={14} />,      sub: "Separator line" },
];

function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType, level?: 1 | 2 | 3) => void }) {
  const [open, setOpen] = useState(false);
  const [headingLevel, setHeadingLevel] = useState<1 | 2 | 3>(1);

  return (
    <div className="relative pl-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400 text-sm transition-all w-full"
      >
        <Plus size={15} />
        Add block
      </button>

      {open && (
        <div className="absolute left-10 bottom-full mb-2 w-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-2 z-10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 pb-1.5">Content blocks</p>
          {BLOCK_OPTIONS.map((opt) => (
            <div key={opt.type}>
              <button
                onClick={() => {
                  onAdd(opt.type, opt.type === "heading" ? headingLevel : undefined);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</p>
                  {opt.sub && <p className="text-[10px] text-gray-400">{opt.sub}</p>}
                </div>
              </button>
              {opt.type === "heading" && (
                <div className="flex gap-1 px-2 pb-1">
                  {([1, 2, 3] as const).map((l) => (
                    <button key={l} onClick={() => setHeadingLevel(l)}
                      className={cn("w-7 h-6 rounded text-xs font-bold transition-colors",
                        headingLevel === l ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      )}>H{l}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const {
    dashboardOpen, toggleDashboard,
    dashboardBlocks, addDashboardBlock, removeDashboardBlock,
    updateDashboardBlock, moveDashboardBlock,
    addToast,
  } = useDataStore();

  if (!dashboardOpen) return null;

  const handleAdd = (type: BlockType, level?: 1 | 2 | 3) => {
    addDashboardBlock({
      id: generateId(),
      type,
      content: type === "heading" ? "New heading" : type === "text" ? "" : undefined,
      level: type === "heading" ? (level ?? 1) : undefined,
    });
  };

  const handleExportPDF = async () => {
    addToast({ variant: "info", title: "Generating PDF…" });
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("notion-dashboard-content");
      if (!el) throw new Error("Dashboard element not found");

      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW - 16;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight() - 16;
      let y = 8;
      let remaining = imgH;

      pdf.addImage(imgData, "PNG", 8, y, imgW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        pdf.addPage();
        y = -(imgH - remaining);
        pdf.addImage(imgData, "PNG", 8, y, imgW, imgH);
        remaining -= pageH;
      }
      pdf.save("datachat-dashboard.pdf");
      addToast({ variant: "success", title: "PDF exported" });
    } catch (e) {
      addToast({ variant: "error", title: "Export failed", message: String(e) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <LayoutDashboard size={18} className="text-indigo-600" />
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">Dashboard</h1>
        <span className="text-xs text-gray-400">{dashboardBlocks.length} block{dashboardBlocks.length !== 1 ? "s" : ""}</span>
        {dashboardBlocks.length > 0 && (
          <button onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <FileDown size={13} /> Export PDF
          </button>
        )}
        <button onClick={toggleDashboard}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div id="notion-dashboard-content" className="max-w-3xl mx-auto px-10 py-8 space-y-3">
          {dashboardBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                <LayoutDashboard size={28} className="text-indigo-300" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Your dashboard is empty</p>
                <p className="text-sm mt-1 text-gray-400">
                  Pin charts, tables and insights from the output panel,
                  <br />or add text blocks below
                </p>
              </div>
              <div className="flex gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><BarChart2 size={11}/> Charts</span>
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><Table2 size={11}/> Tables</span>
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><Lightbulb size={11}/> Insights</span>
              </div>
            </div>
          ) : (
            dashboardBlocks.map((block, i) => (
              <BlockShell
                key={block.id}
                block={block}
                index={i}
                total={dashboardBlocks.length}
                onMove={(dir) => moveDashboardBlock(block.id, dir)}
                onRemove={() => removeDashboardBlock(block.id)}
                onUpdate={(patch) => updateDashboardBlock(block.id, patch)}
              />
            ))
          )}

          {/* Add block */}
          <AddBlockMenu onAdd={handleAdd} />
        </div>
      </div>
    </div>
  );
}
