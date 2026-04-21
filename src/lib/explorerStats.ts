import type { ColumnInfo, ColumnStats } from "@/types";
import type { DB } from "@/lib/db";

export async function computeColumnStats(
  db: DB,
  tableName: string,
  columns: ColumnInfo[],
): Promise<ColumnStats[]> {
  return columns.map((col) => {
    const quoted = JSON.stringify(col.name);
    const isNumeric = /INT|REAL|FLOAT|NUMERIC|DOUBLE|DECIMAL/i.test(col.type);

    try {
      const q = isNumeric
        ? `SELECT COUNT(*) as total, COUNT(DISTINCT ${quoted}) as distinct_count, SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count, MIN(${quoted}) as min_val, MAX(${quoted}) as max_val, AVG(${quoted}) as avg_val FROM ${JSON.stringify(tableName)}`
        : `SELECT COUNT(*) as total, COUNT(DISTINCT ${quoted}) as distinct_count, SUM(CASE WHEN ${quoted} IS NULL THEN 1 ELSE 0 END) as null_count FROM ${JSON.stringify(tableName)}`;

      const rows = db.exec(q, { rowMode: "object" }) as Record<string, unknown>[];
      const r = rows[0] ?? {};
      return {
        columnName: col.name,
        total: Number(r.total ?? 0),
        distinct: Number(r.distinct_count ?? 0),
        nullCount: Number(r.null_count ?? 0),
        min: isNumeric ? r.min_val : undefined,
        max: isNumeric ? r.max_val : undefined,
        avg: isNumeric ? (r.avg_val != null ? Number(r.avg_val) : undefined) : undefined,
      };
    } catch {
      return { columnName: col.name, total: 0, distinct: 0, nullCount: 0 };
    }
  });
}
