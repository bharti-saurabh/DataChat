import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Chart, registerables } from "chart.js";
import { Download, LayoutDashboard, RefreshCw, Loader2, BarChart2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { generateChartCode } from "@/lib/chartGen";
import { generateId } from "@/lib/utils";
import type { QueryRow } from "@/types";

Chart.register(...registerables);

interface ChartDisplayProps {
  chartCode?: string;
  chartLoading?: boolean;
  data: QueryRow[];
  question?: string;
  insights?: string;
  messageId: string;
  onRegenerate?: (code: string) => void;
}

export function ChartDisplay({
  chartCode,
  chartLoading,
  data,
  question,
  insights,
  messageId,
  onRegenerate,
}: ChartDisplayProps) {
  const uid = useId().replace(/:/g, "");
  const canvasId = `chart-${uid}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [description, setDescription] = useState("Draw the most appropriate chart");
  const [showRegenInput, setShowRegenInput] = useState(false);
  const { addDashboardChart, llmSettings, addToast } = useDataStore();

  // Execute chart code whenever it changes
  useEffect(() => {
    if (!chartCode || !canvasRef.current) return;
    setExecError(null);

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    try {
      // eslint-disable-next-line no-new-func
      const draw = new Function("Chart", "data", chartCode.replace(/getElementById\("chart"\)/g, `getElementById("${canvasId}")`));
      chartRef.current = draw(Chart, data);
    } catch (e) {
      setExecError(String(e));
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartCode, canvasId, data]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `datachat-chart-${messageId}.png`;
    a.click();
  }, [messageId]);

  const handleAddToDashboard = useCallback(() => {
    if (!chartCode) return;
    addDashboardChart({ id: generateId(), title: question ?? "Chart", chartCode, data, insights });
    addToast({ variant: "success", title: "Added to dashboard" });
  }, [chartCode, question, data, insights, addDashboardChart, addToast]);

  const handleRegenerate = useCallback(async () => {
    if (!question || !data.length) return;
    setRegenerating(true);
    try {
      const code = await generateChartCode(data, question, description, llmSettings);
      onRegenerate?.(code);
    } catch (e) {
      addToast({ variant: "error", title: "Chart regeneration failed", message: String(e) });
    } finally {
      setRegenerating(false);
      setShowRegenInput(false);
    }
  }, [question, data, description, llmSettings, onRegenerate, addToast]);

  if (chartLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Generating chart…
        </div>
        <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg h-48" />
      </div>
    );
  }

  if (!chartCode) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        <BarChart2 size={14} className="text-blue-600 mr-1" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex-1 truncate">{question}</span>
        <button onClick={() => setShowRegenInput((v) => !v)} title="Edit chart" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600">
          <RefreshCw size={13} />
        </button>
        <button onClick={handleAddToDashboard} title="Add to dashboard" className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950 text-gray-400 hover:text-blue-600">
          <LayoutDashboard size={13} />
        </button>
        <button onClick={handleDownload} title="Download PNG" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600">
          <Download size={13} />
        </button>
      </div>

      {/* Regenerate input */}
      {showRegenInput && (
        <div className="flex gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegenerate()}
            placeholder="Describe changes…"
            className="flex-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Update
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="p-3">
        {execError ? (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded p-2">{execError}</div>
        ) : (
          <canvas ref={canvasRef} id={canvasId} />
        )}
      </div>
    </div>
  );
}
