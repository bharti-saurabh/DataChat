import { callLLM } from "@/lib/llm";
import { extractJSCode } from "@/lib/utils";
import type { LLMSettings, QueryRow } from "@/types";

export async function generateChartCode(
  data: QueryRow[],
  question: string,
  description: string,
  settings: LLMSettings,
): Promise<string> {
  const system = `Write JS code to draw a ChartJS 4 chart.
Write the code inside a \`\`\`js code fence.
\`Chart\` is already imported and registered.
Data is ALREADY available as \`data\`, an array of objects. Do not create it.
Render inside a <canvas id="chart"> element like this:

\`\`\`js
return new Chart(
  document.getElementById("chart"),
  {
    type: "...",
    options: { responsive: true, maintainAspectRatio: true, ... },
    data: { ... },
  }
)
\`\`\`

Choose the most informative chart type automatically unless the description specifies one.
Use clear labels. For large datasets aggregate to top 10-15 items to keep it readable.`;

  const user = `Question: ${question}

// First 5 rows of result (full dataset available as \`data\`)
data = ${JSON.stringify(data.slice(0, 5), null, 2)}

Total rows: ${data.length}

IMPORTANT: ${description}`;

  const result = await callLLM({ system, user, settings });
  const code = extractJSCode(result);
  if (!code) throw new Error("No JS code block found in chart response");
  return code;
}
