import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { InsightResult } from "@datachat/shared";

export const insights = new Hono();

const bodySchema = z.object({
  question: z.string(),
  sql: z.string().optional(),
  rows: z.array(z.record(z.unknown())).max(200),
});

insights.post("/", zValidator("json", bodySchema), async (c) => {
  const { question, sql, rows } = c.req.valid("json");

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return c.json({ error: "OPENAI_API_KEY not set" }, 503);

  const sample = rows.slice(0, 50);

  const systemPrompt = `You are a senior data analyst. Given a SQL query result, produce a concise JSON analysis.

Respond ONLY with a JSON object matching exactly this shape:
{
  "summary": "<1-2 sentence plain-English summary of what the data shows>",
  "anomalies": ["<anomaly 1>", "<anomaly 2>"],
  "trends": ["<trend 1>", "<trend 2>"],
  "suggestions": ["<follow-up question 1>", "<follow-up question 2>"]
}

Rules:
- anomalies: surprising outliers, nulls, gaps, unexpected values (0–3 items)
- trends: directional patterns over time or across categories (0–3 items)
- suggestions: useful follow-up questions the user could ask next (1–3 items)
- If a section has nothing to say, use an empty array
- Be concise — each item is one sentence max`;

  const userMsg = `User question: "${question}"
${sql ? `SQL: ${sql}\n` : ""}
Sample data (${rows.length} total rows, showing first ${sample.length}):
${JSON.stringify(sample, null, 2)}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return c.json({ error: `LLM error: ${res.status}` }, 502);

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content) as InsightResult;

  return c.json(parsed);
});
