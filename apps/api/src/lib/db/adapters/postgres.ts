import pg from "pg";
import type { DBAdapter, TableSchema, QueryResult } from "../types.js";
import type { ConnectionConfig } from "@datachat/shared";

export class PostgresAdapter implements DBAdapter {
  private client: pg.Client;

  constructor(config: ConnectionConfig) {
    this.client = new pg.Client({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async testConnection(): Promise<boolean> {
    const res = await this.client.query("SELECT 1");
    return res.rowCount === 1;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const res = await this.client.query(sql, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount ?? 0,
      fields: res.fields.map((f) => f.name),
    };
  }

  async getSchema(): Promise<TableSchema[]> {
    const tablesRes = await this.client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableSchema[] = await Promise.all(
      tablesRes.rows.map(async ({ table_name }) => {
        const colsRes = await this.client.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table_name]);

        return {
          name: table_name,
          columns: colsRes.rows.map((col) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === "YES",
          })),
        };
      }),
    );

    return tables;
  }
}
