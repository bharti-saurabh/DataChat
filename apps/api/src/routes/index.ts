import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./health.js";
import { connections } from "./connections.js";
import { query } from "./query.js";
import { insights } from "./insights.js";

export const app = new Hono();

const allowedOrigins = [
  "http://localhost:5173",
  "https://bharti-saurabh.github.io",
  ...(process.env.WEB_ORIGIN ? [process.env.WEB_ORIGIN] : []),
];
app.use("*", cors({ origin: (o) => (allowedOrigins.includes(o) ? o : allowedOrigins[0]) }));
app.use("*", logger());

app.route("/health", health);
app.route("/connections", connections);
app.route("/query", query);
app.route("/insights", insights);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});
