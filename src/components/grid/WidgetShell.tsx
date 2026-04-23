import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, MessageSquarePlus, Loader2, AlertTriangle, BarChart2, Hash, Table2, Lightbulb, Sparkles, ChevronDown, ChevronUp, Send } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { refineWidget, generateWidgetCommentary } from "@/lib/widgetBuilder";
import { KPIWidget } from "@/components/widgets/KPIWidget";
import { ChartWidget } from "@/components/widgets/ChartWidget";
import { TableWidget } from "@/components/widgets/TableWidget";
import { InsightWidget } from "@/components/widgets/InsightWidget";
import { cn } from "@/lib/utils";
import type { Widget } from "@/types";

const TYPE_META = {
  kpi:     { icon: <Hash size={10} />,        label: "KPI",     color: "rgba(99,102,241,0.1)",   text: "#6366f1" },
  chart:   { icon: <BarChart2 size={10} />,   label: "Chart",   color: "rgba(139,92,246,0.1)",   text: "#8b5cf6" },
  table:   { icon: <Table2 size={10} />,      label: "Table",   color: "rgba(6,182,212,0.1)",    text: "#0891b2" },
  insight: { icon: <Lightbulb size={10} />,   label: "Insight", color: "rgba(245,158,11,0.1)",   text: "#d97706" },
};

export function WidgetShell({ widget }: { widget: Widget }) {
  const { removeWidget, updateWidget, schemas, llmSettings, addToast } = useDataStore();
  const [hovered, setHovered] = useState(false);

  // Widget refinement (chart type, SQL, etc.)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);

  // AI commentary
  const [commentaryOpen, setCommentaryOpen] = useState(true);
  const [commentaryInput, setCommentaryInput] = useState("");
  const [commentaryRefining, setCommentaryRefining] = useState(false);
  const commentaryInputRef = useRef<HTMLInputElement>(null);

  const meta = TYPE_META[widget.type];

  // Auto-generate commentary when data first arrives (non-insight widgets)
  const prevLoadingRef = useRef(widget.loading);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = widget.loading;

    const shouldGenerate =
      wasLoading &&
      !widget.loading &&
      !widget.error &&
      widget.data &&
      widget.data.length > 0 &&
      (widget.type === "chart" || widget.type === "table") &&
      !widget.commentary &&
      !widget.commentaryLoading;

    if (!shouldGenerate) return;

    updateWidget(widget.id, { commentaryLoading: true });
    generateWidgetCommentary(widget, widget.data!, llmSettings)
      .then((text) => updateWidget(widget.id, { commentary: text, commentaryLoading: false }))
      .catch(() => updateWidget(widget.id, { commentaryLoading: false }));
  }, [widget.loading]);                                       // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefine = async () => {
    if (!chatInput.trim() || refining) return;
    setRefining(true);
    try {
      const updated = await refineWidget(widget, chatInput, schemas, llmSettings);
      updateWidget(widget.id, updated);
      setChatInput("");
      setChatOpen(false);
    } catch (e) {
      addToast({ variant: "error", title: "Refinement failed", message: String(e) });
    } finally {
      setRefining(false);
    }
  };

  const handleCommentaryRefine = async () => {
    if (!commentaryInput.trim() || commentaryRefining) return;
    if (!widget.data?.length) return;
    setCommentaryRefining(true);
    try {
      // Pass the user instruction as context so the LLM refines the existing commentary
      const enriched = { ...widget, title: `${widget.title} — instruction: ${commentaryInput}` };
      const text = await generateWidgetCommentary(enriched, widget.data, llmSettings);
      updateWidget(widget.id, { commentary: text });
      setCommentaryInput("");
    } catch (e) {
      addToast({ variant: "error", title: "Commentary update failed", message: String(e) });
    } finally {
      setCommentaryRefining(false);
    }
  };

  const handleRegenerateCommentary = async () => {
    if (!widget.data?.length || widget.commentaryLoading) return;
    updateWidget(widget.id, { commentaryLoading: true });
    try {
      const text = await generateWidgetCommentary(widget, widget.data, llmSettings);
      updateWidget(widget.id, { commentary: text, commentaryLoading: false });
    } catch {
      updateWidget(widget.id, { commentaryLoading: false });
    }
  };

  // Commentary only makes sense for chart and table widgets
  // KPI is self-explanatory; insight type IS the commentary
  const showCommentarySection =
    (widget.type === "chart" || widget.type === "table") &&
    !widget.loading &&
    !widget.error &&
    (widget.commentary || widget.commentaryLoading);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="h-full card flex flex-col overflow-hidden bg-white"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 shrink-0">
        <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
          style={{ background: meta.color, color: meta.text }}>
          {meta.icon}
          {meta.label}
        </span>
        <p className="text-xs font-semibold text-gray-700 flex-1 truncate">{widget.title}</p>

        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-0.5">
              <ToolBtn onClick={() => setChatOpen((v) => !v)} title="Refine widget with AI" active={chatOpen}>
                <MessageSquarePlus size={11} />
              </ToolBtn>
              <ToolBtn onClick={() => removeWidget(widget.id)} title="Remove" danger>
                <X size={11} />
              </ToolBtn>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2 h-px" style={{ background: "var(--border)" }} />

      {/* Main content — always flex-1, commentary is a fixed strip below */}
      <div className="flex-1 min-h-0 px-4 pb-3 overflow-hidden">
        {widget.loading ? (
          <div className="h-full flex flex-col justify-center gap-2.5">
            <div className="shimmer h-8 w-3/4" />
            <div className="shimmer h-4 w-full" />
            <div className="shimmer h-4 w-5/6" />
            <div className="shimmer h-4 w-2/3" />
          </div>
        ) : widget.error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <p className="text-xs text-gray-400 font-mono leading-relaxed line-clamp-5">{widget.error}</p>
          </div>
        ) : (
          <div className="h-full fade-up">
            {widget.type === "kpi"     && <KPIWidget widget={widget} />}
            {widget.type === "chart"   && <ChartWidget widget={widget} />}
            {widget.type === "table"   && <TableWidget widget={widget} />}
            {widget.type === "insight" && <InsightWidget widget={widget} />}
          </div>
        )}
      </div>

      {/* ── AI Commentary — fixed-height strip at bottom, never shrinks chart ── */}
      {showCommentarySection && (
        <div className="shrink-0 border-t" style={{ borderColor: "var(--border)" }}>
          {/* Header row */}
          <div className="flex items-center gap-1.5 px-4 py-1.5">
            <Sparkles size={10} style={{ color: "#d97706" }} />
            <span className="text-[9px] font-bold uppercase tracking-widest flex-1" style={{ color: "#d97706" }}>
              AI Insight
            </span>
            <button
              onClick={handleRegenerateCommentary}
              disabled={widget.commentaryLoading}
              title="Regenerate"
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={9} className={widget.commentaryLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setCommentaryOpen((v) => !v)}
              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              {commentaryOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {commentaryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {/* Commentary text — max 3 lines, scrollable */}
                <div className="px-4 pb-1.5 max-h-16 overflow-y-auto">
                  {widget.commentaryLoading ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="shimmer h-2.5 w-full rounded" />
                      <div className="shimmer h-2.5 w-5/6 rounded" />
                      <div className="shimmer h-2.5 w-4/5 rounded" />
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {widget.commentary}
                    </p>
                  )}
                </div>

                {/* Refine input */}
                <div className="px-3 pb-2.5">
                  <div className="flex gap-1.5 items-center rounded-lg border px-2.5 py-1 transition-colors focus-within:border-amber-300"
                    style={{ borderColor: "rgba(245,158,11,0.22)", background: "rgba(245,158,11,0.03)" }}>
                    <input
                      ref={commentaryInputRef}
                      value={commentaryInput}
                      onChange={(e) => setCommentaryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommentaryRefine(); }}
                      placeholder="Refine this insight…"
                      disabled={commentaryRefining || widget.commentaryLoading}
                      className="flex-1 bg-transparent text-[11px] focus:outline-none"
                      style={{ color: "var(--text-1)" }}
                    />
                    <button
                      onClick={handleCommentaryRefine}
                      disabled={!commentaryInput.trim() || commentaryRefining || widget.commentaryLoading}
                      className="w-5 h-5 flex items-center justify-center text-amber-400 hover:text-amber-600 disabled:opacity-30 transition-colors"
                    >
                      {commentaryRefining ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Widget AI Refine Drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            <div className="p-3 flex gap-2 bg-gray-50/60">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                placeholder="e.g. Change to a line chart, show top 10 only…"
                className="flex-1 input text-[11px]"
                autoFocus
              />
              <button onClick={handleRefine} disabled={!chatInput.trim() || refining}
                className="btn-primary px-3 py-1.5 text-[11px] flex items-center gap-1.5">
                {refining ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Update
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ToolBtn({ children, onClick, title, active, danger }: {
  children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; danger?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={cn(
        "w-6 h-6 rounded-lg flex items-center justify-center transition-all text-xs",
        danger ? "text-gray-300 hover:text-red-500 hover:bg-red-50" :
          active ? "text-indigo-600 bg-indigo-50" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100",
      )}>
      {children}
    </button>
  );
}
