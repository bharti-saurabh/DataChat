import { callLLMJSON } from "@/lib/llm";
import type { TableSchema, LLMSettings, SchemaInsights } from "@/types";

const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    tables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:              { type: "string" },
          tableType:         { type: "string" },
          typeConfidence:    { type: "string" },
          description:       { type: "string" },
          primaryKeyColumns: { type: "array", items: { type: "string" } },
          piiColumns:        { type: "array", items: { type: "string" } },
          qualityIssues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column:   { type: "string" },
                issue:    { type: "string" },
                severity: { type: "string" },
              },
              required: ["column", "issue", "severity"],
              additionalProperties: false,
            },
          },
          recommendations: { type: "array", items: { type: "string" } },
        },
        required: ["name", "tableType", "typeConfidence", "description",
          "primaryKeyColumns", "piiColumns", "qualityIssues", "recommendations"],
        additionalProperties: false,
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fromTable:   { type: "string" },
          fromColumn:  { type: "string" },
          toTable:     { type: "string" },
          toColumn:    { type: "string" },
          type:        { type: "string" },
          confidence:  { type: "string" },
          description: { type: "string" },
        },
        required: ["fromTable", "fromColumn", "toTable", "toColumn", "type", "confidence", "description"],
        additionalProperties: false,
      },
    },
    modelingRecommendations: { type: "array", items: { type: "string" } },
    architecturePattern:     { type: "string" },
  },
  required: ["tables", "relationships", "modelingRecommendations", "architecturePattern"],
  additionalProperties: false,
};

function buildTableContext(schema: TableSchema): string {
  const lines: string[] = [];
  lines.push(`TABLE: ${schema.name}${schema.rowCount != null ? ` (${schema.rowCount.toLocaleString()} rows)` : ""}`);
  lines.push("Columns:");

  for (const col of schema.columns) {
    const pkTag = col.pk ? " [PK]" : "";
    const stats = schema.columnStats?.find((s) => s.columnName === col.name);
    let detail = "";
    if (stats) {
      const nullPct = stats.total > 0 ? Math.round((stats.nullCount / stats.total) * 100) : 0;
      if (nullPct > 0) detail += ` nulls:${nullPct}%`;
      if (stats.topValueCounts?.length) {
        const top = stats.topValueCounts.slice(0, 3)
          .map((t) => `${t.value}(${Math.round((t.count / (stats.total - stats.nullCount || 1)) * 100)}%)`)
          .join(", ");
        detail += ` top:[${top}]`;
      } else if (stats.min != null && stats.max != null) {
        detail += ` range:${stats.min}→${stats.max}`;
        if (stats.avg != null) detail += ` avg:${Number(stats.avg).toFixed(1)}`;
      }
    }
    lines.push(`  ${col.name.padEnd(28)} ${col.type.padEnd(12)}${pkTag}${detail}`);
  }

  if (schema.preview?.length) {
    lines.push("Sample (first 2 rows):");
    const cols = schema.columns.map((c) => c.name);
    lines.push("  " + cols.join(" | "));
    for (const row of schema.preview.slice(0, 2)) {
      lines.push("  " + cols.map((c) => String(row[c] ?? "")).join(" | "));
    }
  }

  if (schema.foreignKeys?.length) {
    lines.push("Declared FKs:");
    for (const fk of schema.foreignKeys) {
      lines.push(`  ${fk.column} → ${fk.refTable}.${fk.refColumn}`);
    }
  }

  return lines.join("\n");
}

export async function generateSchemaInsights(
  schemas: TableSchema[],
  settings: LLMSettings,
): Promise<SchemaInsights> {
  const tablesContext = schemas.map(buildTableContext).join("\n\n");

  const system = `You are a senior data architect performing a schema intelligence review. Analyze the provided database schema and return a structured JSON analysis. Be specific and actionable. Detect real patterns, not generic advice.

Key analysis tasks:
- Classify each table: fact (transactional events/measures), dimension (descriptive attributes), lookup (small reference/code tables), bridge (many-to-many junction tables), or unknown
- Detect PII columns: names, emails, SSN, DOB, addresses, phone numbers, account numbers, national IDs
- Identify data quality issues: high null rates (>20%), suspicious value distributions, likely encoding issues, mixed types
- Detect relationships: look for shared column names, ID suffixes (_id, _key, _code), and naming patterns
- Identify architecture patterns: star schema (one fact + multiple dimensions), snowflake (normalized dimensions), flat (single denormalized table), mixed`;

  const user = `Analyze these ${schemas.length} database table${schemas.length !== 1 ? "s" : ""}:

${tablesContext}

Return your analysis as JSON following the required schema.
- tableType must be one of: fact, dimension, lookup, bridge, unknown
- typeConfidence must be one of: high, medium, low
- relationship type must be one of: many-to-one, one-to-many, one-to-one, many-to-many
- confidence must be one of: high, medium, low
- architecturePattern must be one of: star_schema, snowflake, flat, mixed, unknown
- piiColumns: list column names that likely contain personally identifiable information
- qualityIssues: only flag genuine issues (>20% null rate, suspicious distributions, etc.)
- recommendations: 1-3 actionable, specific recommendations per table`;

  const raw = await callLLMJSON<Omit<SchemaInsights, "generatedAt">>({
    system,
    user,
    settings,
    schema: INSIGHTS_SCHEMA,
  });

  return { ...raw, generatedAt: Date.now() };
}
