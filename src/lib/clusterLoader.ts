import { getDB, dropAllTables, getSchemas } from "@/lib/db";
import type { DataCluster, ClusterLoadProgress } from "@/types/cluster";
import type { TableSchema } from "@/types";

export async function loadCluster(
  cluster: DataCluster,
  onProgress: (p: ClusterLoadProgress) => void,
): Promise<TableSchema[]> {
  // Drop all existing tables first (replace semantics)
  await dropAllTables();

  const { db, conn } = await getDB();
  const base = import.meta.env.BASE_URL;

  for (let i = 0; i < cluster.tables.length; i++) {
    const table = cluster.tables[i];
    onProgress({ step: i + 1, total: cluster.tables.length, tableName: table.displayName });

    const url = `${base}${table.csvPath}`;
    // Fetch the CSV blob and register it so DuckDB WASM can read it
    const blob = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch ${table.csvPath}: ${r.status}`);
      return r.blob();
    });
    const fileName = `${table.id}.csv`;
    const file = new File([blob], fileName);

    await db.registerFileHandle(fileName, file, 2 /* BROWSER_FILEREADER */, true);
    await conn.query(
      `CREATE OR REPLACE TABLE "${table.id}" AS SELECT * FROM read_csv_auto('${fileName}', header=true)`
    );
  }

  return getSchemas();
}

/** Run referential integrity check for a single FK relationship. */
export async function checkRefIntegrity(
  fromTable: string,
  fromColumn: string,
  toTable: string,
  toColumn: string,
): Promise<{ matched: number; total: number; pct: number }> {
  const { conn } = await getDB();
  const res = await conn.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN f."${fromColumn}" IS NULL THEN 1 END) AS nulls,
      COUNT(CASE WHEN t."${toColumn}" IS NOT NULL THEN 1 END) AS matched
    FROM "${fromTable}" f
    LEFT JOIN "${toTable}" t ON f."${fromColumn}" = t."${toColumn}"
  `);
  const row = res.toArray()[0] as Record<string, unknown>;
  const total = Number(row.total) - Number(row.nulls); // exclude NULLs from denominator
  const matched = Number(row.matched);
  const pct = total > 0 ? Math.round((matched / total) * 100) : 100;
  return { matched, total, pct };
}

/** Get min/max of a date column for a table. */
export async function getDateRange(
  tableName: string,
  dateColumn: string,
): Promise<{ min: string; max: string } | null> {
  try {
    const { conn } = await getDB();
    const res = await conn.query(
      `SELECT MIN("${dateColumn}")::VARCHAR AS min_dt, MAX("${dateColumn}")::VARCHAR AS max_dt FROM "${tableName}"`
    );
    const row = res.toArray()[0] as Record<string, unknown>;
    if (!row.min_dt) return null;
    return { min: String(row.min_dt).slice(0, 10), max: String(row.max_dt).slice(0, 10) };
  } catch {
    return null;
  }
}
