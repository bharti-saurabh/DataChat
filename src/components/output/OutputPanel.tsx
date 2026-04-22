import { useState } from "react";
import { BarChart2, Table, Lightbulb, Code2, MessageSquare, LayoutDashboard, Download, Plus } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { RechartsDisplay } from "@/components/output/RechartsDisplay";
import { ResultsTable } from "@/components/results/ResultsTable";
import { SQLEditorPopup } from "@/components/chat/SQLEditorPopup";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

type Tab = "chart" | "table" | "insights" | "sql" | "next";

const TAB_META: { id: Tab; icon: React.ReactNode; label: string }[] = [
  { id: "chart",    icon: <BarChart2 size={13} />,     label: "Chart"     },
  { id: "table",    icon: <Table size={13} />,          label: "Table"     },
  { id: "insights", icon: <Lightbulb size={13} />,     label: "Insights"  },
  { id: "sql",      icon: <Code2 size={13} />,          label: "SQL"       },
  { id: "next",     icon: <MessageSquare size={13} />,  label: "Next Qs"   },
];

interface OutputPanelProps {
  onFollowUp: (q: string) => void;
}

export function OutputPanel({ onFollowUp }: OutputPanelProps) {
  const {
    messages, selectedMessageId, addDashboardBlock, addToast,
  } = useDataStore();

  const [activeTab, setActiveTab] = useState<Tab>("chart");
  const [sqlOpen, setSqlOpen] = useState(false);

  // Find the selected message (or fall back to latest assistant message)
  const msg: ChatMessage | undefined =
    (selectedMessageId ? messages.find((m) => m.id === selectedMessageId) : undefined) ??
    [...messages].reverse().find((m) => m.role === "assistant");

  // Which tabs have content?
  const hasChart    = !!(msg?.autoChartConfig || msg?.autoChartLoading);
  const hasTable    = !!(msg?.result && msg.result.length > 0);
  const hasInsights = !!(msg?.insights || msg?.insightsLoading);
  const hasSql      = !!msg?.sql;
  const hasNext     = !!(msg?.suggestions && msg.suggestions.length > 0);

  const availableTabs = TAB_META.filter((t) =>
    t.id === "chart" ? hasChart :
    t.id === "table" ? hasTable :
    t.id === "insights" ? hasInsights :
    t.id === "sql" ? hasSql :
    t.id === "next" ? hasNext : false
  );

  // Auto-switch to first available tab if current tab has no content
  const currentTab = availableTabs.find((t) => t.id === activeTab)?.id ?? availableTabs[0]?.id ?? "chart";

  const handleAddChart = () => {
    if (!msg?.autoChartConfig) return;
    addDashboardBlock({
      id: generateId(),
      type: "chart",
      title: msg.question ?? "Chart",
      chartConfig: msg.autoChartConfig,
      data: msg.result ?? [],
      insights: msg.insights,
    });
    addToast({ variant: "success", title: "Added to dashboard" });
  };

  const handleAddInsight = () => {
    if (!msg?.insights) return;
    addDashboardBlock({
      id: generateId(),
      type: "insights",
      title: msg.question ?? "Insight",
      insights: msg.insights,
    });
    addToast({ variant: "success", title: "Added to dashboard" });
  };

  const handleAddTable = () => {
    if (!msg?.result?.length) return;
    addDashboardBlock({
      id: generateId(),
      type: "table",
      title: msg.question ?? "Table",
      data: msg.result,
    });
    addToast({ variant: "success", title: "Added to dashboard" });
  };

  const handleDownloadChart = () => {
    const svg = document.querySelector(".recharts-surface") as SVGElement | null;
    if (!svg) { addToast({ variant: "warning", title: "No chart to download" }); return; }
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chart.svg";
    a.click();
  };

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
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0.5 px-3 pt-3 pb-0 border-b border-gray-200 dark:border-gray-700">
        {TAB_META.map((t) => {
          const available =
            t.id === "chart" ? hasChart :
            t.id === "table" ? hasTable :
            t.id === "insights" ? hasInsights :
            t.id === "sql" ? hasSql :
            t.id === "next" ? hasNext : false;

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              disabled={!available}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px",
                currentTab === t.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40"
                  : available
                  ? "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  : "border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed",
              )}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* Chart tab */}
        {currentTab === "chart" && (
          <div className="h-full flex flex-col gap-3">
            {msg.autoChartLoading ? (
              <div className="flex-1 flex flex-col gap-3">
                <div className="shimmer h-6 w-1/2" />
                <div className="flex-1 shimmer" />
              </div>
            ) : msg.autoChartConfig ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">
                    {msg.autoChartConfig.title ?? msg.question}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={handleDownloadChart} title="Download SVG"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <Download size={13} />
                    </button>
                    <button onClick={handleAddChart} title="Add to Dashboard"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                      <Plus size={11} />
                      <LayoutDashboard size={11} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-[240px]">
                  <RechartsDisplay config={msg.autoChartConfig} data={msg.result ?? []} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">No chart generated</div>
            )}
          </div>
        )}

        {/* Table tab */}
        {currentTab === "table" && (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button onClick={handleAddTable}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                <Plus size={11} />
                <LayoutDashboard size={11} />
                Add to Dashboard
              </button>
            </div>
            {msg.result && msg.result.length > 0 ? (
              <ResultsTable data={msg.result} question={msg.question} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No results</p>
            )}
          </div>
        )}

        {/* Insights tab */}
        {currentTab === "insights" && (
          <div className="space-y-3">
            {(msg.insights || msg.insightsLoading) && (
              <div className="flex items-center justify-end">
                {msg.insights && (
                  <button onClick={handleAddInsight}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 transition-colors">
                    <Plus size={11} />
                    <LayoutDashboard size={11} />
                    Add to Dashboard
                  </button>
                )}
              </div>
            )}
            <InsightsCard insights={msg.insights} loading={msg.insightsLoading} />
          </div>
        )}

        {/* SQL tab */}
        {currentTab === "sql" && msg.sql && (
          <div>
            <button
              onClick={() => setSqlOpen((v) => !v)}
              className="mb-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {sqlOpen ? "Close editor" : "Open in editor"}
            </button>
            {sqlOpen ? (
              <SQLEditorPopup sql={msg.sql} onClose={() => setSqlOpen(false)} />
            ) : (
              <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded-xl p-4 overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 leading-relaxed">
                {msg.sql}
              </pre>
            )}
          </div>
        )}

        {/* Next questions tab */}
        {currentTab === "next" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Suggested follow-ups</p>
            {msg.suggestions?.map((s) => (
              <button
                key={s}
                onClick={() => onFollowUp(s)}
                className="w-full text-left text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-300 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
