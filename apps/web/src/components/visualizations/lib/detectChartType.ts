export type ChartType = "bar" | "line" | "donut" | "scatter" | "stat" | "table";

const DATE_KEYS = /\b(date|time|month|year|day|week|quarter|period|at|created|updated)\b/i;
const GEO_LAT  = /\b(lat|latitude)\b/i;
const GEO_LON  = /\b(lon|lng|longitude)\b/i;

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

function isDateLike(key: string, sample: unknown): boolean {
  if (DATE_KEYS.test(key)) return true;
  if (typeof sample === "string") {
    return !isNaN(Date.parse(sample)) && /[-/T:]/.test(sample as string);
  }
  return false;
}

export interface ColumnInfo {
  key: string;
  numeric: boolean;
  dateLike: boolean;
}

export function analyseColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const first = rows[0];
  return Object.keys(first).map((key) => ({
    key,
    numeric: isNumeric(first[key]) || rows.slice(0, 5).every((r) => isNumeric(r[key]) || r[key] === null),
    dateLike: isDateLike(key, first[key]),
  }));
}

export function detectChartType(rows: Record<string, unknown>[]): ChartType {
  if (rows.length === 0) return "table";

  const cols   = analyseColumns(rows);
  const nums   = cols.filter((c) => c.numeric);
  const dates  = cols.filter((c) => c.dateLike);
  const cats   = cols.filter((c) => !c.numeric && !c.dateLike);
  const hasGeo = cols.some((c) => GEO_LAT.test(c.key)) && cols.some((c) => GEO_LON.test(c.key));

  // Single number → stat card
  if (rows.length === 1 && nums.length === 1 && cols.length <= 2) return "stat";

  // Geo data → future deck.gl map (fall back to table for now)
  if (hasGeo) return "scatter";

  // Time series
  if (dates.length >= 1 && nums.length >= 1) return "line";

  // Two numerics + many rows → scatter
  if (nums.length >= 2 && rows.length > 10 && cats.length === 0) return "scatter";

  // Categorical + one numeric, few categories → donut
  if (cats.length >= 1 && nums.length === 1 && rows.length <= 12) return "donut";

  // Categorical + numeric → bar (default)
  if ((cats.length >= 1 || dates.length >= 1) && nums.length >= 1) return "bar";

  // Fallback
  return nums.length > 0 ? "bar" : "table";
}

export const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "bar",     label: "Bar" },
  { type: "line",    label: "Line" },
  { type: "donut",   label: "Donut" },
  { type: "scatter", label: "Scatter" },
  { type: "stat",    label: "Stat" },
];
