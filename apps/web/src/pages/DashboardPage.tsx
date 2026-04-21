import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { LayoutItem, Layout, ResponsiveLayouts } from "react-grid-layout";
import { LayoutDashboard, X, Pencil, Check } from "lucide-react";
import { useStore } from "@/store/useStore.js";
import { BarChart }    from "@/components/visualizations/charts/BarChart.js";
import { LineChart }   from "@/components/visualizations/charts/LineChart.js";
import { DonutChart }  from "@/components/visualizations/charts/DonutChart.js";
import { ScatterPlot } from "@/components/visualizations/charts/ScatterPlot.js";
import { StatCard }    from "@/components/visualizations/charts/StatCard.js";
import { detectChartType } from "@/components/visualizations/lib/detectChartType.js";
import type { DashboardChart } from "@datachat/shared";

import "react-grid-layout/dist/styles.css";

const ROW_HEIGHT = 60;

function chartComponent(chart: DashboardChart, h: number) {
  const type = (chart.chartType as string | undefined) ?? detectChartType(chart.data);
  switch (type) {
    case "bar":     return <BarChart     rows={chart.data} height={h} />;
    case "line":    return <LineChart    rows={chart.data} height={h} />;
    case "donut":   return <DonutChart   rows={chart.data} height={h} />;
    case "scatter": return <ScatterPlot  rows={chart.data} height={h} />;
    case "stat":    return <StatCard     rows={chart.data} />;
    default:        return <BarChart     rows={chart.data} height={h} />;
  }
}

interface CardProps {
  chart: DashboardChart;
  cardH: number;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function DashboardCard({ chart, cardH, onRemove, onRename }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chart.title);

  const commit = () => {
    const t = draft.trim();
    if (t) onRename(chart.id, t);
    else setDraft(chart.title);
    setEditing(false);
  };

  const innerH = Math.max(80, cardH - 52);

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "var(--color-surface-2)",
      border: "1px solid var(--color-border)",
      borderRadius: "0.75rem",
      overflow: "hidden",
    }}>
      <div
        className="drag-handle"
        style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.5rem 0.625rem",
          borderBottom: "1px solid var(--color-border-soft)",
          background: "var(--color-surface-3)",
          flexShrink: 0, height: 40, cursor: "grab",
          userSelect: "none",
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(chart.title); setEditing(false); }
            }}
            onBlur={commit}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "0.78rem", fontWeight: 500,
              color: "var(--color-text-primary)", cursor: "text",
            }}
          />
        ) : (
          <span title={chart.title} style={{
            flex: 1, fontSize: "0.78rem", fontWeight: 500,
            color: "var(--color-text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {chart.title}
          </span>
        )}
        {editing ? (
          <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={commit} title="Save">
            <Check size={11} />
          </button>
        ) : (
          <button className="btn-icon" style={{ width: 22, height: 22 }}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Rename">
            <Pencil size={11} />
          </button>
        )}
        <button className="btn-icon"
          style={{ width: 22, height: 22, color: "var(--color-error)" }}
          onClick={(e) => { e.stopPropagation(); onRemove(chart.id); }} title="Remove">
          <X size={11} />
        </button>
      </div>
      <div style={{ flex: 1, padding: "0.5rem", overflow: "hidden" }}>
        {chart.data.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", fontSize: "0.75rem", color: "var(--color-text-muted)",
          }}>No data</div>
        ) : (
          chartComponent(chart, innerH)
        )}
      </div>
    </div>
  );
}

function ResponsiveDashboardGrid({ children, layouts, onLayoutChange }: {
  children: React.ReactNode;
  layouts: ResponsiveLayouts<string>;
  onLayoutChange: (layout: Layout, layouts: ResponsiveLayouts<string>) => void;
}) {
  const { width, containerRef } = useContainerWidth();
  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <ResponsiveGridLayout
        width={width}
        layouts={layouts}
        breakpoints={{ lg: 1100, md: 700, sm: 0 }}
        cols={{ lg: 12, md: 10, sm: 4 }}
        rowHeight={ROW_HEIGHT}
        onLayoutChange={onLayoutChange}
        dragConfig={{ handle: ".drag-handle" }}
        containerPadding={[0, 0]}
        margin={[12, 12]}
      >
        {children}
      </ResponsiveGridLayout>
    </div>
  );
}

export function DashboardPage() {
  const { dashboardCharts, removeDashboardChart, updateDashboardChart } = useStore();

  const layouts = useMemo<ResponsiveLayouts<string>>(() => ({
    lg: dashboardCharts.map((c, i) => ({
      i: c.id,
      x: c.gridPos?.x ?? (i % 2) * 6,
      y: c.gridPos?.y ?? Math.floor(i / 2) * 6,
      w: c.gridPos?.w ?? 6,
      h: c.gridPos?.h ?? 6,
      minW: 3, minH: 4,
    })),
    md: dashboardCharts.map((c, i) => ({
      i: c.id, x: (i % 2) * 5, y: Math.floor(i / 2) * 6, w: 5,
      h: c.gridPos?.h ?? 6, minW: 3, minH: 4,
    })),
    sm: dashboardCharts.map((c, i) => ({
      i: c.id, x: 0, y: i * 6, w: 4,
      h: c.gridPos?.h ?? 6, minW: 2, minH: 4,
    })),
  }), [dashboardCharts]);

  const onLayoutChange = useCallback(
    (_: Layout, allLayouts: ResponsiveLayouts<string>) => {
      const lg = allLayouts.lg;
      if (!lg) return;
      lg.forEach((item) => {
        updateDashboardChart(item.i, {
          gridPos: { x: item.x, y: item.y, w: item.w, h: item.h },
        });
      });
    },
    [updateDashboardChart],
  );

  if (dashboardCharts.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", gap: "0.875rem", textAlign: "center",
      }}>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, var(--color-accent-pale), var(--color-cyan-pale))",
            border: "1px solid var(--color-border-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px var(--color-accent-glow)",
          }}
        >
          <LayoutDashboard size={20} style={{ color: "var(--color-accent)" }} />
        </motion.div>
        <div>
          <p className="text-holo" style={{ fontSize: "1rem", fontWeight: 600 }}>No charts pinned</p>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            Ask a question in Chat and click the pin icon on any chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "0.75rem" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "0.75rem", paddingInline: "0.25rem",
      }}>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          {dashboardCharts.length} chart{dashboardCharts.length !== 1 ? "s" : ""} — drag header to move, resize from corner
        </span>
      </div>
      <ResponsiveDashboardGrid layouts={layouts} onLayoutChange={onLayoutChange}>
        {dashboardCharts.map((chart) => {
          const lay = layouts.lg?.find((l) => l.i === chart.id);
          const cardH = (lay?.h ?? 6) * ROW_HEIGHT + ((lay?.h ?? 6) - 1) * 12;
          return (
            <div key={chart.id}>
              <DashboardCard
                chart={chart}
                cardH={cardH}
                onRemove={removeDashboardChart}
                onRename={(id, title) => updateDashboardChart(id, { title })}
              />
            </div>
          );
        })}
      </ResponsiveDashboardGrid>
    </div>
  );
}
