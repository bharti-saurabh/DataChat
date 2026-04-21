import type { LLMSettings } from "@/types";

export interface LLMCallOptions {
  system: string;
  user: string;
  settings: LLMSettings;
  schema?: object;
}

export async function callLLM({ system, user, settings, schema }: LLMCallOptions): Promise<string> {
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) },
      ],
      ...(schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "response", strict: true, schema },
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";

  if (schema) {
    return content; // caller will JSON.parse
  }
  return content;
}

export async function callLLMJSON<T>(opts: Omit<LLMCallOptions, "schema"> & { schema: object }): Promise<T> {
  const content = await callLLM(opts);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Failed to parse LLM JSON response: ${content}`);
  }
}

export const MODELS = [
  { label: "GPT-4.1 Mini (default)", value: "gpt-4.1-mini" },
  { label: "GPT-4.1", value: "gpt-4.1" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
  { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
  { label: "Custom…", value: "custom" },
];

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  baseUrl: "https://llmfoundry.straive.com/openai/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0,
};
