import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore.js";
import { api } from "@/lib/api.js";
import { generateId } from "@/lib/utils.js";
import { collabSocket } from "@/lib/ws.js";
import { MessageBubble } from "./MessageBubble.js";
import type { ChatMessage } from "@datachat/shared";

const TYPING_DEBOUNCE = 1_500;

export function ChatPanel() {
  const { messages, addMessage, updateMessage, isQuerying, setIsQuerying, activeConnection, localUser } = useStore();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || isQuerying || !activeConnection) return;
    setInput("");

    const userMsg: ChatMessage = { id: generateId(), role: "user", question: q, content: q, timestamp: Date.now() };
    addMessage(userMsg);

    const assistantId = generateId();
    addMessage({ id: assistantId, role: "assistant", timestamp: Date.now() });
    setIsQuerying(true);

    try {
      const history = messages
        .slice(-8)
        .filter((m) => m.role === "user" || (m.role === "assistant" && m.sql))
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? m.question ?? "" }));

      const result = await api.query.run({ connectionId: activeConnection.id, question: q, history });
      updateMessage(assistantId, { content: result.reasoning, sql: result.sql, rows: result.rows });

      // Broadcast to room peers (fire-and-forget)
      collabSocket.send({
        type: "query_broadcast",
        user: localUser,
        question: q,
        sql: result.sql,
        rowCount: result.rows.length,
      });
    } catch (e) {
      updateMessage(assistantId, { role: "error", error: String(e) });
    } finally {
      setIsQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isQuerying, activeConnection, messages, addMessage, updateMessage, setIsQuerying]);

  const onInputChange = (val: string) => {
    setInput(val);
    // Typing indicator
    collabSocket.send({ type: "typing", userId: localUser.id, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      collabSocket.send({ type: "typing", userId: localUser.id, isTyping: false });
    }, TYPING_DEBOUNCE);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(input); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1rem", textAlign: "center" }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: "linear-gradient(135deg, var(--color-accent-pale), var(--color-cyan-pale))",
                  border: "1px solid var(--color-border-glow)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 24px var(--color-accent-glow)",
                }}
              >
                <Sparkles size={22} style={{ color: "var(--color-accent)" }} />
              </motion.div>
              <div>
                <p className="text-holo" style={{ fontSize: "1.25rem", fontWeight: 600 }}>DataChat v2</p>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  Ask anything about your data
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onFollowUp={submit} />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: "1px solid var(--color-border)",
        padding: "0.75rem 1rem",
        background: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          borderRadius: "0.875rem",
          border: `1px solid ${isQuerying ? "var(--color-accent)" : "var(--color-border)"}`,
          background: "var(--color-surface-2)",
          boxShadow: isQuerying ? "0 0 0 3px var(--color-accent-pale)" : "none",
          transition: "border-color var(--duration-normal), box-shadow var(--duration-normal)",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isQuerying}
            placeholder="Ask a question about your data…  Ctrl+Enter to send"
            rows={2}
            style={{
              width: "100%", resize: "none", background: "transparent",
              padding: "0.75rem 1rem 0.25rem",
              fontSize: "0.875rem", fontFamily: "var(--font-sans)",
              color: "var(--color-text-primary)", outline: "none",
              borderRadius: "0.875rem 0.875rem 0 0",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0.375rem 0.75rem 0.625rem" }}>
            <motion.button
              onClick={() => submit(input)}
              disabled={!input.trim() || isQuerying}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.4rem 0.875rem", borderRadius: "0.5rem",
                background: input.trim() && !isQuerying ? "var(--color-accent)" : "var(--color-surface-3)",
                color: input.trim() && !isQuerying ? "#fff" : "var(--color-text-muted)",
                fontSize: "0.8rem", fontWeight: 500, border: "none", cursor: input.trim() && !isQuerying ? "pointer" : "not-allowed",
                transition: "background var(--duration-normal), color var(--duration-normal), box-shadow var(--duration-normal)",
                boxShadow: input.trim() && !isQuerying ? "0 0 12px var(--color-accent-glow)" : "none",
              }}
            >
              {isQuerying ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
              {isQuerying ? "Thinking" : "Ask"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
