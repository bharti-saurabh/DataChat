export interface ClusterTable {
  id: string;            // must match CSV filename without .csv and DuckDB table name
  displayName: string;
  description: string;
  grain: string;         // "One row per account"
  primaryKey: string;
  csvPath: string;       // relative to BASE_URL, e.g. "datasets/credit-risk/dim_account.csv"
  estimatedRows: number;
  color: string;         // tailwind bg color class for ER node
  textColor: string;     // tailwind text color class
  position: { x: number; y: number }; // initial ER diagram position (%)
}

export interface ClusterRelationship {
  fromTable: string;     // table id
  fromColumn: string;
  toTable: string;       // table id (usually the spine)
  toColumn: string;
  cardinality: "many-to-one" | "one-to-many" | "one-to-one";
  label?: string;
}

export interface DataCluster {
  id: string;
  name: string;
  shortName: string;     // used in compact sidebar
  description: string;
  domain: string;        // "Finance", "Healthcare", etc.
  tags: string[];
  icon: string;          // emoji
  spineTable: string;    // table id that is the central join hub
  tables: ClusterTable[];
  relationships: ClusterRelationship[];
  llmContext: string;    // injected into AI system prompts verbatim
  suggestedQuestions?: string[];
}

export interface ClusterLoadProgress {
  step: number;
  total: number;
  tableName: string;
}
