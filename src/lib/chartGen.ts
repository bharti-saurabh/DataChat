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
