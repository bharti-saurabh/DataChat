import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, LayoutDashboard, BarChart2 } from "lucide-react";
import { detectChartType, CHART_TYPES, type ChartType } from "./lib/detectChartType.js";
import { BarChart }    from "./charts/BarChart.js";
import { LineChart }   from "./charts/LineChart.js";
import { DonutChart }  from "./charts/DonutChart.js";
import { ScatterPlot } from "./charts/ScatterPlot.js";
import { StatCard }    from "./charts/StatCard.js";
import { useStore }    from "@/store/useStore.js";
import { generateId }  from "@/lib/utils.js";
import { C }           from "./lib/colors.js";

interface ChartPanelProps {
  rows: Record<string, unknown>[];
  question?: string;
}

const CHART_HEIGHT = 220;

export function ChartPanel({ rows, question }: ChartPanelProps) {
  const auto = useMemo(() => detectChartType(rows), [rows]);
  const [type, setType] = useState<ChartType>(auto);
  const [fullscreen, setFullscreen] = useState(false);
  const { addDashboardChart, addToast } = useStore();

  if (rows.length === 0 || type === "table") return null;

const handlePin = () => {
  addDashboardChart({
    id: generateId(),
    title: question ?? "Chart",
    chartCode: "",
    data: rows,
    question,
    chartType: type,
  });
  addToast?.({ variant: "success", title: "Pinned to dashboard" });
};

  const chart = (h: number) => {
    switch (type) {
      case "bar":     return <BarChart     rows={rows} height={h} />;
      case "line":    return <LineChart    rows={rows} height={h} />;
      case "donut":   return <DonutChart   rows={rows} height={h} />;
      case "scatter": return <ScatterPlot  rows={rows} height={h} />;
      case "stat":    return <StatCard     rows={rows} />;
      default:        return null;
    }
  };

  return (
    <>
      <div style={{
        borderRadius: "0.75rem",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid var(--color-border-soft)",
          background: "var(--color-surface-3)",
        }}>
          <BarChart2 size={13} style={{ color: C.accent, flexShrink: 0 }} />

          {/* Type selector */}
          <div style={{ display: "flex", gap: "0.125rem", flex: 1, flexWrap: "wrap" }}>
            {CHART_TYPES.filter((c) => c.type !== "table").map(({ type: t, label }) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: "0.125rem 0.5rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  transition: "background var(--duration-fast), color var(--duration-fast)",
                  background: type === t ? "var(--color-accent-pale)" : "transparent",
                  color: type === t ? "var(--color-accent)" : C.textMuted,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Auto label */}
          {auto === type && (
            <span style={{ fontSize: "0.65rem", color: C.textMuted, letterSpacing: "0.06em" }}>AUTO</span>
          )}

          {/* Pin to dashboard */}
          <button className="btn-icon" title="Pin to dashboard" onClick={handlePin} style={{ width: 26, height: 26 }}>
            <LayoutDashboard size={13} />
          </button>

          {/* Fullscreen */}
          <button className="btn-icon" title="Fullscreen" onClick={() => setFullscreen(true)} style={{ width: 26, height: 26 }}>
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Chart */}
        <div style={{ padding: "0.75rem" }}>
          {chart(CHART_HEIGHT)}
        </div>
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(5,8,15,0.92)",
              backdropFilter: "blur(16px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "2rem",
            }}
            onClick={() => setFullscreen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 900,
                borderRadius: "1rem",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                overflow: "hidden",
              }}
            >
              {/* Fullscreen toolbar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.625rem 1rem",
                borderBottom: "1px solid var(--color-border-soft)",
                background: "var(--color-surface-3)",
              }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                  {question ?? "Chart"}
                </span>
                <button className="btn-icon" onClick={() => setFullscreen(false)}>
                  <Minimize2 size={14} />
                </button>
              </div>
              <div style={{ padding: "1.5rem" }}>
                {chart(400)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
