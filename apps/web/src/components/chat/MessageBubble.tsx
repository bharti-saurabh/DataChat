import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, User, AlertCircle, ChevronDown, ChevronUp, TableIcon } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { ChartPanel } from "@/components/visualizations/ChartPanel.js";
import type { ChatMessage } from "@datachat/shared";

interface MessageBubbleProps {
  message: ChatMessage;
  onFollowUp: (q: string) => void;
}

const bubbleVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const [sqlOpen, setSqlOpen] = useState(false);

  /* ── Remote user (from a collaborating peer) ── */
  if (message.role === "user" && message.authorId) {
    const color = message.authorColor ?? "var(--color-accent)";
    return (
      <motion.div className="flex gap-3" {...bubbleVariants}>
        {/* Peer avatar */}
        <div title={message.authorName} style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 4,
          background: color + "22", border: `2px solid ${color}99`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.6rem", fontWeight: 700, color,
        }}>
          {(message.authorName ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ maxWidth: "72%" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
            {message.authorName}
          </p>
          <div style={{
            background: color + "18", border: `1px solid ${color}33`,
            borderRadius: "0.25rem 1rem 1rem 1rem",
            padding: "0.5rem 0.875rem",
          }}>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-primary)", lineHeight: 1.55 }}>
              {message.question}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Local user ── */
  if (message.role === "user") {
    return (
      <motion.div className="flex gap-3 justify-end" {...bubbleVariants}>
        <div style={{
          maxWidth: "72%",
          background: "linear-gradient(135deg, var(--color-accent-dim) 0%, var(--color-accent) 100%)",
          borderRadius: "1rem 1rem 0.25rem 1rem",
          padding: "0.625rem 1rem",
          boxShadow: "0 2px 16px var(--color-accent-glow)",
        }}>
          <p style={{ fontSize: "0.875rem", color: "#fff", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
            {message.question}
          </p>
        </div>
        <Avatar role="user" />
      </motion.div>
    );
  }

  /* ── Thinking ── */
  if (!message.content && !message.error && message.role === "assistant") {
    return (
      <motion.div className="flex gap-3" {...bubbleVariants}>
        <Avatar role="assistant" />
        <div style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.625rem 0.875rem",
          borderRadius: "0.25rem 1rem 1rem 1rem",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}>
          <div className="thinking-dot" />
          <div className="thinking-dot" />
          <div className="thinking-dot" />
        </div>
      </motion.div>
    );
  }

  /* ── Error ── */
  if (message.role === "error" || message.error) {
    return (
      <motion.div className="flex gap-3" {...bubbleVariants}>
        <Avatar role="assistant" />
        <div style={{
          display: "flex", alignItems: "flex-start", gap: "0.5rem",
          padding: "0.625rem 0.875rem",
          borderRadius: "0.25rem 1rem 1rem 1rem",
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.2)",
          fontSize: "0.875rem",
          color: "var(--color-error)",
          maxWidth: "80%",
        }}>
          <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          {message.error}
        </div>
      </motion.div>
    );
  }

  /* ── Assistant ── */
  return (
    <motion.div className="flex gap-3" {...bubbleVariants}>
      <Avatar role="assistant" />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>

        {/* Reasoning text */}
        {message.content && (
          <div style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.25rem 1rem 1rem 1rem",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
          }}>
            {message.content}
          </div>
        )}

        {/* SQL pill */}
        {message.sql && (
          <div>
            <button
              onClick={() => setSqlOpen((v) => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.3rem 0.75rem",
                borderRadius: 9999,
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                color: "var(--color-cyan)",
                transition: "border-color var(--duration-normal)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-cyan)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            >
              <code style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {message.sql.split("\n")[0]}
              </code>
              {sqlOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {sqlOpen && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  marginTop: "0.375rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.625rem",
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-cyan)",
                  overflowX: "auto",
                  lineHeight: 1.7,
                }}
              >
                {message.sql}
              </motion.pre>
            )}
          </div>
        )}

        {/* Chart */}
        {message.rows && message.rows.length > 0 && (
          <ChartPanel rows={message.rows} question={message.question} />
        )}

        {/* Row count badge */}
        {message.rows && message.rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <TableIcon size={12} style={{ color: "var(--color-text-muted)" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              {message.rows.length.toLocaleString()} row{message.rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 4,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: role === "user"
        ? "var(--color-accent-pale)"
        : "linear-gradient(135deg, var(--color-accent-pale), var(--color-cyan-pale))",
      border: "1px solid",
      borderColor: role === "user" ? "var(--color-accent-dim)" : "var(--color-border-glow)",
    }}>
      {role === "user"
        ? <User size={13} style={{ color: "var(--color-accent)" }} />
        : <Bot  size={13} style={{ color: "var(--color-cyan)" }} />
      }
    </div>
  );
}
