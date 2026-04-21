import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore.js";
import { api } from "@/lib/api.js";
import { generateId, cn } from "@/lib/utils.js";
import { MessageBubble } from "./MessageBubble.js";
import type { ChatMessage } from "@datachat/shared";

export function ChatPanel() {
  const { messages, addMessage, updateMessage, isQuerying, setIsQuerying, activeConnection } = useStore();
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

      updateMessage(assistantId, {
        content: result.reasoning,
        sql: result.sql,
        rows: result.rows,
      });
    } catch (e) {
      updateMessage(assistantId, { role: "error", error: String(e) });
    } finally {
      setIsQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isQuerying, activeConnection, messages, addMessage, updateMessage, setIsQuerying]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(input); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-holo text-2xl font-bold">DataChat v2</p>
            <p className="text-sm text-[var(--color-text-muted)]">Ask anything about your data</p>
          </div>
        )}
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} onFollowUp={submit} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] p-3 glass">
        <div className={cn(
          "rounded-xl border transition-colors",
          isQuerying ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
          "bg-[var(--color-surface)]",
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isQuerying}
            placeholder="Ask a question about your data… (Ctrl+Enter)"
            rows={2}
            className="w-full resize-none rounded-xl px-3 pt-3 pb-1 text-sm bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <div className="flex items-center justify-end px-3 pb-2">
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || isQuerying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {isQuerying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isQuerying ? "Thinking…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
