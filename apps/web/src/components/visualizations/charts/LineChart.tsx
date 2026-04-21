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

export function LineChart({ rows, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [width, setWidth] = useState(480);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { xKey, yKey, data, xIsDate } = useMemo(() => {
    const cols = analyseColumns(rows);
    const dateCol = cols.find((c) => c.dateLike);
    const catCol  = cols.find((c) => !c.numeric && !c.dateLike);
    const numCol  = cols.find((c) => c.numeric);
    const xCol    = dateCol ?? catCol ?? cols[0];
    if (!xCol || !numCol) return { xKey: "", yKey: "", data: [], xIsDate: false };

    const sorted = dateCol
      ? [...rows].sort((a, b) => new Date(String(a[xCol.key])).getTime() - new Date(String(b[xCol.key])).getTime())
      : rows;

    return { xKey: xCol.key, yKey: numCol.key, data: sorted, xIsDate: !!dateCol };
  }, [rows]);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(() => {
    if (xIsDate) {
      const extent = d3.extent(data, (d) => new Date(String(d[xKey]))) as [Date, Date];
      return d3.scaleTime().domain(extent).range([0, innerW]);
    }
    return d3.scalePoint<string>()
      .domain(data.map((d) => String(d[xKey] ?? "")))
      .range([0, innerW])
      .padding(0.1);
  }, [data, xKey, xIsDate, innerW]);

  const yMax = useMemo(() => d3.max(data, (d) => Number(d[yKey]) || 0) ?? 0, [data, yKey]);
  const yScale = useMemo(() =>
    d3.scaleLinear().domain([0, yMax * 1.08]).range([innerH, 0]).nice(),
    [yMax, innerH],
  );

  const lineGen = useMemo(() =>
    d3.line<Record<string, unknown>>()
      .x((d) => xIsDate
        ? (xScale as d3.ScaleTime<number, number>)(new Date(String(d[xKey])))
        : ((xScale as d3.ScalePoint<string>)(String(d[xKey] ?? "")) ?? 0))
      .y((d) => yScale(Number(d[yKey]) || 0))
      .curve(d3.curveCatmullRom.alpha(0.5)),
    [xScale, yScale, xKey, yKey, xIsDate],
  );

  const pathD = useMemo(() => lineGen(data) ?? "", [lineGen, data]);

  const areaGen = useMemo(() =>
    d3.area<Record<string, unknown>>()
      .x((d) => xIsDate
        ? (xScale as d3.ScaleTime<number, number>)(new Date(String(d[xKey])))
        : ((xScale as d3.ScalePoint<string>)(String(d[xKey] ?? "")) ?? 0))
      .y0(innerH)
      .y1((d) => yScale(Number(d[yKey]) || 0))
      .curve(d3.curveCatmullRom.alpha(0.5)),
    [xScale, yScale, xKey, yKey, xIsDate, innerH],
  );
  const areaD = useMemo(() => areaGen(data) ?? "", [areaGen, data]);

  // Animate path draw
  useEffect(() => {
    if (!pathRef.current || !pathD) return;
    const len = pathRef.current.getTotalLength();
    d3.select(pathRef.current)
      .attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition()
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  }, [pathD]);

  const yTicks = yScale.ticks(5);
  const fmt = d3.format(yMax > 1_000_000 ? ".2s" : yMax > 1_000 ? ",.0f" : ".2~f");

  const xTickCount = Math.min(data.length, Math.floor(innerW / 70));
  const xTickIndices = data.length <= xTickCount
    ? data.map((_, i) => i)
    : Array.from({ length: xTickCount }, (_, i) => Math.round((i / (xTickCount - 1)) * (data.length - 1)));

  if (!xKey || !yKey || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: "0.8rem" }}>No data</div>;
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="line-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}    />
          </linearGradient>
          <filter id="line-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Y grid */}
          {yTicks.map((t) => (
            <line key={t} x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)}
              stroke={C.border} strokeWidth={1} strokeDasharray="3 4" />
          ))}

          {/* Y labels */}
          {yTicks.map((t) => (
            <text key={t} x={-8} y={yScale(t)} dy="0.35em" textAnchor="end"
              fill={C.textMuted} fontSize={10} fontFamily="var(--font-mono)">
              {fmt(t)}
            </text>
          ))}

          {/* Area fill */}
          <path d={areaD} fill="url(#line-area-grad)" />

          {/* Line */}
          <path ref={pathRef} d={pathD} fill="none"
            stroke="#3b82f6" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            filter="url(#line-glow)" />

          {/* Dots */}
          {data.map((d, i) => {
            const cx = xIsDate
              ? (xScale as d3.ScaleTime<number, number>)(new Date(String(d[xKey])))
              : ((xScale as d3.ScalePoint<string>)(String(d[xKey] ?? "")) ?? 0);
            const cy = yScale(Number(d[yKey]) || 0);
            const label = String(d[xKey] ?? "");
            const val   = Number(d[yKey]) || 0;
            return (
              <circle key={i} cx={cx} cy={cy} r={3.5}
                fill="#22d3ee" stroke={C.surface2} strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setTooltip({ x: cx + MARGIN.left, y: cy + MARGIN.top, label, value: fmt(val) })}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* X axis labels */}
          {xTickIndices.map((i) => {
            const d = data[i];
            const raw = String(d[xKey] ?? "");
            const label = xIsDate ? raw.slice(0, 10) : (raw.length > 10 ? raw.slice(0, 9) + "…" : raw);
            const cx = xIsDate
              ? (xScale as d3.ScaleTime<number, number>)(new Date(String(d[xKey])))
              : ((xScale as d3.ScalePoint<string>)(String(d[xKey] ?? "")) ?? 0);
            return (
              <text key={i} x={cx} y={innerH + 14} textAnchor="middle"
                fill={C.textMuted} fontSize={10} fontFamily="var(--font-sans)">
                {label}
              </text>
            );
          })}

          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke={C.border} strokeWidth={1} />
        </g>
      </svg>

      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y}>
          <strong style={{ color: "#3b82f6" }}>{tooltip.value}</strong>
          <span style={{ color: C.textMuted, fontSize: "0.7rem" }}>{tooltip.label}</span>
        </Tooltip>
      )}
    </div>
  );
}
