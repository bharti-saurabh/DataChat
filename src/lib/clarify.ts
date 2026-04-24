import { callLLMJSON } from "@/lib/llm";
import type { ClarificationQuestion, LLMSettings, QueryRow } from "@/types";

interface ClarificationResult {
  needsClarification: boolean;
  questions: ClarificationQuestion[];
}

interface FollowUpResult {
  suggestions: string[];
}

const CLARIFY_SCHEMA = {
  type: "object",
  properties: {
    needsClarification: { type: "boolean" },
    questions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["needsClarification", "questions"],
  additionalProperties: false,
};

const FOLLOWUP_SCHEMA = {
  type: "object",
  properties: {
    suggestions: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

export async function checkClarification(
  question: string,
  schemaSQL: string,
  context: string,
  settings: LLMSettings,
): Promise<ClarificationResult> {
  try {
    return await callLLMJSON<ClarificationResult>({
      system: `You are a data analyst assistant. Given the user's question and database schema, decide if 1-3 clarifying questions would significantly improve the SQL query accuracy or usefulness.

Only ask for clarification when it would meaningfully change the query output — for example:
- Limit: "Do you want all countries or just the top N?"
- Time range: "Which year or period?"
- Grouping: "Group by month or by year?"
- Metric: "By count or by value?"

Do NOT ask for clarification on simple, unambiguous factual questions.
Do NOT ask more than 3 questions.

For each question you ask, provide 2-4 short, concrete answer options (2-5 words each). These are the most likely choices a user might pick. Do NOT include "Other" — that will be added automatically.

${context ? `Dataset context: ${context}` : ""}

Schema:
${schemaSQL}`,
      user: question,
      settings,
      schema: CLARIFY_SCHEMA,
    });
  } catch {
    return { needsClarification: false, questions: [] };
  }
}

export async function generateFollowUps(
  question: string,
  result: QueryRow[],
  settings: LLMSettings,
): Promise<string[]> {
  try {
    const res = await callLLMJSON<FollowUpResult>({
      system: `Given a data query and its results, suggest 2-3 concise follow-up refinements the user might want.
Each suggestion must be under 8 words. Examples: "Show only top 10", "Group by month", "Filter to last year", "Add percentage column".
Only suggest refinements that are relevant to the data shape shown.`,
      user: `Question: ${question}

Result sample (first 3 rows):
${JSON.stringify(result.slice(0, 3), null, 2)}

Total rows: ${result.length}`,
      settings,
      schema: FOLLOWUP_SCHEMA,
    });
    return res.suggestions ?? [];
  } catch {
    return [];
  }
}

export async function generateInsights(
  question: string,
  result: QueryRow[],
  settings: LLMSettings,
): Promise<string> {
  try {
    const text = await import("@/lib/llm").then(({ callLLM }) =>
      callLLM({
        system: `Write a 2-3 sentence plain English insight about these data query results.
Focus on the most interesting patterns, outliers, rankings, or trends.
Be specific — cite actual numbers, names, or percentages from the data.
Do not repeat the question. Do not use bullet points.`,
        user: `Question: ${question}

Results (first 50 rows):
${JSON.stringify(result.slice(0, 50), null, 2)}`,
        settings,
      }),
    );
    return text.trim();
  } catch {
    return "";
  }
}
