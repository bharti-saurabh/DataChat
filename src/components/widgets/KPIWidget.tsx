import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Widget } from "@/types";

function formatKPI(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (isNaN(n)) return String(value);
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function KPIWidget({ widget }: { widget: Widget }) {
  const row = widget.data?.[0] as Record<string, unknown> | undefined;
  const value = row ? (row["value"] ?? Object.values(row).find((v) => v !== null && v !== undefined)) : null;
  const label = row?.["label"] as string | undefined;
  const unit = row?.["unit"] as string | undefined;
  const delta = row?.["delta"] as number | undefined;

  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;
  const isNeutral = delta !== undefined && delta === 0;

  return (
    <div className="h-full flex flex-col justify-between p-1">
      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: "var(--text-3)" }}>
        {label ?? widget.title}
      </p>

      {/* Value */}
      <div className="flex items-end gap-1.5 flex-wrap">
        <motion.span
          key={String(value)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="font-bold leading-none tabular-nums"
          style={{
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {formatKPI(value)}
        </motion.span>
        {unit && (
          <span className="text-sm mb-0.5 font-medium" style={{ color: "var(--text-3)" }}>{unit}</span>
        )}
      </div>

      {/* Delta badge */}
      {delta !== undefined && (
        <div
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
          style={{
            background: isPositive
              ? "rgba(16,185,129,0.10)"
              : isNegative
              ? "rgba(239,68,68,0.10)"
              : "rgba(156,163,175,0.12)",
            color: isPositive ? "#059669" : isNegative ? "#dc2626" : "#6b7280",
          }}
        >
          {isPositive ? <TrendingUp size={11} /> : isNegative ? <TrendingDown size={11} /> : isNeutral ? <Minus size={11} /> : null}
          {delta > 0 ? "+" : ""}{Number(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
