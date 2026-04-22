import { useState, useRef, useCallback } from "react";
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
  Sparkles, Loader2, AlignLeft, AlignJustify, Hash, Quote,
} from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { RechartsDisplay } from "@/components/output/RechartsDisplay";
import { ResultsTable } from "@/components/results/ResultsTable";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { suggestSlideCommentary, suggestSlideHeading } from "@/lib/schemaAI";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DashboardBlock, BlockType, SlideTextBlock } from "@/types";

interface GridItemLayout {
  i: string; x: number; y: number; w: number; h: number;
  minW?: number; minH?: number;
}

// ── Block content renderers ───────────────────────────────────────────────────

function HeadingBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (p: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "Untitled");
  const save = () => { onUpdate({ content: draft }); setEditing(false); };
  const cls = (block.level ?? 1) === 1 ? "text-2xl font-bold" : (block.level ?? 1) === 2 ? "text-lg font-semibold" : "text-base font-medium";
  if (editing) return (
    <div className="flex items-center gap-2">
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className={cn("flex-1 bg-transparent outline-none border-b-2 border-indigo-400", cls)} />
      <button onClick={save} className="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-950"><Check size={14} /></button>
    </div>
  );
  return (
    <div className="flex items-center gap-2 cursor-text" onClick={() => setEditing(true)}>
      <span className={cn(cls, "text-gray-900 dark:text-gray-100 flex-1")}>{block.content || "Click to edit…"}</span>
      <Edit3 size={12} className="opacity-30 text-gray-400 shrink-0" />
    </div>
  );
}

function TextBlock({ block, onUpdate }: { block: DashboardBlock; onUpdate: (p: Partial<DashboardBlock>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.content ?? "");
  const save = () => { onUpdate({ content: draft }); setEditing(false); };
  if (editing) return (
    <div className="flex flex-col h-full gap-1.5">
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") save(); }}
        className="flex-1 w-full text-sm bg-transparent outline-none border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 resize-none text-gray-700 dark:text-gray-300 min-h-[80px]" />
      <button onClick={save} className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white self-end">Save</button>
    </div>
  );
  return (
    <div className="cursor-text flex items-start gap-2 h-full" onClick={() => setEditing(true)}>
      <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-relaxed whitespace-pre-wrap">
        {block.content || <span className="text-gray-400 italic">Click to add text…</span>}
      </p>
      <Edit3 size={12} className="opacity-30 text-gray-400 shrink-0 mt-0.5" />
    </div>
  );
}

function BlockContent({ block, onUpdate }: { block: DashboardBlock; onUpdate: (p: Partial<DashboardBlock>) => void }) {
  if (block.type === "divider")  return <hr className="border-gray-200 dark:border-gray-700 my-auto" />;
  if (block.type === "heading")  return <HeadingBlock block={block} onUpdate={onUpdate} />;
  if (block.type === "text")     return <TextBlock block={block} onUpdate={onUpdate} />;
  if (block.type === "chart")    return block.chartConfig && block.data ? (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0"><RechartsDisplay config={block.chartConfig} data={block.data} /></div>
    </div>
  ) : <div className="text-sm text-gray-400 p-2">No chart data</div>;
  if (block.type === "table")    return block.data?.length ? (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0 overflow-auto"><ResultsTable data={block.data} /></div>
    </div>
  ) : <div className="text-sm text-gray-400 p-2">No table data</div>;
  if (block.type === "insights") return (
    <div className="h-full flex flex-col gap-2">
      {block.title && <p className="text-xs font-medium text-gray-500 shrink-0">{block.title}</p>}
      <div className="flex-1 min-h-0 overflow-auto"><InsightsCard insights={block.insights ?? block.content} /></div>
    </div>
  );
  return null;
}

function GridBlockShell({ block, onRemove, onUpdate }: {
  block: DashboardBlock; onRemove: () => void; onUpdate: (p: Partial<DashboardBlock>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDivider = block.type === "divider";
  return (
    <div className={cn("h-full flex flex-col relative", !isDivider && "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm")}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <div className="drag-handle p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab text-gray-400 hover:text-indigo-500 transition-colors" title="Drag">
            <GripVertical size={12} />
          </div>
          <button onClick={onRemove} className="p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      )}
      {isDivider
        ? <hr className="border-gray-200 dark:border-gray-700 my-auto mx-4" />
        : <div className="flex-1 min-h-0 p-4 overflow-hidden"><BlockContent block={block} onUpdate={onUpdate} /></div>}
    </div>
  );
}

// ── Add block menu ────────────────────────────────────────────────────────────

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ReactNode; sub?: string }[] = [
  { type: "heading", label: "Heading", icon: <Heading size={14} />, sub: "H1 / H2 / H3" },
  { type: "text",    label: "Text",    icon: <Type size={14} />,    sub: "Paragraph"     },
  { type: "divider", label: "Divider", icon: <Minus size={14} />,   sub: "Separator line"},
];

function AddBlockMenu({ onAdd }: { onAdd: (t: BlockType, l?: 1|2|3) => void }) {
  const [open, setOpen] = useState(false);
  const [headingLevel, setHeadingLevel] = useState<1|2|3>(1);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400 text-sm transition-all">
        <Plus size={15} /> Add text block
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-2 z-20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 pb-1.5">Content blocks</p>
          {BLOCK_OPTIONS.map((opt) => (
            <div key={opt.type}>
              <button onClick={() => { onAdd(opt.type, opt.type === "heading" ? headingLevel : undefined); setOpen(false); }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-left transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 transition-colors">{opt.icon}</div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</p>
                  {opt.sub && <p className="text-[10px] text-gray-400">{opt.sub}</p>}
                </div>
              </button>
              {opt.type === "heading" && (
                <div className="flex gap-1 px-2 pb-1">
                  {([1,2,3] as const).map((l) => (
                    <button key={l} onClick={() => setHeadingLevel(l)}
                      className={cn("w-7 h-6 rounded text-xs font-bold transition-colors", headingLevel === l ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500")}>
                      H{l}
                    </button>
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

// ── Slide text block component ────────────────────────────────────────────────

const FORMAT_META: { value: SlideTextBlock["format"]; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: "heading", label: "Heading",    icon: <Hash size={10} />,         cls: "text-xl font-bold text-gray-900 dark:text-gray-100" },
  { value: "body",    label: "Body",       icon: <AlignJustify size={10} />, cls: "text-sm text-gray-700 dark:text-gray-300" },
  { value: "caption", label: "Caption",    icon: <AlignLeft size={10} />,    cls: "text-xs text-gray-400 dark:text-gray-500" },
  { value: "key",     label: "Key Insight",icon: <Quote size={10} />,        cls: "text-sm font-medium text-indigo-700 dark:text-indigo-300 border-l-4 border-indigo-400 pl-3" },
];

function SlideTextBlockEditor({
  tb, onUpdate, onDelete, onAISuggest, aiLoading,
}: {
  tb: SlideTextBlock;
  onUpdate: (patch: Partial<SlideTextBlock>) => void;
  onDelete: () => void;
  onAISuggest: () => void;
  aiLoading: boolean;
}) {
  const meta = FORMAT_META.find((m) => m.value === tb.format) ?? FORMAT_META[1];
  return (
    <div className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0.5">
          {FORMAT_META.map((m) => (
            <button key={m.value} onClick={() => onUpdate({ format: m.value })}
              title={m.label}
              className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                tb.format === m.value ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700")}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={onAISuggest} disabled={aiLoading}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors disabled:opacity-40">
          {aiLoading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} AI
        </button>
        <button onClick={onDelete}
          className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors">
          <X size={11} />
        </button>
      </div>
      {/* Editable content */}
      <textarea
        value={tb.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder={`Enter ${meta.label.toLowerCase()} text…`}
        className={cn("w-full resize-none bg-transparent px-3 py-2 focus:outline-none leading-relaxed min-h-[56px]", meta.cls)}
        rows={2}
      />
    </div>
  );
}

// ── Editable presentation slide ───────────────────────────────────────────────

function EditableSlide({ block, onUpdate }: {
  block: DashboardBlock;
  onUpdate: (patch: Partial<DashboardBlock>) => void;
}) {
  const { llmSettings } = useDataStore();

  const defaultHeading = block.slideAnnotations?.heading ?? block.question ?? block.title ?? "";
  const textBlocks = block.slideAnnotations?.textBlocks ?? [];
  const shownSections: ("table"|"insights")[] = block.slideAnnotations?.shownSections ?? [];

  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(defaultHeading);
  const [aiHeadingLoading, setAiHeadingLoading] = useState(false);
  const [blockAiLoading, setBlockAiLoading] = useState<Record<string, boolean>>({});

  // Chart height percentage (drag resize)
  const [chartPct, setChartPct] = useState(56);
  const slideRef = useRef<HTMLDivElement>(null);

  const makeResizer = useCallback(() => (e: React.MouseEvent) => {
    e.preventDefault();
    const dragging = { on: true };
    const move = (ev: MouseEvent) => {
      if (!dragging.on || !slideRef.current) return;
      const rect = slideRef.current.getBoundingClientRect();
      setChartPct(Math.min(Math.max(((ev.clientY - rect.top) / rect.height) * 100, 15), 80));
    };
    const up = () => { dragging.on = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }, []);

  const saveHeading = (val: string) => {
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, heading: val } });
    setEditingHeading(false);
  };

  const handleAIHeading = async () => {
    if (!block.data?.length) return;
    setAiHeadingLoading(true);
    try {
      const h = await suggestSlideHeading(block.data, block.title, block.insights, llmSettings);
      setHeadingDraft(h);
      onUpdate({ slideAnnotations: { ...block.slideAnnotations, heading: h } });
    } catch { /* ignore */ }
    finally { setAiHeadingLoading(false); }
  };

  const toggleSection = (sec: "table"|"insights") => {
    const next = shownSections.includes(sec)
      ? shownSections.filter((s) => s !== sec)
      : [...shownSections, sec];
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, shownSections: next } });
  };

  const addTextBlock = () => {
    const nb: SlideTextBlock = { id: generateId(), content: "", format: "body" };
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, textBlocks: [...textBlocks, nb] } });
  };

  const updateTextBlock = (id: string, patch: Partial<SlideTextBlock>) => {
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, textBlocks: textBlocks.map((tb) => tb.id === id ? { ...tb, ...patch } : tb) } });
  };

  const deleteTextBlock = (id: string) => {
    onUpdate({ slideAnnotations: { ...block.slideAnnotations, textBlocks: textBlocks.filter((tb) => tb.id !== id) } });
  };

  const handleAITextBlock = async (id: string) => {
    if (!block.data?.length) return;
    setBlockAiLoading((p) => ({ ...p, [id]: true }));
    try {
      const text = await suggestSlideCommentary(defaultHeading, block.data, block.insights, llmSettings);
      updateTextBlock(id, { content: text });
    } catch { /* ignore */ }
    finally { setBlockAiLoading((p) => ({ ...p, [id]: false })); }
  };

  const isChart    = block.type === "chart" && Boolean(block.chartConfig) && Boolean(block.data?.length);
  const isTable    = block.type === "table" && Boolean(block.data?.length);
  const isInsights = block.type === "insights" && Boolean(block.insights ?? block.content);
  const hasVisual  = isChart || isTable || isInsights;

  const canAddTable    = isChart && Boolean(block.data?.length);
  const canAddInsights = (isChart || isTable) && Boolean(block.insights);
  const showExtraTable    = shownSections.includes("table") && canAddTable;
  const showExtraInsights = shownSections.includes("insights") && canAddInsights;
  const hasExtras = showExtraTable || showExtraInsights;

  return (
    <div ref={slideRef}
      className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      style={{ height: "82vh" }}>

      {/* ── Heading ── */}
      <div className="shrink-0 px-10 pt-7 pb-2">
        <div className="flex items-center gap-2">
          {editingHeading ? (
            <>
              <input autoFocus value={headingDraft}
                onChange={(e) => setHeadingDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveHeading(headingDraft); if (e.key === "Escape") setEditingHeading(false); }}
                className="flex-1 text-2xl font-bold bg-transparent outline-none border-b-2 border-indigo-400 text-gray-900 dark:text-gray-100" />
              <button onClick={() => saveHeading(headingDraft)} className="p-1 rounded text-green-500 hover:bg-green-50"><Check size={16} /></button>
            </>
          ) : (
            <>
              <h2 className="flex-1 text-2xl font-bold text-gray-900 dark:text-gray-100 cursor-text"
                onClick={() => { setHeadingDraft(defaultHeading); setEditingHeading(true); }}>
                {defaultHeading || <span className="text-gray-400 font-normal italic">Click to add title…</span>}
              </h2>
              <button onClick={() => { setHeadingDraft(defaultHeading); setEditingHeading(true); }}
                className="p-1 rounded opacity-30 hover:opacity-80 text-gray-400 transition-opacity"><Edit3 size={14} /></button>
            </>
          )}
          {/* AI Heading */}
          <button onClick={handleAIHeading} disabled={!block.data?.length || aiHeadingLoading}
            title="AI suggest heading"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 disabled:opacity-40 transition-colors">
            {aiHeadingLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            AI
          </button>
        </div>
      </div>

      {/* ── Section toggle pills ── */}
      {(canAddTable || canAddInsights) && (
        <div className="shrink-0 px-10 pb-1 flex items-center gap-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Show:</span>
          {canAddTable && (
            <button onClick={() => toggleSection("table")}
              className={cn("flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                showExtraTable ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-indigo-400 hover:text-indigo-600")}>
              <Table2 size={11} /> Data Table
            </button>
          )}
          {canAddInsights && (
            <button onClick={() => toggleSection("insights")}
              className={cn("flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                showExtraInsights ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-indigo-400 hover:text-indigo-600")}>
              <Lightbulb size={11} /> Insights
            </button>
          )}
        </div>
      )}

      {/* ── Main content (resizable) ── */}
      {hasVisual && (
        <div className="shrink-0 px-10 overflow-hidden" style={{ height: `${chartPct}%` }}>
          {isChart && <RechartsDisplay config={block.chartConfig!} data={block.data!} />}
          {isTable && <div className="h-full overflow-auto"><ResultsTable data={block.data!} /></div>}
          {isInsights && <div className="h-full overflow-auto"><InsightsCard insights={block.insights ?? block.content} /></div>}
        </div>
      )}

      {/* ── Resize handle (always visible for chart slides) ── */}
      {hasVisual && (
        <div onMouseDown={makeResizer()}
          className="shrink-0 h-3 mx-10 cursor-row-resize flex items-center justify-center group">
          <div className="w-20 h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-indigo-400 transition-colors" />
        </div>
      )}

      {/* ── Extra sections ── */}
      {hasExtras && (
        <div className="shrink-0 px-10 flex gap-3" style={{ height: `${Math.max(0, 72 - chartPct)}%`, minHeight: "80px", maxHeight: "40%" }}>
          {showExtraTable && (
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1 shrink-0">Data Table</p>
              <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <ResultsTable data={block.data!} />
              </div>
            </div>
          )}
          {showExtraInsights && (
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1 shrink-0">Key Insights</p>
              <div className="flex-1 min-h-0 overflow-auto"><InsightsCard insights={block.insights ?? block.content} /></div>
            </div>
          )}
        </div>
      )}

      {/* ── Text blocks section ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-10 pb-7 pt-2 flex flex-col gap-2">
        {textBlocks.map((tb) => (
          <SlideTextBlockEditor
            key={tb.id} tb={tb}
            onUpdate={(patch) => updateTextBlock(tb.id, patch)}
            onDelete={() => deleteTextBlock(tb.id)}
            onAISuggest={() => handleAITextBlock(tb.id)}
            aiLoading={!!blockAiLoading[tb.id]}
          />
        ))}
        {/* Add text box button */}
        <button onClick={addTextBlock}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-600 dark:hover:text-indigo-400 text-sm transition-all self-start">
          <Plus size={14} /> Add text box
        </button>
      </div>
    </div>
  );
}

// ── Export slide (simplified, for PDF capture) ────────────────────────────────

function ExportSlide({ block }: { block: DashboardBlock }) {
  const heading = block.slideAnnotations?.heading ?? block.question ?? block.title ?? "";
  const textBlocks = block.slideAnnotations?.textBlocks ?? [];
  const fmtCls: Record<SlideTextBlock["format"], string> = {
    heading: "text-xl font-bold text-gray-900 mt-2",
    body:    "text-sm text-gray-700 leading-relaxed",
    caption: "text-xs text-gray-400",
    key:     "text-sm font-medium text-indigo-700 border-l-4 border-indigo-400 pl-3",
  };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "48px 56px", boxSizing: "border-box", background: "#fff" }}>
      {heading && <h2 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: "0 0 16px 0", flexShrink: 0 }}>{heading}</h2>}
      {(block.type === "chart" && block.chartConfig && block.data?.length) && (
        <div style={{ flex: textBlocks.length ? "0 0 65%" : 1, minHeight: 0 }}>
          <RechartsDisplay config={block.chartConfig} data={block.data} />
        </div>
      )}
      {(block.type === "table" && block.data?.length) && (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <ResultsTable data={block.data} />
        </div>
      )}
      {textBlocks.length > 0 && (
        <div style={{ flexShrink: 0, marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {textBlocks.map((tb) => (
            <p key={tb.id} className={fmtCls[tb.format]}>{tb.content}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Presentation view ─────────────────────────────────────────────────────────

function PresentationView({ blocks, onUpdate, onExportPDF }: {
  blocks: DashboardBlock[];
  onUpdate: (id: string, patch: Partial<DashboardBlock>) => void;
  onExportPDF: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const displayBlocks = blocks.filter((b) => b.type !== "divider");
  if (!displayBlocks.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      No content to present. Pin charts, tables, or insights first.
    </div>
  );
  const total = displayBlocks.length;
  const safeSlide = Math.min(slide, total - 1);
  const current = displayBlocks[safeSlide];
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-950 to-indigo-950">
      <div className="shrink-0 flex items-center justify-between px-8 py-3">
        <span className="text-xs text-gray-500 font-medium tracking-widest uppercase">{safeSlide + 1} / {total}</span>
        <button onClick={onExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors">
          <FileDown size={13} /> Export PDF
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-8 py-2">
        <EditableSlide block={current} onUpdate={(patch) => onUpdate(current.id, patch)} />
      </div>
      <div className="shrink-0 flex items-center justify-center gap-6 py-4">
        <button onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={safeSlide === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm font-medium transition-colors">
          <ChevronLeft size={16} /> Previous
        </button>
        <div className="flex gap-1.5">
          {displayBlocks.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={cn("rounded-full transition-all", i === safeSlide ? "w-5 h-2 bg-indigo-400" : "w-2 h-2 bg-white/30 hover:bg-white/50")} />
          ))}
        </div>
        <button onClick={() => setSlide((s) => Math.min(total - 1, s + 1))} disabled={safeSlide === total - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm font-medium transition-colors">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type DashboardMode = "document" | "presentation";

export function Dashboard() {
  const { dashboardOpen, toggleDashboard, dashboardBlocks, addDashboardBlock, removeDashboardBlock, updateDashboardBlock, addToast } = useDataStore();
  const [mode, setMode] = useState<DashboardMode>("document");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { containerRef: gridContainerRef, width: gridWidth } = useContainerWidth({ initialWidth: 1200 });

  if (!dashboardOpen) return null;

  const displayBlocks = dashboardBlocks.filter((b) => b.type !== "divider");

  const handleAdd = (type: BlockType, level?: 1|2|3) => {
    addDashboardBlock({
      id: generateId(), type,
      content: type === "heading" ? "New heading" : type === "text" ? "" : undefined,
      level: type === "heading" ? (level ?? 1) : undefined,
      layout: { x: 0, y: 9999, w: 12, h: type === "divider" ? 1 : type === "heading" ? 2 : 3 },
    });
  };

  const handleLayoutChange = (newLayout: GridItemLayout[]) => {
    newLayout.forEach((item) => updateDashboardBlock(item.i, { layout: { x: item.x, y: item.y, w: item.w, h: item.h } }));
  };

  // ── Document PDF ──────────────────────────────────────────────────────────
  const handleDocumentPDF = async () => {
    addToast({ variant: "info", title: "Generating PDF…" });
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("dashboard-grid-content");
      if (!el) throw new Error("Dashboard element not found");
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, allowTaint: true, foreignObjectRendering: true, backgroundColor: "#ffffff", logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW - 16;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight() - 16;
      let y = 8; let remaining = imgH;
      pdf.addImage(imgData, "PNG", 8, y, imgW, imgH);
      remaining -= pageH;
      while (remaining > 0) { pdf.addPage(); y = -(imgH - remaining); pdf.addImage(imgData, "PNG", 8, y, imgW, imgH); remaining -= pageH; }
      pdf.save("datachat-dashboard.pdf");
      addToast({ variant: "success", title: "PDF exported" });
    } catch (e) { addToast({ variant: "error", title: "Export failed", message: String(e) }); }
  };

  // ── Presentation PDF — render all slides in a visible overlay, capture each ──
  const handlePresentationPDF = async () => {
    if (!displayBlocks.length) { addToast({ variant: "warning", title: "No slides to export" }); return; }
    setPdfExporting(true);
    setExportProgress(0);

    // Wait for React to render the overlay + recharts to initialise
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;

      const slideEls = document.querySelectorAll<HTMLElement>("[data-export-slide]");
      let first = true;
      for (let idx = 0; idx < slideEls.length; idx++) {
        setExportProgress(idx + 1);
        const el = slideEls[idx];
        const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, allowTaint: true, foreignObjectRendering: true, backgroundColor: "#ffffff", logging: false });
        const imgW = pageW - margin * 2;
        const imgH = Math.min((canvas.height * imgW) / canvas.width, pageH - margin * 2);
        if (!first) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
        first = false;
        await new Promise((r) => setTimeout(r, 100));
      }
      pdf.save("datachat-presentation.pdf");
      addToast({ variant: "success", title: "Slides exported" });
    } catch (e) {
      addToast({ variant: "error", title: "Export failed", message: String(e) });
    } finally {
      setPdfExporting(false);
      setExportProgress(0);
    }
  };

  const gridLayout: GridItemLayout[] = dashboardBlocks.map((b) => ({
    i: b.id, x: b.layout?.x ?? 0, y: b.layout?.y ?? 0, w: b.layout?.w ?? 6, h: b.layout?.h ?? 6, minW: 2, minH: 2,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <LayoutDashboard size={17} className="text-indigo-600 shrink-0" />
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">Dashboard</h1>
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(["document", "presentation"] as DashboardMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                mode === m ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}>
              {m === "document" ? <><FileText size={12} /> Document</> : <><Presentation size={12} /> Presentation</>}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{dashboardBlocks.length} block{dashboardBlocks.length !== 1 ? "s" : ""}</span>
        {dashboardBlocks.length > 0 && mode === "document" && (
          <button onClick={handleDocumentPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <FileDown size={13} /> Export PDF
          </button>
        )}
        <button onClick={toggleDashboard} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Document mode */}
      {mode === "document" && (
        <div className="flex-1 overflow-y-auto">
          {dashboardBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                <LayoutDashboard size={28} className="text-indigo-300" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-gray-500">Your dashboard is empty</p>
                <p className="text-sm mt-1 text-gray-400">Pin charts, tables and insights from the output panel,<br />or add text blocks below</p>
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
              <GridLayout layout={gridLayout} cols={12} rowHeight={50} width={gridWidth} isDraggable isResizable draggableHandle=".drag-handle" onLayoutChange={handleLayoutChange} margin={[12, 12]} containerPadding={[0, 0]}>
                {dashboardBlocks.map((block) => (
                  <div key={block.id}>
                    <GridBlockShell block={block} onRemove={() => removeDashboardBlock(block.id)} onUpdate={(patch) => updateDashboardBlock(block.id, patch)} />
                  </div>
                ))}
              </GridLayout>
              <div className="mt-4 px-1"><AddBlockMenu onAdd={handleAdd} /></div>
            </div>
          )}
        </div>
      )}

      {/* Presentation mode */}
      {mode === "presentation" && (
        <PresentationView blocks={dashboardBlocks} onUpdate={(id, patch) => updateDashboardBlock(id, patch)} onExportPDF={handlePresentationPDF} />
      )}

      {/* ── PDF export overlay (renders all slides for capture) ── */}
      {pdfExporting && (
        <div className="fixed inset-0 z-[200] bg-gray-950 overflow-auto">
          {/* Loading indicator */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white dark:bg-gray-900 rounded-2xl p-8 text-center shadow-2xl min-w-[240px]">
            <Loader2 size={28} className="animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Exporting slides…</p>
            <p className="text-xs text-gray-400 mt-1">{exportProgress} / {displayBlocks.length}</p>
          </div>
          {/* All slides rendered at 1280×720 for html2canvas */}
          <div className="relative" style={{ width: 1280, margin: "0 auto" }}>
            {displayBlocks.map((block, i) => (
              <div
                key={block.id}
                data-export-slide={i}
                className="bg-white"
                style={{ width: 1280, height: 720, overflow: "hidden", position: "relative", marginBottom: 4 }}
              >
                <ExportSlide block={block} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
