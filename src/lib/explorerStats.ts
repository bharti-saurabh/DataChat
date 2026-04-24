import type { ColumnInfo, ColumnStats } from "@/types";
import { runQuery } from "@/lib/db";

export async function computeColumnStats(
  tableName: string,
  columns: ColumnInfo[],
): Promise<ColumnStats[]> {
  const results: ColumnStats[] = [];

  for (const col of columns) {
    const quoted = `"${col.name.replace(/"/g, '""')}"`;
    const tq = `"${tableName.replace(/"/g, '""')}"`;
    const isNumeric = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL|BIGINT|HUGEINT/i.test(col.type);

    try {
      const q = isNumeric
        ? `SELECT COUNT(*) as total,
                  COUNT(DISTINCT ${quoted}) as distinct_count,
                  SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count,
                  MIN(${quoted}) as min_val,
                  MAX(${quoted}) as max_val,
                  AVG(${quoted}) as avg_val,
                  STDDEV(${quoted}) as stddev_val
           FROM ${tq}`
        : `SELECT COUNT(*) as total,
                  COUNT(DISTINCT ${quoted}) as distinct_count,
                  SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count
           FROM ${tq}`;

      const rows = await runQuery(q);
      const r = rows[0] ?? {};
      const total = Number(r.total ?? 0);
      const distinct = Number(r.distinct_count ?? 0);
      const nullCount = Number(r.null_count ?? 0);

      // Fetch top values with counts for categorical and low-cardinality numeric columns
      let topValueCounts: { value: string; count: number }[] | undefined;
      const shouldFetchTop = !isNumeric || distinct <= 20;
      if (shouldFetchTop && total > 0) {
        try {
          const tvRows = await runQuery(
            `SELECT ${quoted} as val, COUNT(*) as cnt
             FROM ${tq}
             WHERE ${quoted} IS NOT NULL
             GROUP BY ${quoted}
             ORDER BY cnt DESC
             LIMIT 8`
          );
          topValueCounts = tvRows
            .filter((tv) => tv.val !== null && tv.val !== undefined)
            .map((tv) => ({ value: String(tv.val), count: Number(tv.cnt) }));
        } catch { /* ignore */ }
      }

      results.push({
        columnName: col.name,
        total,
        distinct,
        nullCount,
        min: isNumeric ? r.min_val : undefined,
        max: isNumeric ? r.max_val : undefined,
        avg: isNumeric && r.avg_val != null ? Number(r.avg_val) : undefined,
        stddev: isNumeric && r.stddev_val != null ? Number(r.stddev_val) : undefined,
        topValueCounts,
      });
    } catch {
      results.push({ columnName: col.name, total: 0, distinct: 0, nullCount: 0 });
    }
  }

  return results;
}
