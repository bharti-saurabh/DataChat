import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { analyseColumns } from "../lib/detectChartType.js";
import { paletteColor, C } from "../lib/colors.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  rows: Record<string, unknown>[];
  height?: number;
}

const MARGIN = { top: 12, right: 16, bottom: 48, left: 56 };
const MAX_BARS = 20;

export function BarChart({ rows, height = 220 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { catKey, numKey, data } = useMemo(() => {
    const cols = analyseColumns(rows);
    const catCol = cols.find((c) => !c.numeric) ?? cols[0];
    const numCol = cols.find((c) => c.numeric) ?? cols[1];
    if (!catCol || !numCol) return { catKey: "", numKey: "", data: [] };

    const sorted = [...rows]
      .sort((a, b) => (Number(b[numCol.key]) || 0) - (Number(a[numCol.key]) || 0))
      .slice(0, MAX_BARS);

    return { catKey: catCol.key, numKey: numCol.key, data: sorted };
  }, [rows]);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(() =>
    d3.scaleBand()
      .domain(data.map((d) => String(d[catKey] ?? "")))
      .range([0, innerW])
      .padding(0.28),
    [data, catKey, innerW],
  );

  const yMax = useMemo(() => d3.max(data, (d) => Number(d[numKey]) || 0) ?? 0, [data, numKey]);
  const yScale = useMemo(() =>
    d3.scaleLinear().domain([0, yMax * 1.08]).range([innerH, 0]).nice(),
    [yMax, innerH],
  );

  const yTicks = yScale.ticks(5);
  const gradId = "bar-grad";

  // Animate bars on mount / data change
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGRectElement, Record<string, unknown>>(".bar")
      .data(data)
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => yScale(Number(d[numKey]) || 0) + MARGIN.top)
      .attr("height", (d) => innerH - yScale(Number(d[numKey]) || 0));
  }, [data, numKey, yScale, innerH]);

  if (!catKey || !numKey || data.length === 0) return <Empty />;

  const fmt = d3.format(yMax > 1_000_000 ? ".2s" : yMax > 1_000 ? ",.0f" : ".2~f");

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height }}>
      <svg ref={svgRef} width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22d3ee" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
          </linearGradient>
          {/* Glow filter */}
          <filter id="bar-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Y grid lines */}
          {yTicks.map((t) => (
            <line key={t} x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)}
              stroke={C.border} strokeWidth={1} strokeDasharray="3 4" />
          ))}

          {/* Y axis ticks */}
          {yTicks.map((t) => (
            <text key={t} x={-8} y={yScale(t)} dy="0.35em" textAnchor="end"
              fill={C.textMuted} fontSize={10} fontFamily="var(--font-mono)">
              {fmt(t)}
            </text>
          ))}

          {/* Bars — start at 0 height, animated to full height via useEffect */}
          {data.map((d, i) => {
            const label = String(d[catKey] ?? "");
            const val   = Number(d[numKey]) || 0;
            const bx    = xScale(label) ?? 0;
            const bw    = xScale.bandwidth();

            return (
              <rect
                key={label + i}
                className="bar"
                x={bx}
                y={innerH}             // start at bottom; animated to correct y
                width={bw}
                height={0}             // start at 0; animated to correct height
                rx={3}
                fill={`url(#${gradId})`}
                filter="url(#bar-glow)"
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => {
                  setTooltip({ x: bx + bw / 2 + MARGIN.left, y: yScale(val) + MARGIN.top, label, value: fmt(val) });
                  (e.currentTarget as SVGRectElement).style.opacity = "0.75";
                }}
                onMouseLeave={(e) => {
                  setTooltip(null);
                  (e.currentTarget as SVGRectElement).style.opacity = "1";
                }}
              />
            );
          })}

          {/* X axis labels */}
          {data.map((d, i) => {
            const label = String(d[catKey] ?? "");
            const bx    = (xScale(label) ?? 0) + xScale.bandwidth() / 2;
            const truncated = label.length > 10 ? label.slice(0, 9) + "…" : label;
            return (
              <text key={label + i} x={bx} y={innerH + 14} textAnchor="middle"
                fill={C.textMuted} fontSize={10} fontFamily="var(--font-sans)">
                {truncated}
              </text>
            );
          })}

          {/* X axis line */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={C.border} strokeWidth={1} />
        </g>
      </svg>

      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y - 8}>
          <strong style={{ color: C.cyan }}>{tooltip.value}</strong>
          <span style={{ color: C.textMuted, fontSize: "0.7rem" }}>{tooltip.label}</span>
        </Tooltip>
      )}
    </div>
  );
}

function Empty() {
  return <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: "0.8rem" }}>No data</div>;
}
