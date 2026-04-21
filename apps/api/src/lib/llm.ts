import type { TableSchema } from "./db/types.js";

interface GenerateSQLInput {
  question: string;
  schema: TableSchema[];
  history: { role: "user" | "assistant"; content: string }[];
}

interface GenerateSQLResult {
  sql: string;
  reasoning: string;
}

function buildSchemaText(schema: TableSchema[]): string {
  return schema
    .map((t) => {
      const cols = t.columns.map((c) => `  ${c.name} ${c.type}${c.nullable ? "" : " NOT NULL"}`).join(",\n");
      return `CREATE TABLE ${t.name} (\n${cols}\n);`;
    })
    .join("\n\n");
}

function extractSQL(text: string): string {
  const fence = text.match(/```sql\n([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const bare = text.match(/SELECT[\s\S]+?;/i);
  if (bare) return bare[0].trim();
  throw new Error("No SQL found in LLM response");
}

export async function generateSQL({ question, schema, history }: GenerateSQLInput): Promise<GenerateSQLResult> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const systemPrompt = `You are an expert SQL analyst. Given a database schema and a user question, produce a correct, optimized SQL query.

Schema:
${buildSchemaText(schema)}

Rules:
- Use table.column notation for any ambiguous column references
- Prefer CTEs (WITH clauses) for multi-step logic — they improve readability
- Use window functions (ROW_NUMBER, RANK, LAG, LEAD, SUM OVER, AVG OVER) for rankings, running totals, period-over-period comparisons
- Use subqueries or EXISTS for existence checks rather than JOINs where cleaner
- For time-series: group by date_trunc or strftime, order chronologically
- For top-N: use LIMIT with ORDER BY or RANK()
- For percentages/shares: divide a filtered aggregate by the total (window or subquery)
- For outlier detection: use stddev / mean to flag values beyond 2σ
- Avoid SELECT *; select only needed columns
- Limit results to 500 rows unless the question implies a full export
- Output your reasoning first (2–4 sentences), then the SQL inside a \`\`\`sql\`\`\` fence`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: question },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.1 }),
  });

  if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices[0].message.content;
  const sql = extractSQL(content);
  const reasoning = content.replace(/```sql[\s\S]*?```/gi, "").trim();

  return { sql, reasoning };
}
