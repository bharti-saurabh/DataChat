// Shared in-memory store for the scaffold.
// Replace with a database-backed store (e.g. Postgres, SQLite) in production.
export const store = new Map<string, string>(); // id → encrypted config JSON
