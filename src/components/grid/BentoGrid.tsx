import { useCallback, useEffect, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactGridLayout = require("react-grid-layout").default as React.ComponentType<Record<string, unknown>>;
import type { Layout, LayoutItem } from "react-grid-layout";
import React from "react";
import { motion } from "framer-motion";
import { useDataStore } from "@/store/useDataStore";
import { WidgetShell } from "@/components/grid/WidgetShell";
import { Sparkles, Database } from "lucide-react";

export function BentoGrid() {
  const { widgets, setWidgets, dbReady, isBuilding } = useDataStore();

  // Track container width so the grid fills the panel correctly on any resize
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setGridWidth(el.offsetWidth);
    const ro = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: LayoutItem[] = widgets.map((w) => ({
    i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h,
    minW: w.type === "kpi" ? 2 : 3, minH: w.type === "kpi" ? 2 : 3,
  }));

  const onLayoutChange = useCallback((newLayout: Layout) => {
    setWidgets(widgets.map((w) => {
      const l = (newLayout as LayoutItem[]).find((n) => n.i === w.id);
      if (!l) return w;
      return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
    }));
  }, [widgets, setWidgets]);

  if (!dbReady && !isBuilding) {
    return <EmptyState type="no-data" />;
  }

  if (dbReady && widgets.length === 0 && !isBuilding) {
    return <EmptyState type="no-widgets" />;
  }

  if (isBuilding && widgets.length === 0) {
    return <EmptyState type="building" />;
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 pt-2">
      <ReactGridLayout
        className="layout"
        layout={layout as Layout}
        cols={12}
        rowHeight={100}
        width={gridWidth}
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle"
        margin={[12, 12]}
        containerPadding={[0, 0]}
        compactType="vertical"
        isResizable
        isDraggable
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="drag-handle cursor-grab active:cursor-grabbing">
            <WidgetShell widget={widget} />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}

function EmptyState({ type }: { type: "no-data" | "no-widgets" | "building" }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))", border: "1px solid rgba(99,102,241,0.15)" }}
      >
        {type === "no-data"
          ? <Database size={32} style={{ color: "var(--indigo)" }} />
          : <Sparkles size={32} style={{ color: "var(--violet)" }} />}
      </motion.div>

      {type === "no-data" && (
        <>
          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-1)" }}>Connect your data</h2>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: "var(--text-3)" }}>
              Upload a CSV, Excel, JSON, Parquet, or SQLite file — or pick a sample dataset — then describe the dashboard you want.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["CSV", "Excel", "JSON", "Parquet", "SQLite"].map((f) => (
              <span key={f} className="text-[11px] px-2.5 py-1 rounded-full border font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>{f}</span>
            ))}
          </div>
        </>
      )}

      {type === "no-widgets" && (
        <div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-1)" }}>Data ready</h2>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: "var(--text-3)" }}>
            Describe the dashboard you want — the AI will generate KPIs, charts, tables, and insights instantly.
          </p>
        </div>
      )}

      {type === "building" && (
        <div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-1)" }}>Building your dashboard…</h2>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>Designing widgets and running queries</p>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--indigo)" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
