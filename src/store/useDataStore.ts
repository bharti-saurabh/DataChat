import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { TableSchema, ChatMessage, LLMSettings, Toast, DashboardChart, SidebarTab } from "@/types";
import { generateId } from "@/lib/utils";
import { DEFAULT_LLM_SETTINGS } from "@/lib/llm";

export type Theme = "light" | "dark" | "auto";

interface DataState {
  // DB state
  schemas: TableSchema[];
  context: string;
  dbReady: boolean;

  // Suggested questions cache
  suggestedQuestions: string[];
  suggestionsLoading: boolean;

  // Chat
  messages: ChatMessage[];
  isQuerying: boolean;

  // Session
  sessionId: string;
  sessionName: string;

  // UI
  theme: Theme;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  historyOpen: boolean;
  settingsOpen: boolean;
  dashboardOpen: boolean;
  toasts: Toast[];

  // LLM
  llmSettings: LLMSettings;

  // Dashboard
  dashboardCharts: DashboardChart[];

  // Actions
  setSchemas: (schemas: TableSchema[]) => void;
  setContext: (ctx: string) => void;
  setDbReady: (ready: boolean) => void;
  setSuggestedQuestions: (qs: string[]) => void;
  setSuggestionsLoading: (v: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setIsQuerying: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  toggleDashboard: () => void;
  setLLMSettings: (s: Partial<LLMSettings>) => void;
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  newSession: () => void;
  loadSession: (id: string, name: string, context: string, messages: ChatMessage[]) => void;
  addDashboardChart: (chart: DashboardChart) => void;
  removeDashboardChart: (id: string) => void;
}

export const useDataStore = create<DataState>()(
  immer((set) => ({
    schemas: [],
    context: "",
    dbReady: false,
    suggestedQuestions: [],
    suggestionsLoading: false,
    messages: [],
    isQuerying: false,
    sessionId: generateId(),
    sessionName: "New session",
    theme: "auto",
    sidebarOpen: true,
    sidebarTab: "schema",
    historyOpen: false,
    settingsOpen: false,
    dashboardOpen: false,
    toasts: [],
    llmSettings: DEFAULT_LLM_SETTINGS,
    dashboardCharts: [],

    setSchemas: (schemas) => set((s) => { s.schemas = schemas; }),
    setContext: (ctx) => set((s) => { s.context = ctx; }),
    setDbReady: (ready) => set((s) => { s.dbReady = ready; }),
    setSuggestedQuestions: (qs) => set((s) => { s.suggestedQuestions = qs; }),
    setSuggestionsLoading: (v) => set((s) => { s.suggestionsLoading = v; }),
    addMessage: (msg) => set((s) => { s.messages.push(msg); }),
    updateMessage: (id, patch) => set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx !== -1) Object.assign(s.messages[idx], patch);
    }),
    clearMessages: () => set((s) => { s.messages = []; }),
    setIsQuerying: (v) => set((s) => { s.isQuerying = v; }),
    setTheme: (t) => set((s) => { s.theme = t; }),
    toggleSidebar: () => set((s) => { s.sidebarOpen = !s.sidebarOpen; }),
    setSidebarTab: (tab) => set((s) => { s.sidebarTab = tab; }),
    toggleHistory: () => set((s) => { s.historyOpen = !s.historyOpen; }),
    toggleSettings: () => set((s) => { s.settingsOpen = !s.settingsOpen; }),
    toggleDashboard: () => set((s) => { s.dashboardOpen = !s.dashboardOpen; }),
    setLLMSettings: (partial) => set((s) => { Object.assign(s.llmSettings, partial); }),
    addToast: (t) => set((s) => { s.toasts.push({ ...t, id: generateId() }); }),
    removeToast: (id) => set((s) => { s.toasts = s.toasts.filter((t) => t.id !== id); }),
    newSession: () => set((s) => {
      s.sessionId = generateId();
      s.sessionName = "New session";
      s.messages = [];
      s.context = "";
      s.suggestedQuestions = [];
    }),
    loadSession: (id, name, context, messages) => set((s) => {
      s.sessionId = id;
      s.sessionName = name;
      s.context = context;
      s.messages = messages;
      s.schemas = []; // data must be re-loaded
    }),
    addDashboardChart: (chart) => set((s) => { s.dashboardCharts.push(chart); }),
    removeDashboardChart: (id) => set((s) => {
      s.dashboardCharts = s.dashboardCharts.filter((c) => c.id !== id);
    }),
  })),
);
