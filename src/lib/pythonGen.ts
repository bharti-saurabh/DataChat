import { callLLM } from "@/lib/llm";
import type { LLMSettings, QueryRow } from "@/types";

export async function generatePythonCode(
  sql: string,
  data: QueryRow[],
  question: string,
  settings: LLMSettings,
): Promise<string> {
  const cols = data.length ? Object.keys(data[0]) : [];
  const sample = JSON.stringify(data.slice(0, 3), null, 2);

  const system = `You are a Python/pandas expert. Convert the given SQLite SQL query to equivalent pandas code.

Rules:
- Assume data is already loaded as a DataFrame named \`df\`
- Show the full pandas equivalent (groupby, agg, sort, etc.)
- Store the result in a variable called \`result\`
- Print result at the end
- Add brief inline comments
- Use only pandas (no SQL), keep it concise
- Wrap in a \`\`\`python code block`;

  const user = `Question: ${question}

SQL:
\`\`\`sql
${sql}
\`\`\`

Columns available: ${cols.join(", ")}
Sample data: ${sample}`;

  const raw = await callLLM({ system, user, settings });

  // Extract code block
  const match = raw.match(/```python\s*([\s\S]*?)```/) ?? raw.match(/```\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}
