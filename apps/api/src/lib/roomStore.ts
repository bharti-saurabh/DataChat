import type { WSContext } from "hono/ws";
import type { CollabUser } from "@datachat/shared";

interface Peer extends CollabUser {
  ws: WSContext;
}

// roomId → Map<userId, Peer>
const rooms = new Map<string, Map<string, Peer>>();

function ensureRoom(roomId: string): Map<string, Peer> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId)!;
}

export function joinRoom(roomId: string, user: CollabUser, ws: WSContext): void {
  ensureRoom(roomId).set(user.id, { ...user, ws });
}

export function leaveRoom(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(userId);
  if (room.size === 0) rooms.delete(roomId);
}

export function getRoomUsers(roomId: string): CollabUser[] {
  return Array.from(rooms.get(roomId)?.values() ?? []).map(({ id, name, color }) => ({ id, name, color }));
}

export function broadcast(roomId: string, msg: object, excludeId?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(msg);
  for (const [id, peer] of room) {
    if (id === excludeId) continue;
    try { peer.ws.send(payload); } catch { /* peer already disconnected */ }
  }
}
