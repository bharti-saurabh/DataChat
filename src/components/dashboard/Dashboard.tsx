import { useRef, useCallback } from "react";
import { X, FileDown, LayoutDashboard, Trash2 } from "lucide-react";
import { Chart, registerables } from "chart.js";
import { useDataStore } from "@/store/useDataStore";
import { InsightsCard } from "@/components/chat/InsightsCard";
import type { DashboardChart } from "@/types";

Chart.register(...registerables);

export function Dashboard() {
  const { dashboardOpen, toggleDashboard, dashboardCharts, removeDashboardChart, addToast } = useDataStore();

  if (!dashboardOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <LayoutDashboard size={18} className="text-blue-600" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1">Dashboard</h1>
        <span className="text-sm text-gray-400">{dashboardCharts.length} chart{dashboardCharts.length !== 1 ? "s" : ""}</span>
        {dashboardCharts.length > 0 && (
          <ExportPDFButton charts={dashboardCharts} onToast={addToast} />
        )}
        <button onClick={toggleDashboard} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1">
          <X size={20} />
        </button>
      </div>

      {/* Charts grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {dashboardCharts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <LayoutDashboard size={48} className="opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-500">Your dashboard is empty</p>
              <p className="text-sm mt-1">Click the <LayoutDashboard size={12} className="inline" /> icon on any chart to pin it here</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboardCharts.map((chart) => (
              <DashboardChartCard key={chart.id} chart={chart} onRemove={() => removeDashboardChart(chart.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardChartCard({ chart, onRemove }: { chart: DashboardChart; onRemove: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Render chart when canvas mounts
  const mountCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
    if (!canvas) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    try {
      const canvasId = `dashboard-${chart.id}`;
      canvas.id = canvasId;
      // eslint-disable-next-line no-new-func
      const draw = new Function("Chart", "data", chart.chartCode.replace(/getElementById\("chart"\)/g, `getElementById("${canvasId}")`));
      chartRef.current = draw(Chart, chart.data);
    } catch { /* silent */ }
  }, [chart]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 pr-4 leading-snug">{chart.title}</h3>
        <button onClick={onRemove} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4">
        <canvas ref={mountCanvas} />
        {chart.insights && (
          <div className="mt-3">
            <InsightsCard insights={chart.insights} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExportPDFButton({ charts, onToast }: { charts: DashboardChart[]; onToast: (t: { variant: "success" | "error" | "warning" | "info"; title: string; message?: string }) => void }) {
  const handleExport = useCallback(async () => {
    onToast({ variant: "info", title: "Generating PDF…" });
    try {
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;

      // Title page
      pdf.setFontSize(22);
      pdf.setTextColor(30, 64, 175);
      pdf.text("DataChat Dashboard Report", pageW / 2, 30, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated ${new Date().toLocaleString()}`, pageW / 2, 38, { align: "center" });

      for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        pdf.addPage();

        // Title
        pdf.setFontSize(13);
        pdf.setTextColor(30, 30, 30);
        const titleLines = pdf.splitTextToSize(chart.title, pageW - margin * 2);
        pdf.text(titleLines, margin, margin + 8);

        // Try to capture the canvas from the DOM
        const canvasEl = document.getElementById(`dashboard-${chart.id}`) as HTMLCanvasElement | null;
        if (canvasEl) {
          const imgData = canvasEl.toDataURL("image/png");
          const titleHeight = titleLines.length * 7 + margin + 4;
          const imgMaxH = pageH - titleHeight - margin * 2 - 20;
          const aspect = canvasEl.width / Math.max(canvasEl.height, 1);
          const imgW = pageW - margin * 2;
          const imgH = Math.min(imgMaxH, imgW / aspect);
          pdf.addImage(imgData, "PNG", margin, titleHeight, imgW, imgH);

          // Insights text
          if (chart.insights) {
            const insightY = titleHeight + imgH + 4;
            pdf.setFontSize(9);
            pdf.setTextColor(120, 80, 0);
            const insightLines = pdf.splitTextToSize(`Insights: ${chart.insights}`, pageW - margin * 2);
            if (insightY + insightLines.length * 5 < pageH) {
              pdf.text(insightLines, margin, insightY);
            }
          }
        }
      }

      pdf.save("datachat-dashboard.pdf");
      onToast({ variant: "success", title: "PDF exported" });
    } catch (e) {
      onToast({ variant: "error", title: "PDF export failed", message: String(e) });
    }
  }, [charts, onToast]);

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <FileDown size={14} /> Export PDF
    </button>
  );
}
