import { useState } from "react";
import { Bot, User, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils.js";
import type { ChatMessage } from "@datachat/shared";

interface MessageBubbleProps {
  message: ChatMessage;
  onFollowUp: (q: string) => void;
}

export function MessageBubble({ message, onFollowUp }: MessageBubbleProps) {
  const [sqlOpen, setSqlOpen] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[75%] bg-[var(--color-accent)] rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm text-white whitespace-pre-wrap">{message.question}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-[var(--color-accent)]" />
        </div>
      </div>
    );
  }

  if (!message.content && !message.error && message.role === "assistant") {
    return (
      <div className="flex gap-3">
        <BotAvatar />
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 size={14} className="animate-spin" /> Thinking…
        </div>
      </div>
    );
  }

  if (message.role === "error" || message.error) {
    return (
      <div className="flex gap-3">
        <BotAvatar />
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 px-3 py-2 text-sm text-[var(--color-error)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {message.error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <BotAvatar />
      <div className="flex-1 min-w-0 space-y-3">
        {/* Reasoning */}
        {message.content && (
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{message.content}</p>
        )}

        {/* SQL */}
        {message.sql && (
          <div>
            <button
              onClick={() => setSqlOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors",
                "bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)]",
                "hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
              )}
            >
              <code className="truncate max-w-[280px]">{message.sql.split("\n")[0]}</code>
              {sqlOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {sqlOpen && (
              <pre className="mt-2 p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-cyan)] font-mono overflow-x-auto">
                {message.sql}
              </pre>
            )}
          </div>
        )}

        {/* Result summary */}
        {message.rows && message.rows.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {message.rows.length.toLocaleString()} row{message.rows.length !== 1 ? "s" : ""} returned
          </p>
        )}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-accent-glow)] border border-[var(--color-border-glow)] flex items-center justify-center shrink-0 mt-1">
      <Bot size={14} className="text-[var(--color-accent)]" />
    </div>
  );
}
