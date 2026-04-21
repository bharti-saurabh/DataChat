import { useState } from "react";
import { User, Bot, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Marked } from "marked";
import type { Tokens } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import type { ChatMessage } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { ResultsTable } from "@/components/results/ResultsTable";
import { SQLEditorPopup } from "@/components/chat/SQLEditorPopup";
import { InsightsCard } from "@/components/chat/InsightsCard";
import { ChartDisplay } from "@/components/chat/ChartDisplay";
import { ClarifyingQuestions } from "@/components/chat/ClarifyingQuestions";
import { FollowUpChips } from "@/components/chat/FollowUpChips";

// ── Marked setup ─────────────────────────────────────────────────────────────
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
  onChartCodeUpdate: (id: string, code: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MessageBubble({ message, onClarifiedSubmit, onFollowUp, onChartCodeUpdate }: MessageBubbleProps) {
  const [sqlOpen, setSqlOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  // ── User bubble ──────────────────────────────────────────────────────────
  if (message.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.question}</p>
          <p className="text-[10px] text-blue-200 mt-1 text-right">{formatRelativeTime(message.timestamp)}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 mt-1">
          <User size={14} className="text-blue-600" />
        </div>
      </div>
    );
  }

  // ── Clarifying questions bubble ──────────────────────────────────────────
  if (message.role === "clarifying") {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
          <Bot size={14} className="text-gray-500" />
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

  // ── Assistant loading (skeleton) ─────────────────────────────────────────
  if (!message.content && !message.error && !message.autoChartLoading) {
    return (
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
          <Bot size={14} className="text-gray-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Thinking…
        </div>
      </div>
    );
  }

  const htmlContent = message.content ? (marked.parse(message.content) as string) : "";

  // ── Assistant full bubble ────────────────────────────────────────────────
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-1">
        <Bot size={14} className="text-gray-500" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Error */}
        {message.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{message.error}</span>
          </div>
        )}

        {/* 1. Chart FIRST */}
        <ChartDisplay
          chartCode={message.autoChartCode}
          chartLoading={message.autoChartLoading}
          data={message.result ?? []}
          question={message.question}
          insights={message.insights}
          messageId={message.id}
          onRegenerate={(code) => onChartCodeUpdate(message.id, code)}
        />

        {/* 2. Insights */}
        <InsightsCard insights={message.insights} loading={message.insightsLoading} />

        {/* 3. LLM reasoning (collapsible) */}
        {message.content && (
          <div>
            <button
              onClick={() => setReasoningOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-1"
            >
              {reasoningOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {reasoningOpen ? "Hide reasoning" : "Show reasoning"}
            </button>
            {reasoningOpen && (
              <div
                className="prose-sql text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            )}
          </div>
        )}

        {/* 4. SQL pill */}
        {message.sql && (
          <div>
            <button
              onClick={() => setSqlOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors max-w-full"
            >
              <code className="truncate max-w-[300px]">{message.sql.split("\n")[0]}</code>
              {sqlOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {sqlOpen && <SQLEditorPopup sql={message.sql} onClose={() => setSqlOpen(false)} />}
          </div>
        )}

        {/* 5. Results table */}
        {message.result && message.result.length > 0 && (
          <ResultsTable data={message.result} question={message.question} />
        )}
        {message.result && message.result.length === 0 && !message.error && (
          <p className="text-sm text-gray-500 italic">No results found.</p>
        )}

        {/* 6. Follow-up chips */}
        {message.suggestions && message.suggestions.length > 0 && (
          <FollowUpChips suggestions={message.suggestions} onSelect={onFollowUp} />
        )}

        <p className="text-[10px] text-gray-400">{formatRelativeTime(message.timestamp)}</p>
      </div>
    </div>
  );
}
