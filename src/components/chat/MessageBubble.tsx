import { useState } from "react";
import { User, Bot, AlertCircle, ChevronDown, ChevronUp, Loader2, BarChart2, Table2, Lightbulb } from "lucide-react";
import { Marked } from "marked";
import type { Tokens } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import type { ChatMessage } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { ClarifyingQuestions } from "@/components/chat/ClarifyingQuestions";
import { useDataStore } from "@/store/useDataStore";
import { cn } from "@/lib/utils";

// ── Marked setup ──────────────────────────────────────────────────────────────
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

marked.use({
  renderer: {
    table(token: Tokens.Table) {
      const headers = token.header
        .map((cell, i) => {
          const align = token.align[i];
          return `<th class="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-medium"${align ? ` style="text-align:${align}"` : ""}>${cell.text}</th>`;
        })
        .join("");
      const rows = token.rows
        .map((row) => {
          const cells = row
            .map((cell, i) => {
              const align = token.align[i];
              return `<td class="border border-gray-300 dark:border-gray-600 px-2 py-1"${align ? ` style="text-align:${align}"` : ""}>${cell.text}</td>`;
            })
            .join("");
          return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">${cells}</tr>`;
        })
        .join("");
      return `<div class="overflow-x-auto my-2"><table class="w-full text-sm border-collapse"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  },
});

// ── Props ─────────────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ChatMessage;
  onClarifiedSubmit: (enrichedQuestion: string) => void;
  onFollowUp: (question: string) => void;
}

// ── Output summary badges ─────────────────────────────────────────────────────
function OutputBadges({ message }: { message: ChatMessage }) {
  const badges: { icon: React.ReactNode; label: string; color: string }[] = [];
  if (message.autoChartConfig || message.autoChartLoading)
    badges.push({ icon: <BarChart2 size={10} />, label: "Chart", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400" });
  if (message.result && message.result.length > 0)
    badges.push({ icon: <Table2 size={10} />, label: `${message.result.length} rows`, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 dark:text-cyan-400" });
  if (message.insights || message.insightsLoading)
    badges.push({ icon: <Lightbulb size={10} />, label: "Insights", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400" });
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {badges.map((b, i) => (
        <span key={i} className={cn("flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md", b.color)}>
          {b.icon}{b.label}
        </span>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MessageBubble({ message, onClarifiedSubmit, onFollowUp }: MessageBubbleProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const { selectedMessageId, setSelectedMessageId } = useDataStore();
  const isSelected = selectedMessageId === message.id;

  // ── User bubble ──────────────────────────────────────────────────────────
  if (message.role === "user") {
    return (
      <div className="flex gap-2.5 justify-end">
        <div className="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.question}</p>
          <p className="text-[10px] text-indigo-300 mt-1 text-right">{formatRelativeTime(message.timestamp)}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0 mt-1">
          <User size={13} className="text-indigo-600" />
        </div>
      </div>
    );
  }

  // ── Clarifying questions bubble ──────────────────────────────────────────
  if (message.role === "clarifying") {
    return (
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
          <Bot size={13} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <ClarifyingQuestions
            questions={message.clarifyingQuestions ?? []}
            originalQuestion={message.question ?? ""}
            onSubmit={onClarifiedSubmit}
            onSkip={() => onClarifiedSubmit(message.question ?? "")}
          />
          <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(message.timestamp)}</p>
        </div>
      </div>
    );
  }

  // ── Assistant loading ────────────────────────────────────────────────────
  if (!message.content && !message.error) {
    return (
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
          <Bot size={13} className="text-gray-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Thinking…
        </div>
      </div>
    );
  }

  const htmlContent = message.content ? (marked.parse(message.content) as string) : "";

  // ── Assistant bubble ─────────────────────────────────────────────────────
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
        <Bot size={13} className="text-gray-500" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Clickable card — selects this message in output panel */}
        <button
          onClick={() => setSelectedMessageId(message.id)}
          className={cn(
            "w-full text-left rounded-xl border px-3.5 py-2.5 transition-all",
            isSelected
              ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-sm"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          )}
        >
          {/* Error */}
          {message.error ? (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span className="text-xs">{message.error}</span>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSelected ? "Showing in output panel →" : "Click to view output →"}
            </p>
          )}

          {/* Output badges */}
          {(message.autoChartConfig || message.autoChartLoading || message.result?.length || message.insights || message.insightsLoading) && (
            <OutputBadges message={message} />
          )}
        </button>

        {/* Reasoning (collapsible) */}
        {message.content && (
          <div className="mt-1.5">
            <button
              onClick={() => setReasoningOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {reasoningOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {reasoningOpen ? "Hide reasoning" : "Show reasoning"}
            </button>
            {reasoningOpen && (
              <div
                className="prose-sql text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 mt-1.5 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}
          </div>
        )}

        {/* Follow-up chips (inline in chat) */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.suggestions.map((s) => (
              <button key={s} onClick={() => onFollowUp(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-gray-900">
                {s}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1.5">{formatRelativeTime(message.timestamp)}</p>
      </div>
    </div>
  );
}
