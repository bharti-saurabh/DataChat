import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { TableSchema, ChatMessage, LLMSettings, Toast, DashboardBlock, SidebarTab } from "@/types";
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
  selectedMessageId?: string;

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
  explorerOpen: boolean;
  toasts: Toast[];

  // LLM
  llmSettings: LLMSettings;

  // Dashboard (Notion blocks)
  dashboardBlocks: DashboardBlock[];

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
  setSelectedMessageId: (id: string) => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  toggleDashboard: () => void;
  toggleExplorer: () => void;
  setLLMSettings: (s: Partial<LLMSettings>) => void;
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  newSession: () => void;
  loadSession: (id: string, name: string, context: string, messages: ChatMessage[]) => void;
  addDashboardBlock: (block: DashboardBlock) => void;
  removeDashboardBlock: (id: string) => void;
  updateDashboardBlock: (id: string, patch: Partial<DashboardBlock>) => void;
  moveDashboardBlock: (id: string, dir: "up" | "down") => void;
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
    selectedMessageId: undefined,
    sessionId: generateId(),
    sessionName: "New session",
    theme: "auto",
    sidebarOpen: true,
    sidebarTab: "schema",
    historyOpen: false,
    settingsOpen: false,
    dashboardOpen: false,
    explorerOpen: false,
    toasts: [],
    llmSettings: DEFAULT_LLM_SETTINGS,
    dashboardBlocks: [],

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
    setSelectedMessageId: (id) => set((s) => { s.selectedMessageId = id; }),
    setTheme: (t) => set((s) => { s.theme = t; }),
    toggleSidebar: () => set((s) => { s.sidebarOpen = !s.sidebarOpen; }),
    setSidebarTab: (tab) => set((s) => { s.sidebarTab = tab; }),
    toggleHistory: () => set((s) => { s.historyOpen = !s.historyOpen; }),
    toggleSettings: () => set((s) => { s.settingsOpen = !s.settingsOpen; }),
    toggleDashboard: () => set((s) => { s.dashboardOpen = !s.dashboardOpen; }),
    toggleExplorer: () => set((s) => { s.explorerOpen = !s.explorerOpen; }),
    setLLMSettings: (partial) => set((s) => { Object.assign(s.llmSettings, partial); }),
    addToast: (t) => set((s) => { s.toasts.push({ ...t, id: generateId() }); }),
    removeToast: (id) => set((s) => { s.toasts = s.toasts.filter((t) => t.id !== id); }),
    newSession: () => set((s) => {
      s.sessionId = generateId();
      s.sessionName = "New session";
      s.messages = [];
      s.context = "";
      s.suggestedQuestions = [];
      s.selectedMessageId = undefined;
    }),
    loadSession: (id, name, context, messages) => set((s) => {
      s.sessionId = id;
      s.sessionName = name;
      s.context = context;
      s.messages = messages;
      s.schemas = [];
      s.selectedMessageId = undefined;
    }),
    addDashboardBlock: (block) => set((s) => {
      // Auto-assign layout if not provided
      const defaultW = block.type === "chart" ? 6 : block.type === "table" ? 12 : block.type === "insights" ? 6 : block.type === "divider" ? 12 : 12;
      const defaultH = block.type === "chart" ? 8 : block.type === "table" ? 6 : block.type === "insights" ? 4 : block.type === "divider" ? 1 : block.type === "heading" ? 2 : 3;
      const maxY = s.dashboardBlocks.reduce((m, b) => Math.max(m, b.layout.y + b.layout.h), 0);
      if (!block.layout) block.layout = { x: 0, y: maxY, w: defaultW, h: defaultH };
      s.dashboardBlocks.push(block);
    }),
    removeDashboardBlock: (id) => set((s) => {
      s.dashboardBlocks = s.dashboardBlocks.filter((b) => b.id !== id);
    }),
    updateDashboardBlock: (id, patch) => set((s) => {
      const idx = s.dashboardBlocks.findIndex((b) => b.id === id);
      if (idx !== -1) Object.assign(s.dashboardBlocks[idx], patch);
    }),
    moveDashboardBlock: (id, dir) => set((s) => {
      const idx = s.dashboardBlocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= s.dashboardBlocks.length) return;
      [s.dashboardBlocks[idx], s.dashboardBlocks[swap]] = [s.dashboardBlocks[swap], s.dashboardBlocks[idx]];
    }),
  })),
);
