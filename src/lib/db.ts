import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { dsvFormat, autoType } from "d3-dsv";
import type { TableSchema, QueryRow } from "@/types";

// SQLite is initialized once as a module-level singleton
type Sqlite3Module = Awaited<ReturnType<typeof sqlite3InitModule>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SQLiteDB = any; // oo1.DB is not strongly typed in the WASM package

let db: ReturnType<typeof createDB> | null = null;
let rawDb: SQLiteDB | null = null;

const DEFAULT_DB = "@";

function createDB(s3: Awaited<ReturnType<typeof sqlite3InitModule>>, raw: SQLiteDB) {
  return {
    exec(sql: string, opts?: { rowMode?: "object" | "array" }) {
      return raw.exec(sql, opts ?? {}) as QueryRow[];
    },
    prepare(sql: string) {
      return raw.prepare(sql);
    },
    schema(): TableSchema[] {
      const tables = raw.exec("SELECT name, sql FROM sqlite_master WHERE type='table'", { rowMode: "object" }) as {
        name: string;
        sql: string;
      }[];
      return tables.map((table) => ({
        ...table,
        columns: raw.exec(`PRAGMA table_info(${JSON.stringify(table.name)})`, { rowMode: "object" }) as TableSchema["columns"],
      }));
    },
    schemaSQL(): string {
      return this.schema()
        .map((t) => t.sql)
        .join("\n\n");
    },
    tablePreview(tableName: string, limit = 5): QueryRow[] {
      return raw.exec(`SELECT * FROM ${JSON.stringify(tableName)} LIMIT ${limit}`, { rowMode: "object" }) as QueryRow[];
    },
    tableRowCount(tableName: string): number {
      const result = raw.exec(`SELECT COUNT(*) as cnt FROM ${JSON.stringify(tableName)}`, { rowMode: "object" }) as {
        cnt: number;
      }[];
      return result[0]?.cnt ?? 0;
    },
    dropAllTables() {
      const tables = raw.exec("SELECT name FROM sqlite_master WHERE type='table'", { rowMode: "object" }) as {
        name: string;
      }[];
      for (const { name } of tables) {
        raw.exec(`DROP TABLE IF EXISTS ${JSON.stringify(name)}`);
      }
    },
    async uploadSQLite(file: File): Promise<void> {
      const buf = await file.arrayBuffer();
      s3.capi.sqlite3_js_posix_create_file(file.name, buf);
      const uploadDB = new s3.oo1.DB(file.name, "r") as SQLiteDB;
      const tables = uploadDB.exec("SELECT name, sql FROM sqlite_master WHERE type='table'", { rowMode: "object" }) as {
        name: string;
        sql: string;
      }[];
      for (const { name, sql } of tables) {
        raw.exec(`DROP TABLE IF EXISTS ${JSON.stringify(name)}`);
        raw.exec(sql);
        const data = uploadDB.exec(`SELECT * FROM ${JSON.stringify(name)}`, { rowMode: "object" }) as QueryRow[];
        if (data.length > 0) {
          const cols = Object.keys(data[0]);
          const insertSQL = `INSERT INTO ${JSON.stringify(name)} (${cols.map((c) => JSON.stringify(c)).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
          const stmt = raw.prepare(insertSQL);
          raw.exec("BEGIN TRANSACTION");
          for (const row of data) stmt.bind(cols.map((c) => row[c])).stepReset();
          raw.exec("COMMIT");
          stmt.finalize();
        }
      }
      uploadDB.close();
    },
    async uploadCSV(file: File, separator = ","): Promise<string> {
      const text = await file.text();
      const rows = dsvFormat(separator).parse(text, autoType);
      const tableName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
      insertRows(raw, tableName, rows as QueryRow[]);
      return tableName;
    },
  };
}

function insertRows(raw: SQLiteDB, tableName: string, rows: QueryRow[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const typeMap: Record<string, string> = {};
  for (const col of cols) {
    const v = rows[0][col];
    if (typeof v === "number") typeMap[col] = Number.isInteger(v) ? "INTEGER" : "REAL";
    else if (typeof v === "boolean") typeMap[col] = "INTEGER";
    else typeMap[col] = "TEXT";
  }
  raw.exec(`CREATE TABLE IF NOT EXISTS ${JSON.stringify(tableName)} (${cols.map((c) => `${JSON.stringify(c)} ${typeMap[c]}`).join(", ")})`);
  const insertSQL = `INSERT INTO ${JSON.stringify(tableName)} (${cols.map((c) => JSON.stringify(c)).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  const stmt = raw.prepare(insertSQL);
  raw.exec("BEGIN TRANSACTION");
  for (const row of rows) {
    stmt
      .bind(
        cols.map((c) => {
          const v = row[c];
          return v instanceof Date ? v.toISOString() : v;
        }),
      )
      .stepReset();
  }
  raw.exec("COMMIT");
  stmt.finalize();
}

export async function getDB() {
  if (db) return db;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s3 = await (sqlite3InitModule as any)({ printErr: console.error }) as Sqlite3Module;
  rawDb = new s3.oo1.DB(DEFAULT_DB, "c") as SQLiteDB;
  db = createDB(s3, rawDb);
  return db;
}

export type DB = Awaited<ReturnType<typeof getDB>>;
