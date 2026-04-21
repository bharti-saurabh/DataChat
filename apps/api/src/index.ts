import "dotenv/config";
import { serve, upgradeWebSocket } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { app } from "./routes/index.js";
import { registerWsRoutes } from "./routes/ws.js";

const port = Number(process.env.PORT ?? 3001);
const wss  = new WebSocketServer({ noServer: true });

registerWsRoutes(app, upgradeWebSocket);

serve({ fetch: app.fetch, port, websocket: { server: wss } }, () => {
  console.log(`DataChat API running on http://localhost:${port}`);
});
