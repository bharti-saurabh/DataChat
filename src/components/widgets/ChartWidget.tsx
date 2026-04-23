import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { Widget, QueryRow } from "@/types";

// Holographic iridescent palette
const HOLO_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(99,102,241,0.18)",
  borderRadius: 10,
  fontSize: 11,
  color: "#0d0d1a",
  boxShadow: "0 8px 24px rgba(99,102,241,0.12)",
  padding: "8px 12px",
};

const CURSOR_STYLE = { fill: "rgba(99,102,241,0.06)" };

const axisProps = {
  tick: { fill: "#9ca3af", fontSize: 10 },
  axisLine: { stroke: "rgba(99,102,241,0.1)" },
  tickLine: false as const,
};

const gridProps = {
  strokeDasharray: "3 3",
  stroke: "rgba(99,102,241,0.07)",
  vertical: false,
};

function numericKeys(data: QueryRow[]): string[] {
  if (!data.length) return [];
  return Object.keys(data[0]).filter((k) => typeof data[0][k] === "number" || !isNaN(Number(data[0][k])));
}

// Custom tooltip with formatted values
function HoloTooltip(props: TooltipProps<number, string>) {
  const { active } = props;
  const payload = (props as unknown as { payload?: { color?: string; name?: string; value?: unknown }[] }).payload;
  const label = (props as unknown as { label?: unknown }).label;
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {label !== undefined && <p style={{ fontWeight: 600, marginBottom: 4, color: "#4b5563", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{String(label)}</p>}
      {payload.map((entry: { color?: string; name?: string; value?: unknown }, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: "#0d0d1a", fontSize: 11 }}>
            {typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartWidget({ widget }: { widget: Widget }) {
  const data = widget.data ?? [];
  if (!data.length) return (
    <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--text-3)" }}>No data</div>
  );

  const keys = Object.keys(data[0]);
  const xKey = widget.xKey ?? keys[0];
  const rawYKey = widget.yKey;
  const yKeys = Array.isArray(rawYKey) ? rawYKey : rawYKey ? [rawYKey] : numericKeys(data).filter((k) => k !== xKey).slice(0, 4);

  const chartType = widget.chartType ?? "bar";
  const margin = { top: 8, right: 12, left: -8, bottom: 0 };

  const legendStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#9ca3af",
    paddingTop: 4,
  };

  if (chartType === "pie" || chartType === "donut") {
    const valueKey = yKeys[0] ?? keys[1];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {HOLO_COLORS.map((color, i) => (
              <radialGradient key={i} id={`pieGrad${i}`} cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.65} />
              </radialGradient>
            ))}
          </defs>
          <Pie
            data={data} dataKey={valueKey} nameKey={xKey}
            cx="50%" cy="50%"
            innerRadius={chartType === "donut" ? "52%" : 0}
            outerRadius="72%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={`url(#pieGrad${i % HOLO_COLORS.length})`}
                style={{ filter: `drop-shadow(0 2px 6px ${HOLO_COLORS[i % HOLO_COLORS.length]}55)` }} />
            ))}
          </Pie>
          <Tooltip content={<HoloTooltip />} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "scatter") {
    const xNumKey = yKeys[0] ?? keys[0];
    const yNumKey = yKeys[1] ?? keys[1];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={margin}>
          <defs>
            <radialGradient id="scatterGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
            </radialGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xNumKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<HoloTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(99,102,241,0.2)" }} />
          <Scatter data={data} dataKey={yNumKey} fill="url(#scatterGrad)"
            style={{ filter: "drop-shadow(0 0 4px rgba(99,102,241,0.4))" }} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const ChartComp = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComp data={data} margin={margin}>
        <defs>
          {yKeys.map((key, i) => {
            const color = HOLO_COLORS[i % HOLO_COLORS.length];
            return (
              <linearGradient key={key} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color} stopOpacity={0.08} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          tickFormatter={(v) => String(v).slice(0, 10)}
          interval="preserveStartEnd"
        />
        <YAxis {...axisProps} tickFormatter={(v) => typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <Tooltip content={<HoloTooltip />} cursor={CURSOR_STYLE} />
        {yKeys.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />}
        {yKeys.map((key, i) => {
          const color = HOLO_COLORS[i % HOLO_COLORS.length];
          if (chartType === "line") {
            return (
              <Line key={key} type="monotone" dataKey={key}
                stroke={color} strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2, style: { filter: `drop-shadow(0 0 6px ${color}88)` } }}
                style={{ filter: `drop-shadow(0 0 3px ${color}66)` }}
              />
            );
          }
          if (chartType === "area") {
            return (
              <Area key={key} type="monotone" dataKey={key}
                stroke={color} strokeWidth={2.5}
                fill={`url(#grad${i})`}
                activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }}
                style={{ filter: `drop-shadow(0 0 3px ${color}55)` }}
              />
            );
          }
          return (
            <Bar key={key} dataKey={key}
              fill={`url(#grad${i})`}
              stroke={color} strokeWidth={0}
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              style={{ filter: `drop-shadow(0 2px 6px ${color}44)` }}
            />
          );
        })}
      </ChartComp>
    </ResponsiveContainer>
  );
}
