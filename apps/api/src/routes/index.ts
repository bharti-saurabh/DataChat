import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./health.js";
import { connections } from "./connections.js";
import { query } from "./query.js";

export const app = new Hono();

app.use("*", cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use("*", logger());

app.route("/health", health);
app.route("/connections", connections);
app.route("/query", query);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});
