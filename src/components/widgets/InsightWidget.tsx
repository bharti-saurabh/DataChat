import { Lightbulb } from "lucide-react";
import type { Widget } from "@/types";

export function InsightWidget({ widget }: { widget: Widget }) {
  return (
    <div className="h-full flex gap-3 p-1">
      <div
        className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(236,72,153,0.10))", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        <Lightbulb size={14} style={{ color: "#d97706" }} />
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <p
          className="font-semibold uppercase tracking-widest mb-1.5"
          style={{ fontSize: 9, color: "#d97706", letterSpacing: "0.1em" }}
        >
          Insight
        </p>
        <p
          className="leading-relaxed"
          style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65 }}
        >
          {widget.insight ?? "No insight generated."}
        </p>
      </div>
    </div>
  );
}
