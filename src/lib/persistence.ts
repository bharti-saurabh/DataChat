import Dexie, { type Table } from "dexie";
import type { ChatMessage, LLMSettings } from "@/types";

export interface SavedSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  context: string;
  messages: ChatMessage[];
  messageCount: number;
}

export interface QueryHistoryItem {
  id: string;
  sessionId: string;
  question: string;
  sql: string;
  rowCount: number;
  timestamp: number;
  pinned: boolean;
}

class DataChatDB extends Dexie {
  sessions!: Table<SavedSession, string>;
  queryHistory!: Table<QueryHistoryItem, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("datachat");
    this.version(2).stores({
      sessions: "id, name, createdAt, updatedAt, messageCount",
      queryHistory: "id, sessionId, timestamp, pinned",
      settings: "key",
    });
  }
}

export const dexieDB = new DataChatDB();

// ── LLM settings ──────────────────────────────────────────────────────────────
export async function saveLLMSettings(settings: LLMSettings) {
  await dexieDB.settings.put({ key: "llmSettings", value: settings });
}

export async function loadLLMSettings(): Promise<LLMSettings | null> {
  const rec = await dexieDB.settings.get("llmSettings");
  return rec ? (rec.value as LLMSettings) : null;
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function upsertSession(session: Omit<SavedSession, "messageCount"> & { messages: ChatMessage[] }) {
  const existing = await dexieDB.sessions.get(session.id);
  await dexieDB.sessions.put({
    ...session,
    messageCount: session.messages.length,
    createdAt: existing?.createdAt ?? session.updatedAt,
  });
}

export async function loadSessions(): Promise<SavedSession[]> {
  return dexieDB.sessions.orderBy("updatedAt").reverse().toArray();
}

export async function deleteSession(id: string) {
  await dexieDB.sessions.delete(id);
  await dexieDB.queryHistory.where("sessionId").equals(id).delete();
}

// ── Query history ─────────────────────────────────────────────────────────────
export async function addQueryHistory(item: QueryHistoryItem) {
  await dexieDB.queryHistory.put(item);
}

export async function loadQueryHistory(sessionId?: string): Promise<QueryHistoryItem[]> {
  if (sessionId) {
    return dexieDB.queryHistory.where("sessionId").equals(sessionId).reverse().sortBy("timestamp");
  }
  return dexieDB.queryHistory.orderBy("timestamp").reverse().toArray();
}

export async function togglePinQuery(id: string) {
  const item = await dexieDB.queryHistory.get(id);
  if (item) await dexieDB.queryHistory.update(id, { pinned: !item.pinned });
}

export async function deleteQueryHistory(id: string) {
  await dexieDB.queryHistory.delete(id);
}
