import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { analyseColumns } from "../lib/detectChartType.js";
import { paletteColor, C } from "../lib/colors.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  rows: Record<string, unknown>[];
  height?: number;
}

export function DonutChart({ rows, height = 220 }: Props) {
  const svgRef  = useRef<SVGGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string; pct: string } | null>(null);

  const { catKey, numKey, data, total } = useMemo(() => {
    const cols   = analyseColumns(rows);
    const catCol = cols.find((c) => !c.numeric) ?? cols[0];
    const numCol = cols.find((c) => c.numeric)  ?? cols[1];
    if (!catCol || !numCol) return { catKey: "", numKey: "", data: [], total: 0 };

    const slices = rows
      .filter((r) => (Number(r[numCol.key]) || 0) > 0)
      .sort((a, b) => (Number(b[numCol.key]) || 0) - (Number(a[numCol.key]) || 0))
      .slice(0, 10);

    const total = d3.sum(slices, (d) => Number(d[numCol.key]) || 0);
    return { catKey: catCol.key, numKey: numCol.key, data: slices, total };
  }, [rows]);

  const size   = Math.min(height, 200);
  const cx     = size / 2;
  const cy     = size / 2;
  const outerR = size * 0.42;
  const innerR = outerR * 0.54;

  const pie = useMemo(() =>
    d3.pie<Record<string, unknown>>()
      .value((d) => Number(d[numKey]) || 0)
      .sort(null),
    [numKey],
  );

  const arc = useMemo(() =>
    d3.arc<d3.PieArcDatum<Record<string, unknown>>>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .padAngle(0.025)
      .cornerRadius(3),
    [innerR, outerR],
  );

  const arcHover = useMemo(() =>
    d3.arc<d3.PieArcDatum<Record<string, unknown>>>()
      .innerRadius(innerR)
      .outerRadius(outerR + 6)
      .padAngle(0.025)
      .cornerRadius(3),
    [innerR, outerR],
  );

  const arcs = useMemo(() => pie(data), [pie, data]);

  // Animate arcs sweeping in
  useEffect(() => {
    if (!svgRef.current || arcs.length === 0) return;
    const g = d3.select(svgRef.current);

    g.selectAll<SVGPathElement, d3.PieArcDatum<Record<string, unknown>>>("path.arc")
      .data(arcs)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const i = d3.interpolate({ startAngle: d.endAngle, endAngle: d.endAngle }, d);
        return (t) => arc(i(t)) ?? "";
      });
  }, [arcs, arc]);

  const fmt = d3.format(",.2~f");

  if (!catKey || !numKey || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: "0.8rem" }}>No data</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", height }}>
      {/* Donut */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size}>
          <defs>
            <filter id="donut-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g ref={svgRef} transform={`translate(${cx},${cy})`}>
            {arcs.map((d, i) => (
              <path
                key={i}
                className="arc"
                d={arc(d) ?? ""}
                fill={paletteColor(i)}
                fillOpacity={0.85}
                filter="url(#donut-glow)"
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => {
                  const [px, py] = arc.centroid(d);
                  (e.currentTarget as SVGPathElement).setAttribute("d", arcHover(d) ?? "");
                  const val = Number(d.data[numKey]) || 0;
                  setTooltip({
                    x: px + cx,
                    y: py + cy,
                    label: String(d.data[catKey] ?? ""),
                    value: fmt(val),
                    pct: `${((val / total) * 100).toFixed(1)}%`,
                  });
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as SVGPathElement).setAttribute("d", arc(d) ?? "");
                  setTooltip(null);
                }}
              />
            ))}
          </g>

          {/* Center label */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-text-primary)" fontSize={15} fontWeight={600} fontFamily="var(--font-sans)">
            {d3.format(".2~s")(total)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={C.textMuted} fontSize={9} fontFamily="var(--font-sans)">
            {numKey}
          </text>
        </svg>

        {tooltip && (
          <Tooltip x={tooltip.x} y={tooltip.y}>
            <strong style={{ color: "var(--color-text-primary)" }}>{tooltip.label}</strong>
            <span style={{ color: C.textMuted, fontSize: "0.7rem" }}>{tooltip.value} · {tooltip.pct}</span>
          </Tooltip>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", overflow: "hidden" }}>
        {arcs.slice(0, 8).map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: paletteColor(i), flexShrink: 0 }} />
            <span style={{ color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
              {String(d.data[catKey] ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
