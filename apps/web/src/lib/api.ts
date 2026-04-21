
import type { ConnectionConfig, ConnectionMeta, QueryResult, TableSchema, InsightResult } from "@datachat/shared";
const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Connections ────────────────────────────────────────────────────────────
export const api = {
  connections: {
    list: () => request<ConnectionMeta[]>("/connections"),
    create: (cfg: ConnectionConfig) =>
      request<{ id: string }>("/connections", { method: "POST", body: JSON.stringify(cfg) }),
    test: (id: string) => request<{ ok: boolean; error?: string }>(`/connections/${id}/test`, { method: "POST" }),
    delete: (id: string) => request<{ deleted: boolean }>(`/connections/${id}`, { method: "DELETE" }),
  },

  schema: {
    get: (connectionId: string) => request<TableSchema[]>(`/connections/${connectionId}/schema`),
  },

  query: {
    run: (payload: {
      connectionId: string;
      question: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => request<QueryResult>("/query", { method: "POST", body: JSON.stringify(payload) }),
  },

  insights: {
  analyze: (payload: { question: string; sql?: string; rows: Record<string, unknown>[] }) =>
    request<InsightResult>("/insights", { method: "POST", body: JSON.stringify(payload) }),
  },
  health: {
    check: () => request<{ status: string; version: string }>("/health"),
  },
};
