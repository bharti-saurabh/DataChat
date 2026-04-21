import { motion } from "framer-motion";
import { useStore } from "@/store/useStore.js";
import { ChatPanel } from "@/components/chat/ChatPanel.js";
import { Database, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ChatPage() {
  const activeConnection = useStore((s) => s.activeConnection);

  if (!activeConnection) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1.5rem", textAlign: "center", padding: "2rem" }}>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 56, height: 56, borderRadius: 18,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 32px var(--color-accent-glow)",
          }}
        >
          <Database size={24} style={{ color: "var(--color-accent)" }} />
        </motion.div>

        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>No connection active</h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>
            Connect to a database to start chatting with your data.
          </p>
        </div>

        <Link to="/connections" style={{ textDecoration: "none" }}>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary"
            style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center" }}
          >
            Manage connections <ArrowRight size={14} />
          </motion.div>
        </Link>
      </div>
    );
  }

  return <ChatPanel />;
}
