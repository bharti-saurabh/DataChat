import type { DBAdapter } from "./types.js";
import { PostgresAdapter } from "./adapters/postgres.js";
import { MySQLAdapter } from "./adapters/mysql.js";
import type { ConnectionConfig } from "@datachat/shared";

export function createAdapter(config: ConnectionConfig): DBAdapter {
  switch (config.type) {
    case "postgres":
      return new PostgresAdapter(config);
    case "mysql":
      return new MySQLAdapter(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

export type { DBAdapter, TableSchema, QueryResult } from "./types.js";
