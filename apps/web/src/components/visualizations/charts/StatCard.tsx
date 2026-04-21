import { useMemo } from "react";
import * as d3 from "d3";
import { analyseColumns } from "../lib/detectChartType.js";
import { C } from "../lib/colors.js";

interface Props {
  rows: Record<string, unknown>[];
}

export function StatCard({ rows }: Props) {
  const { label, value, numKey } = useMemo(() => {
    if (rows.length === 0) return { label: "", value: 0, numKey: "" };
    const cols   = analyseColumns(rows);
    const numCol = cols.find((c) => c.numeric) ?? cols[0];
    const catCol = cols.find((c) => !c.numeric);
    const val    = Number(rows[0][numCol?.key ?? ""]) || 0;
    return { label: catCol ? String(rows[0][catCol.key] ?? "") : numCol?.key ?? "", value: val, numKey: numCol?.key ?? "" };
  }, [rows]);

  const fmt = value > 1_000_000 ? d3.format(".3s") : value > 1_000 ? d3.format(",.0f") : d3.format(".4~g");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, gap: "0.5rem" }}>
      <p className="text-holo" style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {fmt(value)}
      </p>
      <p style={{ fontSize: "0.8rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {numKey}
      </p>
      {label && (
        <p style={{ fontSize: "0.75rem", color: C.textMuted, marginTop: "0.25rem" }}>{label}</p>
      )}
    </div>
  );
}
