export type DBType = "postgres" | "mysql" | "sqlite" | "bigquery" | "snowflake";

export interface ConnectionConfig {
  id?: string;
  label: string;
  type: DBType;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
}

export interface ConnectionMeta {
  id: string;
  label: string;
  type: DBType;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface QueryResult {
  sql: string;
  reasoning: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content?: string;
  question?: string;
  sql?: string;
  reasoning?: string;
  rows?: Record<string, unknown>[];
  error?: string;
  timestamp: number;
}

export interface DashboardChart {
  id: string;
  title: string;
  chartCode: string;
  data: Record<string, unknown>[];
}

export interface Session {
  id: string;
  name: string;
  connectionId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
