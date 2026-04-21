import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChatMessage, ConnectionMeta, DashboardChart, TableSchema } from "@datachat/shared";

interface State {
  // Active DB connection
  activeConnection: ConnectionMeta | null;
  setActiveConnection: (c: ConnectionMeta | null) => void;

  // Schema for the active connection
  schema: TableSchema[];
  setSchema: (schema: TableSchema[]) => void;

  // Chat messages for the current session
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Dashboard
  dashboardCharts: DashboardChart[];
  addDashboardChart: (chart: DashboardChart) => void;
  removeDashboardChart: (id: string) => void;

  // Loading
  isQuerying: boolean;
  setIsQuerying: (v: boolean) => void;

  // Toasts
  addToast?: (t: { variant: "success" | "error" | "warning"; title: string; message?: string }) => void;
}

export const useStore = create<State>()(
  immer((set) => ({
    activeConnection: null,
    setActiveConnection: (c) => set((s) => { s.activeConnection = c; }),

    schema: [],
    setSchema: (schema) => set((s) => { s.schema = schema; }),

    messages: [],
    addMessage: (msg) => set((s) => { s.messages.push(msg); }),
    updateMessage: (id, patch) =>
      set((s) => {
        const idx = s.messages.findIndex((m: ChatMessage) => m.id === id);
        if (idx !== -1) Object.assign(s.messages[idx], patch);
      }),
    clearMessages: () => set((s) => { s.messages = []; }),

    dashboardCharts: [],
    addDashboardChart: (chart) => set((s) => { s.dashboardCharts.push(chart); }),
    removeDashboardChart: (id) =>
      set((s) => { s.dashboardCharts = s.dashboardCharts.filter((c: DashboardChart) => c.id !== id); }),

    isQuerying: false,
    setIsQuerying: (v) => set((s) => { s.isQuerying = v; }),

    addToast: (t) => { console.info(`[toast] ${t.variant}: ${t.title}`, t.message ?? ""); },
  })),
);
