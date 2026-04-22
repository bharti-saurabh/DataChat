import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ChartConfig, QueryRow } from "@/types";

const HOLO = ["#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

const axisProps = {
  tick: { fill: "#9ca3af", fontSize: 10 },
  axisLine: { stroke: "rgba(156,163,175,0.2)" },
  tickLine: false as const,
};

const gridProps = { strokeDasharray: "3 3", stroke: "rgba(156,163,175,0.12)", vertical: false };

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 10,
  fontSize: 11,
  color: "#111827",
  boxShadow: "0 8px 24px rgba(99,102,241,0.12)",
  padding: "8px 12px",
};

function HoloTooltip(props: TooltipProps<number, string>) {
  const { active } = props;
  const payload = (props as unknown as { payload?: { color?: string; name?: string; value?: unknown }[] }).payload;
  const label = (props as unknown as { label?: unknown }).label;
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {label !== undefined && (
        <p style={{ fontWeight: 600, color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          {String(label)}
        </p>
      )}
      {payload.map((entry: { color?: string; name?: string; value?: unknown }, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
          <span style={{ color: "#9ca3af", fontSize: 10 }}>{entry.name}:</span>
          <span style={{ fontWeight: 600, color: "#111827", fontSize: 11 }}>
            {typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "")}
          </span>
        </div>
      ))}
    </div>
  );
}

interface RechartsDisplayProps {
  config: ChartConfig;
  data: QueryRow[];
  compact?: boolean;
}

export function RechartsDisplay({ config, data, compact }: RechartsDisplayProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-full text-sm text-gray-400">No data</div>;
  }

  const { chartType, xKey, yKey } = config;
  const yKeys: string[] = Array.isArray(yKey) ? yKey : [yKey];
  const margin = { top: 8, right: 16, left: -8, bottom: compact ? 0 : 4 };
  const legendStyle: React.CSSProperties = { fontSize: 10, color: "#9ca3af", paddingTop: 4 };

  if (chartType === "pie" || chartType === "donut") {
    const valueKey = yKeys[0];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {HOLO.map((c, i) => (
              <radialGradient key={i} id={`pg${i}`} cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                <stop offset="100%" stopColor={c} stopOpacity={0.6} />
              </radialGradient>
            ))}
          </defs>
          <Pie data={data} dataKey={valueKey} nameKey={xKey}
            cx="50%" cy="50%"
            innerRadius={chartType === "donut" ? "50%" : 0}
            outerRadius="70%" paddingAngle={3} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={`url(#pg${i % HOLO.length})`}
                style={{ filter: `drop-shadow(0 2px 6px ${HOLO[i % HOLO.length]}66)` }} />
            ))}
          </Pie>
          <Tooltip content={<HoloTooltip />} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "scatter") {
    const xNum = yKeys[0] ?? xKey;
    const yNum = yKeys[1] ?? yKeys[0];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={margin}>
          <defs>
            <radialGradient id="sg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
            </radialGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xNum} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<HoloTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(99,102,241,0.2)" }} />
          <Scatter data={data} dataKey={yNum} fill="url(#sg)"
            style={{ filter: "drop-shadow(0 0 4px rgba(99,102,241,0.5))" }} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const ChartComp = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComp data={data} margin={margin}>
        <defs>
          {yKeys.map((_, i) => {
            const c = HOLO[i % HOLO.length];
            return (
              <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.88} />
                <stop offset="100%" stopColor={c} stopOpacity={0.06} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} {...axisProps}
          tickFormatter={(v) => String(v).slice(0, compact ? 6 : 12)}
          interval="preserveStartEnd" />
        <YAxis {...axisProps}
          tickFormatter={(v) => typeof v === "number" && v >= 1000
            ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <Tooltip content={<HoloTooltip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
        {yKeys.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={legendStyle} />}
        {yKeys.map((key, i) => {
          const color = HOLO[i % HOLO.length];
          if (chartType === "line") {
            return (
              <Line key={key} type="monotone" dataKey={key}
                stroke={color} strokeWidth={2.5} dot={false}
                activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }}
                style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
            );
          }
          if (chartType === "area") {
            return (
              <Area key={key} type="monotone" dataKey={key}
                stroke={color} strokeWidth={2.5} fill={`url(#g${i})`}
                activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2 }} />
            );
          }
          return (
            <Bar key={key} dataKey={key}
              fill={`url(#g${i})`} stroke={color} strokeWidth={0}
              radius={[4, 4, 0, 0]} maxBarSize={60}
              style={{ filter: `drop-shadow(0 2px 6px ${color}44)` }} />
          );
        })}
      </ChartComp>
    </ResponsiveContainer>
  );
}
