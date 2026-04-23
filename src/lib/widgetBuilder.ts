import { callLLM } from "@/lib/llm";
import { runQuery } from "@/lib/db";
import { generateId } from "@/lib/utils";
import type { Widget, LLMSettings, TableSchema, QueryRow, ChartType } from "@/types";

interface AIWidget {
  id: string;
  type: "kpi" | "chart" | "table" | "insight";
  title: string;
  sql?: string;
  chartType?: ChartType;
  xKey?: string;
  yKey?: string;
  insight?: string;
  layout: { x: number; y: number; w: number; h: number };
}

interface AIResponse {
  dashboardTitle: string;
  widgets: AIWidget[];
}

function parseJSON<T>(text: string): T {
  // Extract JSON from markdown code fences if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const raw = match ? match[1].trim() : text.trim();
  return JSON.parse(raw) as T;
}

export async function buildDashboard(
  prompt: string,
  schemas: TableSchema[],
  settings: LLMSettings,
  existingWidgets: Widget[],
): Promise<{ title: string; widgets: Widget[] }> {
  const schemaText = schemas.map((s) =>
    `Table: ${s.name} (${s.rowCount?.toLocaleString() ?? "?"} rows)\nColumns: ${s.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`
  ).join("\n\n");

  const existingContext = existingWidgets.length > 0
    ? `\nExisting dashboard widgets: ${existingWidgets.map((w) => w.title).join(", ")}. Add new widgets or suggest modifications.\n`
    : "";

  const system = `You are an expert data analyst and dashboard designer. Given a dataset schema and a user prompt, design a Bento Box dashboard with multiple widgets.

Rules:
- Use a 12-column grid (x+w ≤ 12). Keep y values compact (0–8 range).
- KPI widgets: w=3, h=2. SQL returns ONE row with a "value" column; optionally "label", "delta" (%), "unit".
- Chart widgets: w=6 or w=9, h=5. SQL returns rows. Set xKey and yKey (column names). chartType: bar|line|area|pie|donut|scatter.
- Table widgets: w=6 or w=12, h=5. SQL returns up to 100 rows.
- Insight widgets: w=4 or w=6, h=2. Fill "insight" with a concise text observation (no SQL).
- Use DuckDB SQL syntax (window functions, CTEs, PIVOT all supported).
- Generate 4–8 diverse widgets covering the prompt comprehensively.
- Pack the grid left-to-right, row by row.
${existingContext}
Dataset schema:
${schemaText}

Respond ONLY with valid JSON in this exact shape (no markdown fences):
{
  "dashboardTitle": "string",
  "widgets": [
    {
      "id": "unique_short_id",
      "type": "kpi|chart|table|insight",
      "title": "string",
      "sql": "SELECT ... (null for insight type)",
      "chartType": "bar|line|area|pie|donut|scatter (charts only, else null)",
      "xKey": "column name for x axis (charts only, else null)",
      "yKey": "column name for y axis (charts only, else null)",
      "insight": "text observation (insight type only, else null)",
      "layout": { "x": 0, "y": 0, "w": 3, "h": 2 }
    }
  ]
}`;

  const raw = await callLLM({ system, user: prompt, settings });
  const resp = parseJSON<AIResponse>(raw);

  const widgets: Widget[] = resp.widgets.map((w) => ({
    ...w,
    id: w.id || generateId(),
    chartType: (w.chartType as Widget["chartType"]) ?? "bar",
    layout: w.layout,
    loading: w.type !== "insight",
  }));

  return { title: resp.dashboardTitle, widgets };
}

export async function executeWidget(widget: Widget): Promise<Widget> {
  if (widget.type === "insight" || !widget.sql) return { ...widget, loading: false };
  try {
    const data: QueryRow[] = await runQuery(widget.sql);
    return { ...widget, data, loading: false, error: undefined };
  } catch (e) {
    return { ...widget, loading: false, error: String(e), data: [] };
  }
}

export async function generateWidgetCommentary(
  widget: Widget,
  data: QueryRow[],
  settings: LLMSettings,
): Promise<string> {
  const sample = JSON.stringify(data.slice(0, 12), null, 2);
  const system = `You are a sharp business analyst writing commentary for an executive dashboard.
Write 2–3 concise sentences that surface the single most important insight from this widget's data.
Be specific: use actual numbers, percentages, or comparisons from the data.
Write for a non-technical business reader. No bullet points, no markdown — plain prose only.`;

  const user = `Widget title: "${widget.title}"
Widget type: ${widget.type}${widget.chartType ? ` (${widget.chartType} chart)` : ""}
Data (${data.length} rows total, first 12 shown):
${sample}`;

  return await callLLM({ system, user, settings });
}

export async function refineWidget(
  widget: Widget,
  prompt: string,
  schemas: TableSchema[],
  settings: LLMSettings,
): Promise<Widget> {
  const schemaText = schemas.map((s) =>
    `Table: ${s.name}\nColumns: ${s.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`
  ).join("\n\n");

  const system = `You are refining a single dashboard widget based on a user instruction.
Current widget: ${JSON.stringify({ ...widget, data: undefined })}
Dataset schema:
${schemaText}

Respond ONLY with valid JSON for the updated widget (same shape as input, no markdown fences).`;

  const raw = await callLLM({ system, user: prompt, settings });
  const updated = parseJSON<AIWidget>(raw);

  const refined: Widget = {
    ...widget,
    ...updated,
    id: widget.id,
    layout: updated.layout ?? widget.layout,
    loading: updated.type !== "insight" && !!updated.sql,
  };

  if (refined.loading && refined.sql) {
    return executeWidget(refined);
  }
  return refined;
}
