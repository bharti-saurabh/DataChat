// ── App mode ──────────────────────────────────────────────────────────────────
export type AppMode = "analyst" | "explorer";

// ── Columns ───────────────────────────────────────────────────────────────────
export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface ColumnStats {
  columnName: string;
  total: number;
  distinct: number;
  nullCount: number;
  min?: unknown;
  max?: unknown;
  avg?: number;
  stddev?: number;
  topValueCounts?: { value: string; count: number }[];
  description?: string;
}

export interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableSchema {
  name: string;
  sql: string;
  columns: ColumnInfo[];
  rowCount?: number;
  preview?: QueryRow[];
  columnStats?: ColumnStats[];
  foreignKeys?: ForeignKeyInfo[];
}

export type QueryRow = Record<string, unknown>;

// ── Chart config ─────────────────────────────────────────────────────────────
export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "scatter";

export interface ChartConfig {
  chartType: ChartType;
  xKey: string;
  yKey: string | string[];
  title?: string;
  colors?: string[];
  dualAxis?: boolean;
  rightAxisKeys?: string[];
  seriesTypes?: Record<string, ChartType>;
}

// ── Slide text block ──────────────────────────────────────────────────────────
export interface SlideTextBlock {
  id: string;
  content: string;
  format: "heading" | "body" | "caption" | "key";
}

// ── Chat (Analyst mode) ───────────────────────────────────────────────────────
export interface ClarificationQuestion {
  question: string;
  options: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "clarifying";
  question?: string;
  content?: string;
  sql?: string;
  result?: QueryRow[];
  error?: string;
  insights?: string;
  insightsLoading?: boolean;
  autoChartConfig?: ChartConfig;
  autoChartLoading?: boolean;
  clarifyingQuestions?: ClarificationQuestion[];
  suggestions?: string[];
  timestamp: number;
}

// ── Analyst dashboard blocks ──────────────────────────────────────────────────
export type BlockType = "chart" | "table" | "insights" | "heading" | "text" | "divider";

export interface DashboardBlock {
  id: string;
  type: BlockType;
  content?: string;
  level?: 1 | 2 | 3;
  chartConfig?: ChartConfig;
  data?: QueryRow[];
  title?: string;
  insights?: string;
  question?: string;
  slideAnnotations?: {
    heading?: string;
    textBlocks?: SlideTextBlock[];
    shownSections?: ("table" | "insights")[];
  };
  layout: { x: number; y: number; w: number; h: number };
}

// ── Explorer widgets ──────────────────────────────────────────────────────────
export type WidgetType = "kpi" | "chart" | "table" | "insight";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  sql?: string;
  chartType?: ChartType;
  xKey?: string;
  yKey?: string | string[];
  insight?: string;
  layout: WidgetLayout;
  data?: QueryRow[];
  loading?: boolean;
  error?: string;
  commentary?: string;
  commentaryLoading?: boolean;
}

export interface ExplorerDashboard {
  id: string;
  name: string;
  widgets: Widget[];
  createdAt: number;
  updatedAt: number;
}

// ── Shared ────────────────────────────────────────────────────────────────────
export interface DemoConfig {
  title: string;
  body: string;
  file: string;
  context?: string;
  questions?: string[];
}

export interface LLMSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  baseUrl: "https://llmfoundry.straive.com/openai/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0,
};

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  context: string;
  messages: ChatMessage[];
  messageCount: number;
}

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

export type SidebarTab = "schema" | "sessions" | "cluster";

export type { DataCluster, ClusterTable, ClusterRelationship, ClusterLoadProgress } from "./cluster";
