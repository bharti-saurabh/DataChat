import { useState, useRef, useCallback } from "react";
// react-grid-layout v3 dropped WidthProvider. Use GridLayout + useContainerWidth hook.
// The @types package is for v1; bypass stale types with a cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import GridLayoutUntyped, { useContainerWidth } from "react-grid-layout";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = GridLayoutUntyped as unknown as React.ComponentClass<any>;
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  X, FileDown, LayoutDashboard, Trash2, Plus, Type, Heading, Minus,
  BarChart2, Table2, Lightbulb, Edit3, Check, GripVertical,
  ChevronLeft, ChevronRight, Presentation, FileText,
  Sparkles, Loader2, RefreshCw,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { RechartsDisplay } from "@/components/output/RechartsDisplay";
import { ResultsTable } from "@/components/results/ResultsTable";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { suggestSlideCommentary, rewriteCommentary } from "@/lib/schemaAI";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DashboardBlock, BlockType } from "@/types";

interface GridItemLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// ── Block content renderers ───────────────────────────────────────────────────

function HeadingBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (patch: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "Untitled");

  const save = () => { onUpdate({ content: draft }); setEditing(false); };
  const level = block.level ?? 1;
  const cls = level === 1 ? "text-2xl font-bold" : level === 2 ? "text-lg font-semibold" : "text-base font-medium";

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className={cn("flex-1 bg-transparent outline-none border-b-2 border-indigo-400", cls)}
        />
        <button onClick={save} className="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-950"><Check size={14} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 cursor-text" onClick={() => setEditing(true)}>
      <span className={cn(cls, "text-gray-900 dark:text-gray-100 flex-1")}>{block.content || "Click to edit…"}</span>
      <Edit3 size={12} className="opacity-30 text-gray-400 shrink-0" />
    </div>
  );
}

function TextBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (patch: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "");

  const save = () => { onUpdate({ content: draft }); setEditing(false); };

  if (editing) {
    return (
      <div className="flex flex-col h-full gap-1.5">
        <textarea
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") save(); }}
          className="flex-1 w-full text-sm bg-transparent outline-none border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 resize-none text-gray-700 dark:text-gray-300 min-h-[80px]"
        />
        <button onClick={save} className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white self-end">Save</button>
      </div>
    );
  }

  return (
    <div className="cursor-text flex items-start gap-2 h-full" onClick={() => setEditing(true)}>
      <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-relaxed whitespace-pre-wrap">
        {block.content || <span className="text-gray-400 italic">Click to add text…</span>}
      </p>
      <Edit3 size={12} className="opacity-30 text-gray-400 shrink-0 mt-0.5" />
    </div>
  );
}

function ChartBlock({ block }: { block: DashboardBlock }) {
  if (!block.chartConfig || !block.data) return <div className="text-sm text-gray-400 p-2">No chart data</div>;
  return (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0">
        <RechartsDisplay config={block.chartConfig} data={block.data} />
      </div>
    </div>
  );
}

function TableBlock({ block }: { block: DashboardBlock }) {
  if (!block.data?.length) return <div className="text-sm text-gray-400 p-2">No table data</div>;
  return (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0 overflow-auto">
        <ResultsTable data={block.data} />
      </div>
    </div>
  );
}

function InsightsBlock({ block }: { block: DashboardBlock }) {
  return (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0 overflow-auto">
        <InsightsCard insights={block.insights ?? block.content} />
      </div>
    </div>
  );
}

function BlockContent({ block, onUpdate }: { block: DashboardBlock; onUpdate: (patch: Partial<DashboardBlock>) => void }) {
  if (block.type === "divider")   return <hr className="border-gray-200 dark:border-gray-700 my-auto" />;
  if (block.type === "heading")   return <HeadingBlock block={block} onUpdate={onUpdate} />;
  if (block.type === "text")      return <TextBlock block={block} onUpdate={onUpdate} />;
  if (block.type === "chart")     return <ChartBlock block={block} />;
  if (block.type === "table")     return <TableBlock block={block} />;
  if (block.type === "insights")  return <InsightsBlock block={block} />;
  return null;
}

// ── Grid block shell ──────────────────────────────────────────────────────────

function GridBlockShell({ block, onRemove, onUpdate }: {
  block: DashboardBlock;
  onRemove: () => void;
  onUpdate: (patch: Partial<DashboardBlock>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDivider = block.type === "divider";

  return (
    <div
      className={cn(
        "h-full flex flex-col relative",
        !isDivider && "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <div
            className="drag-handle p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab text-gray-400 hover:text-indigo-500 transition-colors"
            title="Drag to reposition"
          >
            <GripVertical size={12} />
          </div>
          <button
            onClick={onRemove}
            className="p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {isDivider ? (
        <hr className="border-gray-200 dark:border-gray-700 my-auto mx-4" />
      ) : (
        <div className="flex-1 min-h-0 p-4 overflow-hidden">
          <BlockContent block={block} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ── Add block menu ────────────────────────────────────────────────────────────

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ReactNode; sub?: string }[] = [
  { type: "heading",  label: "Heading",  icon: <Heading size={14} />,  sub: "H1 / H2 / H3"  },
  { type: "text",     label: "Text",     icon: <Type size={14} />,     sub: "Paragraph"      },
  { type: "divider",  label: "Divider",  icon: <Minus size={14} />,    sub: "Separator line" },
];

function AddBlockMenu({ onAdd }: { onAdd: (type: BlockType, level?: 1 | 2 | 3) => void }) {
  const [open, setOpen] = useState(false);
  const [headingLevel, setHeadingLevel] = useState<1 | 2 | 3>(1);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400 text-sm transition-all"
      >
        <Plus size={15} /> Add text block
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-2 z-20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 pb-1.5">Content blocks</p>
          {BLOCK_OPTIONS.map((opt) => (
            <div key={opt.type}>
              <button
                onClick={() => { onAdd(opt.type, opt.type === "heading" ? headingLevel : undefined); setOpen(false); }}
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

// ── Editable presentation slide ───────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: "concise",   label: "Concise"   },
  { value: "formal",    label: "Formal"    },
  { value: "executive", label: "Executive" },
] as const;

function EditableSlide({
  block,
  onUpdate,
}: {
  block: DashboardBlock;
  onUpdate: (patch: Partial<DashboardBlock>) => void;
}) {
  const { llmSettings } = useDataStore();

  // Slide heading (editable inline)
  const heading = block.slideAnnotations?.heading ?? block.title ?? "";
  const commentary = block.slideAnnotations?.commentary ?? "";

  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(heading);
  const [commentaryDraft, setCommentaryDraft] = useState(commentary);
  const [aiLoading, setAiLoading] = useState(false);
  const [showTones, setShowTones] = useState(false);

  // Chart area resize: chartPct = % of slide card height for the chart
  const [chartPct, setChartPct] = useState(55);
  const slideRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !slideRef.current) return;
      const rect = slideRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setChartPct(Math.min(Math.max(pct, 20), 78));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const saveHeading = () => {
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, heading: headingDraft } });
    setEditingHeading(false);
  };

  const saveCommentary = (val: string) => {
    setCommentaryDraft(val);
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, commentary: val } });
  };

  const handleAISuggest = async () => {
    if (!block.data?.length) return;
    setAiLoading(true);
    try {
      const text = await suggestSlideCommentary(heading, block.data, block.insights, llmSettings);
      setCommentaryDraft(text);
      onUpdate({ slideAnnotations: { ...block.slideAnnotations, commentary: text } });
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  };

  const handleRewrite = async (tone: "formal" | "concise" | "executive") => {
    if (!commentaryDraft.trim()) return;
    setShowTones(false);
    setAiLoading(true);
    try {
      const text = await rewriteCommentary(commentaryDraft, tone, llmSettings);
      setCommentaryDraft(text);
      onUpdate({ slideAnnotations: { ...block.slideAnnotations, commentary: text } });
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  };

  const hasVisual = block.type === "chart" || block.type === "table" || block.type === "insights";

  return (
    <div
      ref={slideRef}
      className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      style={{ height: "76vh" }}
    >
      {/* ── Slide heading ── */}
      <div className="shrink-0 px-10 pt-8 pb-3">
        {editingHeading ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={headingDraft}
              onChange={(e) => setHeadingDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveHeading(); if (e.key === "Escape") setEditingHeading(false); }}
              className="flex-1 text-2xl font-bold bg-transparent outline-none border-b-2 border-indigo-400 text-gray-900 dark:text-gray-100"
            />
            <button onClick={saveHeading} className="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-950">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group cursor-text" onClick={() => { setHeadingDraft(heading); setEditingHeading(true); }}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex-1">
              {heading || <span className="text-gray-400 font-normal italic">Click to add slide title…</span>}
            </h2>
            <Edit3 size={14} className="opacity-0 group-hover:opacity-40 text-gray-400 shrink-0" />
          </div>
        )}
      </div>

      {/* ── Main content (chart/table/insights) with drag-resize ── */}
      {hasVisual && (
        <>
          <div className="px-10 overflow-hidden shrink-0" style={{ height: `${chartPct}%` }}>
            <div style={{ width: "100%", height: "100%" }}>
              {block.type === "chart" && block.chartConfig && block.data && (
                <RechartsDisplay config={block.chartConfig} data={block.data} />
              )}
              {block.type === "table" && block.data?.length && (
                <div className="h-full overflow-auto">
                  <ResultsTable data={block.data} />
                </div>
              )}
              {block.type === "insights" && (
                <div className="h-full overflow-auto">
                  <InsightsCard insights={block.insights ?? block.content} />
                </div>
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="shrink-0 h-2 mx-10 my-1 cursor-row-resize flex items-center justify-center group"
          >
            <div className="w-16 h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-400 transition-colors" />
          </div>
        </>
      )}

      {/* ── Commentary area (fills remaining space) ── */}
      <div className="flex-1 min-h-0 flex flex-col px-10 pb-8 gap-2" style={{ minHeight: hasVisual ? undefined : "60%" }}>
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Commentary</span>
          <div className="flex-1" />
          {aiLoading ? (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <Loader2 size={12} className="animate-spin" /> Generating…
            </span>
          ) : (
            <>
              <button
                onClick={handleAISuggest}
                disabled={!block.data?.length}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={11} /> AI Suggest
              </button>
              {commentaryDraft && (
                <div className="relative">
                  <button
                    onClick={() => setShowTones((v) => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    <RefreshCw size={11} /> Rewrite
                  </button>
                  {showTones && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-20">
                      {TONE_OPTIONS.map((t) => (
                        <button key={t.value} onClick={() => handleRewrite(t.value)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-300 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Full-height textarea */}
        <textarea
          value={commentaryDraft}
          onChange={(e) => saveCommentary(e.target.value)}
          placeholder="Add commentary, key takeaways, or context for this slide… (or click AI Suggest)"
          className="flex-1 w-full resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 leading-relaxed"
        />
      </div>
    </div>
  );
}

// ── Presentation slide view ───────────────────────────────────────────────────

function PresentationView({
  blocks,
  onUpdate,
}: {
  blocks: DashboardBlock[];
  onUpdate: (id: string, patch: Partial<DashboardBlock>) => void;
}) {
  const [slide, setSlide] = useState(0);
  const displayBlocks = blocks.filter((b) => b.type !== "divider");

  if (displayBlocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No content to present. Pin charts, tables, or insights first.
      </div>
    );
  }

  const total = displayBlocks.length;
  const safeSlide = Math.min(slide, total - 1);
  const current = displayBlocks[safeSlide];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-950 to-indigo-950">
      {/* Slide counter */}
      <div className="shrink-0 text-center py-3 text-xs text-gray-500 font-medium tracking-widest uppercase">
        {safeSlide + 1} / {total}
      </div>

      {/* Slide card */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-8 py-2">
        <EditableSlide
          block={current}
          onUpdate={(patch) => onUpdate(current.id, patch)}
        />
      </div>

      {/* Navigation */}
      <div className="shrink-0 flex items-center justify-center gap-6 py-4">
        <button
          onClick={() => setSlide((s) => Math.max(0, s - 1))}
          disabled={safeSlide === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm font-medium transition-colors"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex gap-1.5">
          {displayBlocks.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={cn("rounded-full transition-all", i === safeSlide ? "w-5 h-2 bg-indigo-400" : "w-2 h-2 bg-white/30 hover:bg-white/50")}
            />
          ))}
        </div>

        <button
          onClick={() => setSlide((s) => Math.min(total - 1, s + 1))}
          disabled={safeSlide === total - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm font-medium transition-colors"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type DashboardMode = "document" | "presentation";

export function Dashboard() {
  const {
    dashboardOpen, toggleDashboard,
    dashboardBlocks, addDashboardBlock, removeDashboardBlock,
    updateDashboardBlock,
    addToast,
  } = useDataStore();

  const [mode, setMode] = useState<DashboardMode>("document");
  // useContainerWidth measures the grid container and returns [ref, width]
  const { containerRef: gridContainerRef, width: gridWidth } = useContainerWidth({ initialWidth: 1200 });

  if (!dashboardOpen) return null;

  const handleAdd = (type: BlockType, level?: 1 | 2 | 3) => {
    addDashboardBlock({
      id: generateId(),
      type,
      content: type === "heading" ? "New heading" : type === "text" ? "" : undefined,
      level: type === "heading" ? (level ?? 1) : undefined,
      layout: { x: 0, y: 9999, w: 12, h: type === "divider" ? 1 : type === "heading" ? 2 : 3 },
    });
  };

  const handleLayoutChange = (newLayout: GridItemLayout[]) => {
    newLayout.forEach((item) => {
      updateDashboardBlock(item.i, { layout: { x: item.x, y: item.y, w: item.w, h: item.h } });
    });
  };

  const handleExportPDF = async () => {
    addToast({ variant: "info", title: "Generating PDF…" });
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("dashboard-grid-content");
      if (!el) throw new Error("Dashboard element not found");

      // foreignObjectRendering lets html2canvas rasterize SVG gradients/filters used by Recharts
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW - 16;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight() - 16;
      let y = 8; let remaining = imgH;
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

  const gridLayout: GridItemLayout[] = dashboardBlocks.map((b) => ({
    i: b.id,
    x: b.layout?.x ?? 0,
    y: b.layout?.y ?? 0,
    w: b.layout?.w ?? 6,
    h: b.layout?.h ?? 6,
    minW: 2,
    minH: 2,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <LayoutDashboard size={17} className="text-indigo-600 shrink-0" />
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">Dashboard</h1>

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode("document")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              mode === "document"
                ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            )}
          >
            <FileText size={12} /> Document
          </button>
          <button
            onClick={() => setMode("presentation")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              mode === "presentation"
                ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            )}
          >
            <Presentation size={12} /> Presentation
          </button>
        </div>

        <span className="text-xs text-gray-400">{dashboardBlocks.length} block{dashboardBlocks.length !== 1 ? "s" : ""}</span>

        {dashboardBlocks.length > 0 && mode === "document" && (
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <FileDown size={13} /> Export PDF
          </button>
        )}

        <button
          onClick={toggleDashboard}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Document mode ── */}
      {mode === "document" && (
        <div className="flex-1 overflow-y-auto">
          {dashboardBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                <LayoutDashboard size={28} className="text-indigo-300" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Your dashboard is empty</p>
                <p className="text-sm mt-1 text-gray-400">
                  Pin charts, tables and insights from the output panel,<br />or add text blocks below
                </p>
              </div>
              <div className="flex gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><BarChart2 size={11} /> Charts</span>
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><Table2 size={11} /> Tables</span>
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-700"><Lightbulb size={11} /> Insights</span>
              </div>
              <AddBlockMenu onAdd={handleAdd} />
            </div>
          ) : (
            <div id="dashboard-grid-content" className="px-4 py-4" ref={gridContainerRef as React.RefObject<HTMLDivElement>}>
              <GridLayout
                layout={gridLayout}
                cols={12}
                rowHeight={50}
                width={gridWidth}
                isDraggable
                isResizable
                draggableHandle=".drag-handle"
                onLayoutChange={handleLayoutChange}
                margin={[12, 12]}
                containerPadding={[0, 0]}
              >
                {dashboardBlocks.map((block) => (
                  <div key={block.id}>
                    <GridBlockShell
                      block={block}
                      onRemove={() => removeDashboardBlock(block.id)}
                      onUpdate={(patch) => updateDashboardBlock(block.id, patch)}
                    />
                  </div>
                ))}
              </GridLayout>

              <div className="mt-4 px-1">
                <AddBlockMenu onAdd={handleAdd} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Presentation mode ── */}
      {mode === "presentation" && (
        <PresentationView
          blocks={dashboardBlocks}
          onUpdate={(id, patch) => updateDashboardBlock(id, patch)}
        />
      )}
    </div>
  );
}
