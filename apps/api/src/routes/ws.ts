import type { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket } from "ws";
import { joinRoom, leaveRoom, broadcast, getRoomUsers } from "../lib/roomStore.js";
import type { CollabUser, CollabClientMsg, CollabServerMsg } from "@datachat/shared";

// UpgradeWebSocket generic differs between adapters — use a wide function type
type AnyUpgradeWebSocket = UpgradeWebSocket<WebSocket>;

export function registerWsRoutes(app: Hono, upgradeWebSocket: AnyUpgradeWebSocket) {
  app.get(
    "/ws/:roomId",
    upgradeWebSocket((c) => {
      const roomId = c.req.param("roomId") ?? "default";
      let currentUser: CollabUser | null = null;

      return {
        onOpen(_event, _ws) {
          // Identity is established on the first "join" message
        },

        onMessage(event, ws) {
          let msg: CollabClientMsg;
          try { msg = JSON.parse(String(event.data)) as CollabClientMsg; }
          catch { return; }

          if (msg.type === "join") {
            currentUser = msg.user;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            joinRoom(roomId, currentUser, ws as any);

            const welcome: CollabServerMsg = {
              type: "welcome",
              users: getRoomUsers(roomId),
              roomId,
            };
            ws.send(JSON.stringify(welcome));
            broadcast(roomId, { type: "user_joined", user: currentUser } satisfies CollabServerMsg, currentUser.id);
            return;
          }

          if (!currentUser) return;

          if (msg.type === "query_broadcast") {
            const out: CollabServerMsg = {
              type: "query_broadcast",
              fromUser: currentUser,
              question: msg.question,
              sql: msg.sql,
              rowCount: msg.rowCount,
            };
            broadcast(roomId, out, currentUser.id);
            return;
          }

          if (msg.type === "typing") {
            broadcast(roomId, {
              type: "typing",
              userId: msg.userId,
              isTyping: msg.isTyping,
            } satisfies CollabServerMsg, msg.userId);
          }
        },

        onClose() {
          if (!currentUser) return;
          leaveRoom(roomId, currentUser.id);
          broadcast(roomId, { type: "user_left", userId: currentUser.id } satisfies CollabServerMsg);
        },

        onError() {
          if (!currentUser) return;
          leaveRoom(roomId, currentUser.id);
        },
      };
    }),
  );
}
