import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { analyseColumns } from "../lib/detectChartType.js";
import { C } from "../lib/colors.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  rows: Record<string, unknown>[];
  height?: number;
}

const MARGIN = { top: 16, right: 24, bottom: 44, left: 56 };

export function ScatterPlot({ rows, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]   = useState(480);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { xKey, yKey, labelKey, data } = useMemo(() => {
    const cols    = analyseColumns(rows);
    const numCols = cols.filter((c) => c.numeric);
    const catCol  = cols.find((c) => !c.numeric);
    if (numCols.length < 2) return { xKey: "", yKey: "", labelKey: "", data: [] };
    return { xKey: numCols[0].key, yKey: numCols[1].key, labelKey: catCol?.key ?? "", data: rows };
  }, [rows]);

  const innerW = width  - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top  - MARGIN.bottom;

  const xScale = useMemo(() =>
    d3.scaleLinear()
      .domain(d3.extent(data, (d) => Number(d[xKey]) || 0) as [number, number])
      .range([0, innerW]).nice(),
    [data, xKey, innerW],
  );
  const yScale = useMemo(() =>
    d3.scaleLinear()
      .domain(d3.extent(data, (d) => Number(d[yKey]) || 0) as [number, number])
      .range([innerH, 0]).nice(),
    [data, yKey, innerH],
  );

  const xTicks = xScale.ticks(5);
  const yTicks = yScale.ticks(5);
  const fmt = d3.format(",.2~f");

  if (!xKey || !yKey || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: "0.8rem" }}>No data</div>;
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id="dot-grad">
            <stop offset="0%"   stopColor="#22d3ee" stopOpacity={1}   />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
          </radialGradient>
          <filter id="dot-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grids */}
          {yTicks.map((t) => (
            <line key={t} x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)}
              stroke={C.border} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {xTicks.map((t) => (
            <line key={t} x1={xScale(t)} x2={xScale(t)} y1={0} y2={innerH}
              stroke={C.border} strokeWidth={1} strokeDasharray="3 4" />
          ))}

          {/* Y labels */}
          {yTicks.map((t) => (
            <text key={t} x={-8} y={yScale(t)} dy="0.35em" textAnchor="end"
              fill={C.textMuted} fontSize={10} fontFamily="var(--font-mono)">{fmt(t)}</text>
          ))}

          {/* X labels */}
          {xTicks.map((t) => (
            <text key={t} x={xScale(t)} y={innerH + 14} textAnchor="middle"
              fill={C.textMuted} fontSize={10} fontFamily="var(--font-mono)">{fmt(t)}</text>
          ))}

          {/* Dots */}
          {data.map((d, i) => {
            const cx = xScale(Number(d[xKey]) || 0);
            const cy = yScale(Number(d[yKey]) || 0);
            const lbl = labelKey ? `${d[labelKey]} · ` : "";
            return (
              <circle key={i} cx={cx} cy={cy} r={5}
                fill="url(#dot-grad)" fillOpacity={0.8}
                filter="url(#dot-glow)"
                style={{ cursor: "pointer", transition: "r 0.1s" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as SVGCircleElement).setAttribute("r", "7");
                  setTooltip({ x: cx + MARGIN.left, y: cy + MARGIN.top, label: `${lbl}(${fmt(Number(d[xKey]) || 0)}, ${fmt(Number(d[yKey]) || 0)})` });
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as SVGCircleElement).setAttribute("r", "5");
                  setTooltip(null);
                }}
              />
            );
          })}

          {/* Axis lines */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={C.border} strokeWidth={1} />
          <line x1={0} x2={0}      y1={0}      y2={innerH} stroke={C.border} strokeWidth={1} />
        </g>
      </svg>

      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y}>
          <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{tooltip.label}</span>
        </Tooltip>
      )}
    </div>
  );
}
