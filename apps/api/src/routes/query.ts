import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createAdapter } from "../lib/db/index.js";
import { decrypt } from "../lib/crypto.js";
import { generateSQL } from "../lib/llm.js";
import type { ConnectionConfig } from "@datachat/shared";

// Reuse the same in-memory store as connections route (extract to shared service in production)
import { store as connectionStore } from "../lib/connectionStore.js";

export const query = new Hono();

const querySchema = z.object({
  connectionId: z.string(),
  question: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
});

query.post("/", zValidator("json", querySchema), async (c) => {
  const { connectionId, question, history } = c.req.valid("json");

  const enc = connectionStore.get(connectionId);
  if (!enc) return c.json({ error: "Connection not found" }, 404);

  const cfg = JSON.parse(decrypt(enc)) as ConnectionConfig;
  const adapter = createAdapter(cfg);

  try {
    await adapter.connect();
    const schema = await adapter.getSchema();

    const { sql, reasoning } = await generateSQL({ question, schema, history });

    const result = await adapter.query(sql);
    await adapter.disconnect();

    return c.json({ sql, reasoning, rows: result.rows, rowCount: result.rowCount, fields: result.fields });
  } catch (e) {
    await adapter.disconnect().catch(() => {});
    return c.json({ error: String(e) }, 500);
  }
});
