import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart2, RefreshCw, Download, Loader2, Wand2 } from "lucide-react";
import { Chart, registerables } from "chart.js";
import { useDataStore } from "@/store/useDataStore";
import { callLLM } from "@/lib/llm";
import { extractJSCode } from "@/lib/utils";
import type { QueryRow } from "@/types";

Chart.register(...registerables);

interface ChartBuilderProps {
  data: QueryRow[];
  question?: string;
}

export function ChartBuilder({ data, question }: ChartBuilderProps) {
  const [description, setDescription] = useState("Draw the most appropriate chart to visualize this data");
  const [generating, setGenerating] = useState(false);
  const [chartCode, setChartCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { llmSettings, addToast } = useDataStore();

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const system = `Write JS code to draw a ChartJS chart.
Write the code inside a \`\`\`js code fence.
\`Chart\` is already imported.
Data is ALREADY available as \`data\`, an array of objects. Do not create it. Just use it.
Render inside a <canvas id="chart"> like this:

\`\`\`js
return new Chart(
  document.getElementById("chart"),
  {
    type: "...",
    options: { responsive: true, maintainAspectRatio: false, ... },
    data: { ... },
  }
)
\`\`\``;

      const user = `Question: ${question ?? ""}
// First 3 rows of result
data = ${JSON.stringify(data.slice(0, 3))}
IMPORTANT: ${description}`;

      const result = await callLLM({ system, user, settings: llmSettings });
      const code = extractJSCode(result);
      if (!code) {
        throw new Error("No JS code found in response");
      }
      setChartCode(code);
    } catch (e) {
      setError(String(e));
      addToast({ variant: "error", title: "Chart generation failed", message: String(e) });
    } finally {
      setGenerating(false);
    }
  }, [data, question, description, llmSettings, addToast]);

  // Render chart when code changes
  useEffect(() => {
    if (!chartCode || !canvasRef.current) return;
    try {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      // eslint-disable-next-line no-new-func
      const drawChart = new Function("Chart", "data", chartCode);
      chartRef.current = drawChart(Chart, data);
    } catch (e) {
      setError(String(e));
    }
  }, [chartCode, data]);

  const downloadChart = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "datachat-chart.png";
    a.click();
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <BarChart2 size={14} className="text-blue-600" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex-1">Chart Builder</span>
        {chartCode && (
          <button
            onClick={downloadChart}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Download size={11} /> PNG
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder="Describe the chart…"
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : chartCode ? <RefreshCw size={13} /> : <Wand2 size={13} />}
            {generating ? "Generating…" : chartCode ? "Regenerate" : "Generate"}
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">{error}</div>
        )}

        <div id="chart-container" className={chartCode && !error ? "block" : "hidden"}>
          <div style={{ position: "relative", height: "200px" }}>
            <canvas ref={canvasRef} id="chart" />
          </div>
        </div>

        {!chartCode && !generating && (
          <div className="flex flex-col items-center justify-center py-6 text-gray-400 gap-2">
            <BarChart2 size={24} className="opacity-40" />
            <p className="text-xs">Click Generate to create a chart</p>
          </div>
        )}
      </div>
    </div>
  );
}
