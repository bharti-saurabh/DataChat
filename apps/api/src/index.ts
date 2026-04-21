import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./routes/index.js";

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`DataChat API running on http://localhost:${port}`);
});
