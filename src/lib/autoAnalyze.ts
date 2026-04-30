import { computeColumnStats } from "@/lib/explorerStats";
import { dexieDB } from "@/lib/persistence";
import type { TableSchema, ColumnStats } from "@/types";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function schemaFingerprint(schemas: TableSchema[]): string {
  return schemas
    .map((s) => `${s.name}:${s.rowCount ?? 0}:${s.columns.map((c) => c.name).join(",")}`)
    .join("|");
}

async function readCache(key: string): Promise<Record<string, ColumnStats[]> | null> {
  try {
    const entry = await dexieDB.schemaCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await dexieDB.schemaCache.delete(key);
      return null;
    }
    return entry.columnStats;
  } catch {
    return null;
  }
}

async function writeCache(key: string, columnStats: Record<string, ColumnStats[]>): Promise<void> {
  try {
    await dexieDB.schemaCache.put({ key, columnStats, cachedAt: Date.now() });
  } catch { /* non-fatal */ }
}

export async function autoAnalyze(
  schemas: TableSchema[],
  onProgress: (updated: TableSchema[]) => void,
): Promise<TableSchema[]> {
  if (!schemas.length) return schemas;

  const fingerprint = schemaFingerprint(schemas);
  const cached = await readCache(fingerprint);

  if (cached) {
    const restored = schemas.map((s) =>
      cached[s.name] ? { ...s, columnStats: cached[s.name] } : s
    );
    onProgress(restored);
    return restored;
  }

  let current = [...schemas];
  const statsMap: Record<string, ColumnStats[]> = {};

  for (const schema of schemas) {
    if (schema.columnStats) {
      statsMap[schema.name] = schema.columnStats;
      continue;
    }
    try {
      const stats = await computeColumnStats(schema.name, schema.columns);
      statsMap[schema.name] = stats;
      current = current.map((s) => s.name === schema.name ? { ...s, columnStats: stats } : s);
      onProgress([...current]);
    } catch { /* skip failed table */ }
  }

  await writeCache(fingerprint, statsMap);
  return current;
}
