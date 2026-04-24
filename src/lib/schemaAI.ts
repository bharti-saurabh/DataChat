import { callLLM } from "@/lib/llm";
import type { ColumnInfo, ColumnStats, LLMSettings, QueryRow } from "@/types";

/** Generate a concise, punchy slide heading (5–10 words) for a data result. */
export async function suggestSlideHeading(
  data: QueryRow[],
  chartTitle: string | undefined,
  insights: string | undefined,
  settings: LLMSettings,
): Promise<string> {
  const cols = data.length ? Object.keys(data[0]) : [];
  const sample = JSON.stringify(data.slice(0, 5), null, 0);

  const system = `You are a data presentation expert. Write a short, punchy slide title (5–10 words) that captures the main finding of the data. Use title case. No periods. No preamble.`;
  const user = `Columns: ${cols.join(", ")}
Sample data: ${sample}
${chartTitle ? `Chart title: ${chartTitle}` : ""}
${insights ? `Key insight: ${insights.split("\n")[0]}` : ""}

Write the slide title:`;

  const raw = await callLLM({ system, user, settings });
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "");
}

/** Generate a concise plain-English description of a column. */
export async function generateColumnDescription(
  tableName: string,
  col: ColumnInfo,
  stats: ColumnStats,
  settings: LLMSettings,
): Promise<string> {
  const nullPct = stats.total > 0 ? Math.round((stats.nullCount / stats.total) * 100) : 0;
  const topStr = stats.topValueCounts?.length
    ? `Top values: ${stats.topValueCounts.slice(0, 5).map((t) => t.value).join(", ")}`
    : "";
  const rangeStr =
    stats.min != null && stats.max != null
      ? `Range: ${stats.min} → ${stats.max}${stats.avg != null ? `, avg ${Number(stats.avg).toFixed(1)}` : ""}`
      : "";

  const system = `You are a data dictionary expert. Write a single concise sentence (under 20 words) describing what a database column likely represents, based on its name, type, and sample statistics. No preamble.`;

  const user = `Table: ${tableName}
Column: ${col.name}
Type: ${col.type}
Distinct values: ${stats.distinct} / ${stats.total} rows (${nullPct}% null)
${rangeStr}
${topStr}

Describe what this column represents:`;

  const raw = await callLLM({ system, user, settings });
  return raw.trim().replace(/^["']|["']$/g, "");
}

/** Generate AI commentary for a dashboard presentation slide. */
export async function suggestSlideCommentary(
  title: string,
  data: QueryRow[],
  insights: string | undefined,
  settings: LLMSettings,
): Promise<string> {
  const sample = JSON.stringify(data.slice(0, 8), null, 0);
  const cols = data.length ? Object.keys(data[0]) : [];

  const system = `You are a data analyst writing slide commentary for a business presentation. Write 2–3 concise, insightful sentences that highlight the key takeaway from the data. Use plain language. No bullet points, no preamble.`;

  const user = `Slide title: ${title || "Data analysis"}
Columns: ${cols.join(", ")}
Sample data (up to 8 rows): ${sample}
${insights ? `Existing insights:\n${insights}` : ""}

Write the slide commentary:`;

  const raw = await callLLM({ system, user, settings });
  return raw.trim();
}

/** Rewrite existing commentary in a different tone. */
export async function rewriteCommentary(
  current: string,
  tone: "formal" | "concise" | "executive",
  settings: LLMSettings,
): Promise<string> {
  const toneDesc =
    tone === "formal" ? "formal and detailed"
    : tone === "concise" ? "concise and punchy (1 sentence)"
    : "executive-summary style (key number + implication)";

  const system = `You are a business writing expert. Rewrite the given data commentary in a ${toneDesc} style. Keep the core facts. No preamble.`;
  const user = `Rewrite this commentary:\n\n${current}`;

  const raw = await callLLM({ system, user, settings });
  return raw.trim();
}
