import { Hono } from "hono";
import { handle } from "hono/vercel";
import { app } from "../apps/api/src/routes/index.js";

export const config = { runtime: "nodejs20.x", maxDuration: 30 };

// Mount the Hono app under /api so it matches the frontend's BASE = "/api"
const root = new Hono();
root.route("/api", app);

export default handle(root);
