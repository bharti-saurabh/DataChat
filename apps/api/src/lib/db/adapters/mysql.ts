import mysql from "mysql2/promise";
import type { DBAdapter, TableSchema, QueryResult } from "../types.js";
import type { ConnectionConfig } from "@datachat/shared";

export class MySQLAdapter implements DBAdapter {
  private connection: mysql.Connection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? {} : undefined,
    });
  }

  async disconnect() {
    await this.connection?.end();
    this.connection = null;
  }

  async testConnection(): Promise<boolean> {
    const [rows] = await this.connection!.query("SELECT 1 AS ok");
    return Array.isArray(rows) && rows.length === 1;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const [rows, fields] = await this.connection!.query(sql, params);
    const rowArray = rows as Record<string, unknown>[];
    return {
      rows: rowArray,
      rowCount: rowArray.length,
      fields: (fields as mysql.FieldPacket[]).map((f) => f.name),
    };
  }

  async getSchema(): Promise<TableSchema[]> {
    const db = this.config.database!;
    const [tableRows] = await this.connection!.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [db],
    );

    const tables: TableSchema[] = await Promise.all(
      tableRows.map(async (row) => {
        const tableName = row.TABLE_NAME as string;
        const [colRows] = await this.connection!.query<mysql.RowDataPacket[]>(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          [db, tableName],
        );
        return {
          name: tableName,
          columns: colRows.map((c) => ({
            name: c.COLUMN_NAME as string,
            type: c.DATA_TYPE as string,
            nullable: c.IS_NULLABLE === "YES",
          })),
        };
      }),
    );

    return tables;
  }
}
