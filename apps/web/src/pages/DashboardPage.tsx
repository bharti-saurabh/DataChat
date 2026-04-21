import { useStore } from "@/store/useStore.js";
import { LayoutDashboard } from "lucide-react";

export function DashboardPage() {
  const charts = useStore((s) => s.dashboardCharts);

  if (charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <LayoutDashboard size={32} className="text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">
          No charts pinned yet. Ask a question in Chat and pin a chart here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto h-full">
      {charts.map((chart) => (
        <div key={chart.id} className="glass rounded-xl p-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{chart.title}</p>
          {/* Chart rendering will be wired up in the visualization step */}
          <div className="h-48 flex items-center justify-center text-[var(--color-text-muted)] text-xs border border-dashed border-[var(--color-border)] rounded-lg">
            Chart: {chart.title}
          </div>
        </div>
      ))}
    </div>
  );
}
