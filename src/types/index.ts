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
  topValues?: string[];     // top 3–5 most frequent values
  description?: string;     // AI-generated plain-English description
}

export interface ForeignKeyInfo {
  column: string;       // local column name
  refTable: string;     // referenced table
  refColumn: string;    // referenced column
}

export interface TableSchema {
  name: string;
  sql: string;
  columns: ColumnInfo[];
  rowCount?: number;
  preview?: QueryRow[];
  columnStats?: ColumnStats[];  // cached after first expand
  foreignKeys?: ForeignKeyInfo[]; // loaded via PRAGMA on first expand
}

export type QueryRow = Record<string, unknown>;

// ── Chart config ─────────────────────────────────────────────────────────────
export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "scatter";

export interface ChartConfig {
  chartType: ChartType;
  xKey: string;
  yKey: string | string[];
  title?: string;
  // Advanced
  colors?: string[];                         // per-series color overrides
  dualAxis?: boolean;                        // enable right Y-axis
  rightAxisKeys?: string[];                  // series rendered on right axis
  seriesTypes?: Record<string, ChartType>;   // per-series type (mixed charts)
}

// ── Slide text block ──────────────────────────────────────────────────────────
export interface SlideTextBlock {
  id: string;
  content: string;
  format: "heading" | "body" | "caption" | "key";
}

// ── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "clarifying";
  question?: string;
  content?: string;           // markdown LLM reasoning
  sql?: string;               // extracted SQL
  result?: QueryRow[];        // query rows
  error?: string;
  // Insights
  insights?: string;
  insightsLoading?: boolean;
  // Auto-generated chart (JSON config, replaces chartCode eval)
  autoChartConfig?: ChartConfig;
  autoChartLoading?: boolean;
  // Clarifying questions (role === "clarifying")
  clarifyingQuestions?: string[];
  // Post-execution follow-up chips
  suggestions?: string[];
  timestamp: number;
}

// ── Notion Dashboard blocks ───────────────────────────────────────────────────
export type BlockType = "chart" | "table" | "insights" | "heading" | "text" | "divider";

export interface DashboardBlock {
  id: string;
  type: BlockType;
  // heading / text
  content?: string;
  level?: 1 | 2 | 3;        // for heading blocks
  // chart
  chartConfig?: ChartConfig;
  data?: QueryRow[];
  title?: string;
  // insights
  insights?: string;
  // Source query (used for auto-populating presentation slide heading)
  question?: string;
  // Presentation-mode per-slide annotations
  slideAnnotations?: {
    heading?: string;
    textBlocks?: SlideTextBlock[];           // rich text blocks (replaces commentary)
    shownSections?: ("table" | "insights")[]; // extra content panels
  };
  // Grid layout (react-grid-layout)
  layout: { x: number; y: number; w: number; h: number };
}

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

export type SidebarTab = "schema" | "sessions";
