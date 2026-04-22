import { useState, useCallback, useRef, useEffect } from "react";
import { BarChart2, Table, Code2, LayoutDashboard, Download, Plus, Loader2, Sparkles, ChevronDown, ChevronUp, Send } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { RechartsDisplay } from "@/components/output/RechartsDisplay";
import { ResultsTable } from "@/components/results/ResultsTable";
import { SQLEditorPopup } from "@/components/chat/SQLEditorPopup";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { generatePythonCode } from "@/lib/pythonGen";
import { editChartConfig } from "@/lib/chartGen";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChartType } from "@/types";

// lucide-react doesn't have a Python icon — use a text badge instead
const PythonIcon = () => <span className="text-[10px] font-bold font-mono text-yellow-500">Py</span>;

type Tab = "visual" | "table" | "query";

const TAB_META: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: "visual", icon: <BarChart2 size={13} />, label: "Chart & Insights" },
  { id: "table",  icon: <Table size={13} />,     label: "Table"            },
  { id: "query",  icon: <Code2 size={13} />,     label: "SQL / Python"     },
];


// ── Quick chart-type swap chips ───────────────────────────────────────────────
const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "bar",     label: "Bar"    },
  { type: "line",    label: "Line"   },
  { type: "area",    label: "Area"   },
  { type: "pie",     label: "Pie"    },
  { type: "donut",   label: "Donut"  },
  { type: "scatter", label: "Scatter"},
];

export function OutputPanel() {
  const { messages, selectedMessageId, addDashboardBlock, addToast, llmSettings, updateMessage } = useDataStore();

  const [activeTab, setActiveTab] = useState<Tab>("visual");
  const [sqlOpen, setSqlOpen] = useState(false);
  const [pythonCode, setPythonCode] = useState<string | null>(null);
  const [pythonLoading, setPythonLoading] = useState(false);
  const [showPython, setShowPython] = useState(false);

  // Chart editor state
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const msg: ChatMessage | undefined =
    (selectedMessageId ? messages.find((m) => m.id === selectedMessageId) : undefined) ??
    [...messages].reverse().find((m) => m.role === "assistant");

  const hasChart    = !!(msg?.autoChartConfig || msg?.autoChartLoading);
  const hasInsights = !!(msg?.insights || msg?.insightsLoading);
  const hasVisual   = hasChart || hasInsights;
  const hasTable    = !!(msg?.result && msg.result.length > 0);
  const hasSql      = !!msg?.sql;

  const available: Record<Tab, boolean> = { visual: hasVisual, table: hasTable, query: hasSql };
  const currentTab = available[activeTab] ? activeTab : (TAB_META.find((t) => available[t.id])?.id ?? "visual");

  // Reset per-message UI state when selected message changes
  const msgId = msg?.id;
  const prevMsgId = useRef(msgId);
  useEffect(() => {
    if (prevMsgId.current !== msgId) {
      prevMsgId.current = msgId;
      setPythonCode(null);
      setShowPython(false);
      setEditInstruction("");
      setEditOpen(false);
    }
  }, [msgId]);

  const handleAddChart = () => {
    if (!msg?.autoChartConfig) return;
    addDashboardBlock({ id: generateId(), type: "chart", title: msg.question ?? "Chart", chartConfig: msg.autoChartConfig, data: msg.result ?? [], insights: msg.insights, layout: { x: 0, y: 9999, w: 6, h: 8 } });
    addToast({ variant: "success", title: "Chart added to dashboard" });
  };

  const handleAddInsight = () => {
    if (!msg?.insights) return;
    addDashboardBlock({ id: generateId(), type: "insights", title: msg.question ?? "Insight", insights: msg.insights, layout: { x: 0, y: 9999, w: 6, h: 4 } });
    addToast({ variant: "success", title: "Insight added to dashboard" });
  };

  const handleAddTable = () => {
    if (!msg?.result?.length) return;
    addDashboardBlock({ id: generateId(), type: "table", title: msg.question ?? "Table", data: msg.result, layout: { x: 0, y: 9999, w: 12, h: 6 } });
    addToast({ variant: "success", title: "Table added to dashboard" });
  };

  const handleDownloadChart = () => {
    const svg = document.querySelector(".recharts-surface") as SVGElement | null;
    if (!svg) { addToast({ variant: "warning", title: "No chart to download" }); return; }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chart.svg"; a.click();
  };

  // ── Chart editor ─────────────────────────────────────────────────────────────

  const applyChartEdit = useCallback(async (instruction: string) => {
    if (!msg?.autoChartConfig || !msg.result || !instruction.trim()) return;
    setEditLoading(true);
    try {
      const newConfig = await editChartConfig(msg.autoChartConfig, instruction, msg.result, llmSettings);
      updateMessage(msg.id, { autoChartConfig: newConfig });
      setEditInstruction("");
    } catch (e) {
      addToast({ variant: "error", title: "Chart edit failed", message: String(e) });
    } finally {
      setEditLoading(false);
    }
  }, [msg, llmSettings, updateMessage, addToast]);

  const swapChartType = useCallback((type: ChartType) => {
    if (!msg?.autoChartConfig) return;
    updateMessage(msg.id, { autoChartConfig: { ...msg.autoChartConfig, chartType: type } });
  }, [msg, updateMessage]);

  const handleGeneratePython = useCallback(async () => {
    if (!msg?.sql || !msg.result) return;
    setPythonLoading(true);
    setShowPython(true);
    try {
      const code = await generatePythonCode(msg.sql, msg.result, msg.question ?? "", llmSettings);
      setPythonCode(code);
    } catch (e) {
      addToast({ variant: "error", title: "Python generation failed", message: String(e) });
    } finally {
      setPythonLoading(false);
    }
  }, [msg, llmSettings, addToast]);

  if (!msg) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
          <BarChart2 size={22} className="text-indigo-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Output appears here</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Ask a question to see charts, tables, and insights</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0.5 px-3 pt-3 pb-0 border-b border-gray-200 dark:border-gray-700">
        {TAB_META.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} disabled={!available[t.id]}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap",
              currentTab === t.id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40"
                : available[t.id]
                ? "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                : "border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed",
            )}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">

        {/* ── Visual: Chart + Insights ── */}
        {currentTab === "visual" && (
          <div className="flex flex-col gap-5">
            {/* Chart section */}
            {(hasChart) && (
              <div className="space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Chart</span>
                    {msg.autoChartConfig && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono">
                        {msg.autoChartConfig.chartType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {msg.autoChartConfig && (
                      <button
                        onClick={() => { setEditOpen((v) => !v); setTimeout(() => editInputRef.current?.focus(), 50); }}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-colors",
                          editOpen
                            ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                            : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400",
                        )}
                      >
                        <Sparkles size={10} /> Edit
                        {editOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                    <button onClick={handleDownloadChart} title="Download SVG"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <Download size={12} />
                    </button>
                    {msg.autoChartConfig && (
                      <button onClick={handleAddChart}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                        <Plus size={10} /><LayoutDashboard size={10} /> Pin
                      </button>
                    )}
                  </div>
                </div>

                {/* Chart render */}
                {msg.autoChartLoading ? (
                  <div className="space-y-2">
                    <div className="shimmer h-5 w-1/2" />
                    <div className="shimmer h-52 w-full" />
                  </div>
                ) : msg.autoChartConfig ? (
                  <div className="h-56 min-h-[180px]">
                    <RechartsDisplay config={msg.autoChartConfig} data={msg.result ?? []} />
                  </div>
                ) : null}

                {/* ── Chart editor ── */}
                {editOpen && msg.autoChartConfig && (
                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 space-y-2.5">
                    {/* Quick chart-type swap */}
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1.5 font-medium">Chart type</p>
                      <div className="flex flex-wrap gap-1">
                        {CHART_TYPES.map(({ type, label }) => (
                          <button
                            key={type}
                            onClick={() => swapChartType(type)}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                              msg.autoChartConfig?.chartType === type
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Free-text AI instruction */}
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1.5 font-medium">AI instruction</p>
                      <div className="flex gap-2">
                        <input
                          ref={editInputRef}
                          value={editInstruction}
                          onChange={(e) => setEditInstruction(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !editLoading) applyChartEdit(editInstruction); }}
                          placeholder="e.g. use Month on x-axis, show Revenue as area chart, add title…"
                          disabled={editLoading}
                          className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 disabled:opacity-60"
                        />
                        <button
                          onClick={() => applyChartEdit(editInstruction)}
                          disabled={!editInstruction.trim() || editLoading}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                        >
                          {editLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          {editLoading ? "…" : "Apply"}
                        </button>
                      </div>
                      {/* Suggestion chips */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          "Add a descriptive title",
                          "Show as percentage",
                          "Switch axes",
                          "Group by category",
                        ].map((s) => (
                          <button
                            key={s}
                            onClick={() => applyChartEdit(s)}
                            disabled={editLoading}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-40"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current config summary */}
                    {msg.autoChartConfig && (
                      <p className="text-[10px] text-gray-400 font-mono">
                        x: <span className="text-gray-600 dark:text-gray-300">{msg.autoChartConfig.xKey}</span>
                        {" · "}y: <span className="text-gray-600 dark:text-gray-300">
                          {Array.isArray(msg.autoChartConfig.yKey) ? msg.autoChartConfig.yKey.join(", ") : msg.autoChartConfig.yKey}
                        </span>
                        {msg.autoChartConfig.title && (
                          <>{" · "}<span className="text-gray-600 dark:text-gray-300">"{msg.autoChartConfig.title}"</span></>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            {hasChart && hasInsights && <hr className="border-gray-100 dark:border-gray-800" />}

            {/* Insights section */}
            {hasInsights && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Insights</span>
                  {msg.insights && (
                    <button onClick={handleAddInsight}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                      <Plus size={10} /><LayoutDashboard size={10} /> Pin
                    </button>
                  )}
                </div>
                <InsightsCard insights={msg.insights} loading={msg.insightsLoading} />
              </div>
            )}

            {!hasChart && !hasInsights && (
              <p className="text-sm text-gray-400 text-center py-12">No visual output for this query</p>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {currentTab === "table" && (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button onClick={handleAddTable}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                <Plus size={10} /><LayoutDashboard size={10} /> Pin to Dashboard
              </button>
            </div>
            {msg.result && msg.result.length > 0
              ? <ResultsTable data={msg.result} question={msg.question} />
              : <p className="text-sm text-gray-400 text-center py-8">No results</p>}
          </div>
        )}

        {/* ── SQL / Python ── */}
        {currentTab === "query" && msg.sql && (
          <div className="space-y-4">
            {/* SQL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">SQL Query</span>
                <button onClick={() => setSqlOpen((v) => !v)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  {sqlOpen ? "Close editor" : "Edit in Monaco"}
                </button>
              </div>
              {sqlOpen ? (
                <SQLEditorPopup sql={msg.sql} onClose={() => setSqlOpen(false)} />
              ) : (
                <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {msg.sql}
                </pre>
              )}
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Python */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <PythonIcon /> Python / pandas
                </span>
                {!showPython && (
                  <button onClick={handleGeneratePython}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800 transition-colors font-medium">
                    Generate Python
                  </button>
                )}
              </div>

              {showPython && (
                pythonLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                    <Loader2 size={13} className="animate-spin" /> Generating pandas code…
                  </div>
                ) : pythonCode ? (
                  <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-800 text-green-300 rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {pythonCode}
                  </pre>
                ) : null
              )}
              {!showPython && (
                <p className="text-xs text-gray-400">Click "Generate Python" to get the pandas equivalent of this SQL query.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
