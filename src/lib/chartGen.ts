import { callLLM } from "@/lib/llm";
import type { LLMSettings, QueryRow, ChartConfig } from "@/types";

function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = match ? match[1].trim() : text.trim();
  return JSON.parse(raw) as T;
}

export async function generateChartConfig(
  data: QueryRow[],
  question: string,
  settings: LLMSettings,
): Promise<ChartConfig> {
  if (!data.length) throw new Error("No data to chart");

  const keys = Object.keys(data[0]);
  const sample = JSON.stringify(data.slice(0, 5), null, 2);

  const system = `You are a data visualization expert. Given query results, choose the best chart configuration.

Available chart types: bar, line, area, pie, donut, scatter

Rules:
- bar: comparisons across categories
- line/area: trends over time
- pie/donut: part-to-whole (max 8 slices, use for <= 10 rows)
- scatter: correlation between two numeric columns
- xKey: column for x-axis or labels (usually categorical or date)
- yKey: one column name (string) OR array of column names for multi-series

Respond with ONLY valid JSON, no markdown:
{ "chartType": "bar", "xKey": "column_name", "yKey": "column_name", "title": "Chart Title" }`;

  const user = `Question: ${question}

Columns: ${keys.join(", ")}
Sample data (${data.length} total rows):
${sample}`;

  const raw = await callLLM({ system, user, settings });
  const config = parseJSON<ChartConfig>(raw);

  // Validate
  const validTypes = ["bar", "line", "area", "pie", "donut", "scatter"];
  if (!validTypes.includes(config.chartType)) config.chartType = "bar";
  if (!config.xKey || !keys.includes(config.xKey)) config.xKey = keys[0];
  if (!config.yKey) {
    const numKey = keys.find((k, i) => i > 0 && typeof data[0][k] === "number");
    config.yKey = numKey ?? keys[1] ?? keys[0];
  }

  return config;
}

/**
 * Edit an existing ChartConfig based on a free-text user instruction.
 * Returns a new (or partially modified) ChartConfig.
 */
export async function editChartConfig(
  current: ChartConfig,
  instruction: string,
  data: QueryRow[],
  settings: LLMSettings,
): Promise<ChartConfig> {
  if (!data.length) throw new Error("No data");

  const keys = Object.keys(data[0]);
  const sample = JSON.stringify(data.slice(0, 5), null, 2);

  const system = `You are a data visualization expert. The user has an existing chart and wants to modify it.
Apply the user's instruction to produce an updated chart configuration.

Available chart types: bar, line, area, pie, donut, scatter
Available columns: ${keys.join(", ")}

Rules:
- Only change what the instruction asks for; keep everything else the same
- xKey must be one of the available columns
- yKey must be one column name OR an array of column names (all must be available columns)
- Respond with ONLY valid JSON, no markdown:
{ "chartType": "...", "xKey": "...", "yKey": "...", "title": "..." }`;

  const user = `Current chart config:
${JSON.stringify(current, null, 2)}

User instruction: "${instruction}"

Sample data (${data.length} rows total):
${sample}

Return the updated chart config JSON:`;

  const raw = await callLLM({ system, user, settings });
  const config = parseJSON<ChartConfig>(raw);

  // Validate / fall back to current values
  const validTypes = ["bar", "line", "area", "pie", "donut", "scatter"];
  if (!validTypes.includes(config.chartType)) config.chartType = current.chartType;
  if (!config.xKey || !keys.includes(config.xKey)) config.xKey = current.xKey;
  if (!config.yKey) config.yKey = current.yKey;
  if (Array.isArray(config.yKey)) {
    const valid = config.yKey.filter((k) => keys.includes(k));
    config.yKey = valid.length ? valid : current.yKey;
  } else if (!keys.includes(config.yKey as string)) {
    config.yKey = current.yKey;
  }

  return config;
}
