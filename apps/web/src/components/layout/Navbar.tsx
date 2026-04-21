import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore.js";
import { PresenceBar } from "@/components/collaboration/PresenceBar.js";
import { SessionShare } from "@/components/collaboration/SessionShare.js";

const DB_COLORS: Record<string, string> = {
  postgres:  "#3b82f6",
  mysql:     "#f59e0b",
  sqlite:    "#22d3ee",
  bigquery:  "#34d399",
  snowflake: "#a78bfa",
};

const breadcrumbs: Record<string, { label: string; sub?: string }> = {
  "/chat":        { label: "Chat",        sub: "natural language queries" },
  "/dashboard":   { label: "Dashboard",   sub: "pinned charts" },
  "/connections": { label: "Connections", sub: "database sources" },
  "/settings":    { label: "Settings" },
};

export function Navbar() {
  const { pathname } = useLocation();
  const activeConnection = useStore((s) => s.activeConnection);
  const crumb = breadcrumbs[pathname] ?? { label: "DataChat" };

  return (
    <header style={{
      height: 48,
      display: "flex", alignItems: "center",
      paddingInline: "1.25rem", gap: "0.75rem",
      borderBottom: "1px solid var(--color-border)",
      background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
      backdropFilter: "blur(16px)",
      flexShrink: 0, position: "relative", zIndex: 9,
    }}>
      {/* Page title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.625rem" }}>
        <span className="text-holo" style={{ fontSize: "0.9rem", fontWeight: 600 }}>{crumb.label}</span>
        {crumb.sub && (
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", letterSpacing: "0.04em" }}>
            {crumb.sub}
          </span>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Presence avatars */}
      <PresenceBar />

      {/* Room share pill */}
      {pathname === "/chat" && <SessionShare />}

      {/* Active connection pill */}
      <AnimatePresence>
        {activeConnection && (
          <motion.div
            key={activeConnection.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.2rem 0.625rem", borderRadius: 9999,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              fontSize: "0.75rem", color: "var(--color-text-secondary)",
            }}
          >
            <span style={{ position: "relative", width: 6, height: 6 }}>
              <span style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: DB_COLORS[activeConnection.type] ?? "var(--color-success)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }} />
            </span>
            <span>{activeConnection.label}</span>
            <span style={{
              padding: "0 0.375rem", borderRadius: 4,
              background: "var(--color-surface-3)",
              fontSize: "0.65rem", letterSpacing: "0.06em",
              color: DB_COLORS[activeConnection.type] ?? "var(--color-text-muted)",
              fontWeight: 500,
            }}>
              {activeConnection.type.toUpperCase()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
