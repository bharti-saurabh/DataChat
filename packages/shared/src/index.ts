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
  insights?: InsightResult;
  // Collaboration — set when message originated from a remote peer
  authorId?: string;
  authorName?: string;
  authorColor?: string;
}

// ── Collaboration ──────────────────────────────────────────────────────────

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

// Messages sent client → server
export type CollabClientMsg =
  | { type: "join";             user: CollabUser }
  | { type: "query_broadcast";  user: CollabUser; question: string; sql?: string; rowCount: number }
  | { type: "typing";           userId: string; isTyping: boolean };

// Messages sent server → client
export type CollabServerMsg =
  | { type: "welcome";          users: CollabUser[]; roomId: string }
  | { type: "user_joined";      user: CollabUser }
  | { type: "user_left";        userId: string }
  | { type: "query_broadcast";  fromUser: CollabUser; question: string; sql?: string; rowCount: number }
  | { type: "typing";           userId: string; isTyping: boolean };

export interface InsightResult {
  summary: string;
  anomalies: string[];
  trends: string[];
  suggestions: string[];
}

export interface DashboardChart {
  id: string;
  title: string;
  chartCode: string;
  data: Record<string, unknown>[];
  question?: string;
  chartType?: string;
  gridPos?: { x: number; y: number; w: number; h: number };
}

export interface Session {
  id: string;
  name: string;
  connectionId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
