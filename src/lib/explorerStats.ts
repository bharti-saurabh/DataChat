import type { ColumnInfo, ColumnStats } from "@/types";
import type { DB } from "@/lib/db";

export async function computeColumnStats(
  db: DB,
  tableName: string,
  columns: ColumnInfo[],
): Promise<ColumnStats[]> {
  return columns.map((col) => {
    const quoted = JSON.stringify(col.name);
    const tq = JSON.stringify(tableName);
    const isNumeric = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL/i.test(col.type);

    try {
      // ── Aggregate stats ──────────────────────────────────────────────────
      const q = isNumeric
        ? `SELECT COUNT(*) as total, COUNT(DISTINCT ${quoted}) as distinct_count,
              SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count,
              MIN(${quoted}) as min_val, MAX(${quoted}) as max_val, AVG(${quoted}) as avg_val
           FROM ${tq}`
        : `SELECT COUNT(*) as total, COUNT(DISTINCT ${quoted}) as distinct_count,
              SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count
           FROM ${tq}`;

      const rows = db.exec(q, { rowMode: "object" }) as Record<string, unknown>[];
      const r = rows[0] ?? {};
      const total = Number(r.total ?? 0);
      const distinct = Number(r.distinct_count ?? 0);
      const nullCount = Number(r.null_count ?? 0);

      // ── Top frequent values (skip for high-cardinality numeric columns) ──
      let topValues: string[] | undefined;
      // Only fetch top values for low-ish cardinality or text columns
      const shouldFetchTop = !isNumeric || distinct <= 20;
      if (shouldFetchTop && total > 0) {
        try {
          const tvRows = db.exec(
            `SELECT ${quoted} as val, COUNT(*) as cnt
             FROM ${tq}
             WHERE ${quoted} IS NOT NULL
             GROUP BY ${quoted}
             ORDER BY cnt DESC
             LIMIT 5`,
            { rowMode: "object" },
          ) as Record<string, unknown>[];
          topValues = tvRows.map((tv) => String(tv.val ?? "")).filter(Boolean);
        } catch { /* ignore */ }
      }

      return {
        columnName: col.name,
        total,
        distinct,
        nullCount,
        min: isNumeric ? r.min_val : undefined,
        max: isNumeric ? r.max_val : undefined,
        avg: isNumeric ? (r.avg_val != null ? Number(r.avg_val) : undefined) : undefined,
        topValues,
      };
    } catch {
      return { columnName: col.name, total: 0, distinct: 0, nullCount: 0 };
    }
  });
}
