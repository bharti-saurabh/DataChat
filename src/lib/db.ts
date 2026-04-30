import * as duckdb from "@duckdb/duckdb-wasm";
import * as XLSX from "xlsx";
import type { TableSchema, QueryRow } from "@/types";

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;

export async function getDB(): Promise<{ db: duckdb.AsyncDuckDB; conn: duckdb.AsyncDuckDBConnection }> {
  if (dbInstance && connInstance) return { db: dbInstance, conn: connInstance };

  const BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(BUNDLES);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: "text/javascript" })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR);
  dbInstance = new duckdb.AsyncDuckDB(logger, worker);
  await dbInstance.instantiate(bundle.mainModule, bundle.mainWorker);
  URL.revokeObjectURL(workerUrl);
  connInstance = await dbInstance.connect();
  return { db: dbInstance, conn: connInstance };
}

async function coerceDateColumns(tableName: string, conn: duckdb.AsyncDuckDBConnection) {
  const describe = await conn.query(`DESCRIBE "${tableName}"`);
  const varcharCols = describe.toArray()
    .map((r) => { const rr = r as Record<string, unknown>; return { name: rr.column_name as string, type: rr.column_type as string }; })
    .filter((c) => c.type === "VARCHAR");
  if (!varcharCols.length) return;

  const countRes = await conn.query(`SELECT COUNT(*) AS n FROM "${tableName}"`);
  const total = Number((countRes.toArray()[0] as Record<string, unknown>).n);
  if (total === 0) return;

  for (const col of varcharCols) {
    const q = col.name.replace(/"/g, '""');
    try {
      const r = await conn.query(
        `SELECT COUNT(*) FILTER (WHERE TRY_CAST("${q}" AS DATE) IS NOT NULL) AS date_ok, ` +
        `COUNT("${q}") AS non_null FROM "${tableName}"`
      );
      const row = r.toArray()[0] as Record<string, unknown>;
      const dateOk = Number(row.date_ok);
      const nonNull = Number(row.non_null);
      if (nonNull > 0 && dateOk / nonNull > 0.9) {
        await conn.query(
          `ALTER TABLE "${tableName}" ALTER "${q}" TYPE DATE USING TRY_CAST("${q}" AS DATE)`
        );
      }
    } catch { /* column can't be cast — skip */ }
  }
}

export async function loadFile(file: File): Promise<TableSchema[]> {
  const { db, conn } = await getDB();
  const name = file.name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "t_");

  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    const sep = /\.tsv$/i.test(file.name) ? "\\t" : ",";
    await conn.query(
      `CREATE OR REPLACE TABLE "${name}" AS SELECT * FROM read_csv_auto('${file.name}', sep='${sep}', header=true, sample_size=-1)`
    );
    await coerceDateColumns(name, conn);
  } else if (/\.(xlsx|xls)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      const csvFile = new File([csv], `${sheetName}.csv`);
      const tname = sheetName.replace(/[^a-zA-Z0-9_]/g, "_");
      await db.registerFileHandle(`${sheetName}.csv`, csvFile, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      await conn.query(`CREATE OR REPLACE TABLE "${tname}" AS SELECT * FROM read_csv_auto('${sheetName}.csv', header=true, sample_size=-1)`);
      await coerceDateColumns(tname, conn);
    }
  } else if (/\.json$/i.test(file.name)) {
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    await conn.query(`CREATE OR REPLACE TABLE "${name}" AS SELECT * FROM read_json_auto('${file.name}')`);
  } else if (/\.parquet$/i.test(file.name)) {
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    await conn.query(`CREATE OR REPLACE TABLE "${name}" AS SELECT * FROM read_parquet('${file.name}')`);
  } else if (/\.(db|sqlite|sqlite3)$/i.test(file.name)) {
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    await conn.query(`ATTACH '${file.name}' AS sqlite_db (TYPE SQLITE)`);
    const tables = await conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='sqlite_db'`);
    for (const row of tables.toArray()) {
      const t = (row as Record<string, unknown>).table_name as string;
      await conn.query(`CREATE OR REPLACE TABLE "${t}" AS SELECT * FROM sqlite_db."${t}"`);
    }
    await conn.query(`DETACH sqlite_db`);
  }

  return getSchemas();
}

export async function loadURL(url: string, tableName: string): Promise<TableSchema[]> {
  const { conn } = await getDB();
  const safe = tableName.replace(/[^a-zA-Z0-9_]/g, "_");
  if (url.endsWith(".parquet")) {
    await conn.query(`CREATE OR REPLACE TABLE "${safe}" AS SELECT * FROM read_parquet('${url}')`);
  } else if (url.endsWith(".json")) {
    await conn.query(`CREATE OR REPLACE TABLE "${safe}" AS SELECT * FROM read_json_auto('${url}')`);
  } else {
    await conn.query(`CREATE OR REPLACE TABLE "${safe}" AS SELECT * FROM read_csv_auto('${url}', header=true, sample_size=-1)`);
    await coerceDateColumns(safe, conn);
  }
  return getSchemas();
}

export async function runQuery(sql: string): Promise<QueryRow[]> {
  const { conn } = await getDB();
  const result = await conn.query(sql);
  return result.toArray().map((row) =>
    Object.fromEntries(
      Object.entries(row as object).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])
    )
  ) as QueryRow[];
}

export async function getSchemas(): Promise<TableSchema[]> {
  const { conn } = await getDB();
  const tables = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_type='BASE TABLE'`
  );
  const schemas: TableSchema[] = [];
  for (const row of tables.toArray()) {
    const name = (row as Record<string, unknown>).table_name as string;
    const cols = await conn.query(`DESCRIBE "${name}"`);
    const columns = cols.toArray().map((r, i) => {
      const rr = r as Record<string, unknown>;
      return { cid: i, name: rr.column_name as string, type: rr.column_type as string, notnull: 0, dflt_value: null, pk: 0 };
    });
    const countRes = await conn.query(`SELECT COUNT(*) as n FROM "${name}"`);
    const rowCount = Number((countRes.toArray()[0] as Record<string, unknown>).n);
    schemas.push({
      name,
      sql: `-- Table: ${name}\n${columns.map((c) => `--  ${c.name} ${c.type}`).join("\n")}`,
      columns,
      rowCount,
    });
  }
  return schemas;
}

export async function tablePreview(tableName: string, limit = 5): Promise<QueryRow[]> {
  return runQuery(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
}

export async function tableRowCount(tableName: string): Promise<number> {
  const rows = await runQuery(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
  return Number(rows[0]?.cnt ?? 0);
}

export async function dropAllTables(): Promise<void> {
  const schemas = await getSchemas();
  const { conn } = await getDB();
  for (const { name } of schemas) {
    await conn.query(`DROP TABLE IF EXISTS "${name}"`);
  }
}

export async function pasteData(text: string, tableName: string): Promise<TableSchema[]> {
  const { db, conn } = await getDB();
  const csvFile = new File([text], `${tableName}.csv`);
  await db.registerFileHandle(`${tableName}.csv`, csvFile, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
  const safe = tableName.replace(/[^a-zA-Z0-9_]/g, "_");
  await conn.query(`CREATE OR REPLACE TABLE "${safe}" AS SELECT * FROM read_csv_auto('${tableName}.csv', header=true, sample_size=-1)`);
  await coerceDateColumns(safe, conn);
  return getSchemas();
}
