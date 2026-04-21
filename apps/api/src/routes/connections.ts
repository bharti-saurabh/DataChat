import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createAdapter } from "../lib/db/index.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { store } from "../lib/connectionStore.js";
import type { ConnectionConfig } from "@datachat/shared";

export const connections = new Hono();

const connectionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  type: z.enum(["postgres", "mysql", "sqlite", "bigquery", "snowflake"]),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
  connectionString: z.string().optional(),
});

connections.get("/", (c) => {
  const list = Array.from(store.entries()).map(([id, enc]) => {
    const cfg = JSON.parse(decrypt(enc)) as ConnectionConfig;
    return { id, label: cfg.label, type: cfg.type };
  });
  return c.json(list);
});

connections.post("/", zValidator("json", connectionSchema), async (c) => {
  const body = c.req.valid("json") as ConnectionConfig;
  const id = body.id ?? crypto.randomUUID();
  store.set(id, encrypt(JSON.stringify(body)));
  return c.json({ id }, 201);
});

connections.post("/:id/test", async (c) => {
  const enc = store.get(c.req.param("id"));
  if (!enc) return c.json({ error: "Not found" }, 404);
  const cfg = JSON.parse(decrypt(enc)) as ConnectionConfig;
  try {
    const adapter = createAdapter(cfg);
    await adapter.connect();
    const ok = await adapter.testConnection();
    await adapter.disconnect();
    return c.json({ ok });
  } catch (e) {
    return c.json({ ok: false, error: String(e) });
  }
});

connections.delete("/:id", (c) => {
  store.delete(c.req.param("id"));
  return c.json({ deleted: true });
});
