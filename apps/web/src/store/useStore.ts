import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChatMessage, ConnectionMeta, DashboardChart, TableSchema, CollabUser } from "@datachat/shared";
import { PALETTE } from "@/components/visualizations/lib/colors.js";

// ── Stable local user identity ─────────────────────────────────────────────
function getOrCreateLocalUser(): CollabUser {
  const stored = localStorage.getItem("datachat_user");
  if (stored) return JSON.parse(stored) as CollabUser;

  const id    = crypto.randomUUID();
  const idx   = id.charCodeAt(0) % PALETTE.length;
  const color = PALETTE[idx];
  const name  = `Guest-${id.slice(0, 4).toUpperCase()}`;
  const user: CollabUser = { id, name, color };
  localStorage.setItem("datachat_user", JSON.stringify(user));
  return user;
}

function getOrCreateRoomId(): string {
  const key = "datachat_room";
  let id = sessionStorage.getItem(key);
  if (!id) { id = crypto.randomUUID().slice(0, 8); sessionStorage.setItem(key, id); }
  return id;
}

// ── State shape ────────────────────────────────────────────────────────────
interface State {
  // Connection
  activeConnection: ConnectionMeta | null;
  setActiveConnection: (c: ConnectionMeta | null) => void;

  // Schema
  schema: TableSchema[];
  setSchema: (schema: TableSchema[]) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Dashboard
  dashboardCharts: DashboardChart[];
  addDashboardChart: (chart: DashboardChart) => void;
  removeDashboardChart: (id: string) => void;

  // Querying
  isQuerying: boolean;
  setIsQuerying: (v: boolean) => void;

  // Toasts
  addToast?: (t: { variant: "success" | "error" | "warning"; title: string; message?: string }) => void;

  // Collaboration
  localUser: CollabUser;
  roomId: string;
  collabUsers: CollabUser[];          // remote peers currently in the room
  typingUsers: string[];              // userIds currently typing
  setCollabUsers: (users: CollabUser[]) => void;
  addCollabUser: (user: CollabUser) => void;
  removeCollabUser: (userId: string) => void;
  setTypingUsers: (fn: (prev: string[]) => string[]) => void;
  setRoomId: (id: string) => void;
  updateLocalUser: (patch: Partial<Pick<CollabUser, "name">>) => void;
}

export const useStore = create<State>()(
  immer((set) => ({
    // Connection
    activeConnection: null,
    setActiveConnection: (c) => set((s) => { s.activeConnection = c; }),

    // Schema
    schema: [],
    setSchema: (schema) => set((s) => { s.schema = schema; }),

    // Chat
    messages: [],
    addMessage: (msg) => set((s) => { s.messages.push(msg); }),
    updateMessage: (id, patch) =>
      set((s) => {
        const idx = s.messages.findIndex((m: ChatMessage) => m.id === id);
        if (idx !== -1) Object.assign(s.messages[idx], patch);
      }),
    clearMessages: () => set((s) => { s.messages = []; }),

    // Dashboard
    dashboardCharts: [],
    addDashboardChart: (chart) => set((s) => { s.dashboardCharts.push(chart); }),
    removeDashboardChart: (id) =>
      set((s) => { s.dashboardCharts = s.dashboardCharts.filter((c: DashboardChart) => c.id !== id); }),

    // Querying
    isQuerying: false,
    setIsQuerying: (v) => set((s) => { s.isQuerying = v; }),

    // Toasts
    addToast: (t) => { console.info(`[toast] ${t.variant}: ${t.title}`, t.message ?? ""); },

    // Collaboration
    localUser: getOrCreateLocalUser(),
    roomId:    getOrCreateRoomId(),
    collabUsers: [],
    typingUsers: [],
    setCollabUsers: (users) => set((s) => { s.collabUsers = users; }),
    addCollabUser: (user) =>
      set((s) => {
        if (!s.collabUsers.find((u: CollabUser) => u.id === user.id)) s.collabUsers.push(user);
      }),
    removeCollabUser: (userId) =>
      set((s) => { s.collabUsers = s.collabUsers.filter((u: CollabUser) => u.id !== userId); }),
    setTypingUsers: (fn) => set((s) => { s.typingUsers = fn(s.typingUsers); }),
    setRoomId: (id) => set((s) => {
      s.roomId = id;
      sessionStorage.setItem("datachat_room", id);
    }),
    updateLocalUser: (patch) => set((s) => {
      Object.assign(s.localUser, patch);
      localStorage.setItem("datachat_user", JSON.stringify(s.localUser));
    }),
  })),
);
