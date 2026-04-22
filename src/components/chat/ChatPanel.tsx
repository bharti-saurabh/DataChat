import { useRef, useEffect, useCallback, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { generateId, extractSQL } from "@/lib/utils";
import { addQueryHistory, upsertSession } from "@/lib/persistence";
import { checkClarification, generateFollowUps, generateInsights } from "@/lib/clarify";
import { generateChartConfig } from "@/lib/chartGen";
import type { ChatMessage } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { OutputPanel } from "@/components/output/OutputPanel";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const {
    messages, isQuerying, schemas, context, suggestedQuestions, suggestionsLoading,
    sessionId, sessionName, addMessage, updateMessage, setIsQuerying, addToast, llmSettings,
    setSelectedMessageId,
  } = useDataStore();

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length) return;
    const firstQuestion = messages.find((m) => m.role === "user")?.question ?? "Untitled";
    const name = firstQuestion.length > 50 ? firstQuestion.slice(0, 50) + "…" : firstQuestion;
    upsertSession({ id: sessionId, name, context, messages, updatedAt: Date.now(), createdAt: Date.now() }).catch(() => {});
  }, [messages, sessionId, context, sessionName]);

  const executeQuery = useCallback(async (question: string) => {
    const db = await getDB();
    const schemaSQL = schemas.map((s) => s.sql).join("\n\n");
    const priorContext = messages
      .slice(-8)
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.sql))
      .map((m) => (m.role === "user" ? `User asked: ${m.question}` : `SQL used: ${m.sql}`))
      .join("\n");

    const systemPrompt = `You are an expert SQLite query writer. The user has a SQLite dataset.

${context ? `Context about the dataset:\n${context}\n` : ""}
SQLite schema:
${schemaSQL}

${priorContext ? `Prior conversation:\n${priorContext}\n` : ""}
Answer following these steps:
1. Guess their objective.
2. Describe steps to achieve it in SQL.
3. Build the logic by identifying tables and relationships.
4. Write SQL to answer the question. Use SQLite syntax.

Replace generic filter values by querying a random value from the data.
Always use [Table].[Column] notation.`;

    const assistantMsgId = generateId();
    addMessage({ id: assistantMsgId, role: "assistant", timestamp: Date.now() });
    setSelectedMessageId(assistantMsgId);
    setIsQuerying(true);

    try {
      const content = await callLLM({ system: systemPrompt, user: question, settings: llmSettings });
      const sql = extractSQL(content);

      let result: import("@/types").QueryRow[] | undefined;
      let error: string | undefined;

      try {
        result = db.exec(sql, { rowMode: "object" }) as import("@/types").QueryRow[];
      } catch (e) {
        error = String(e);
      }

      updateMessage(assistantMsgId, { content, sql, result, error });

      if (sql && !error && result) {
        addQueryHistory({ id: generateId(), sessionId, question, sql, rowCount: result.length, timestamp: Date.now(), pinned: false }).catch(() => {});
      }
      if (error) addToast({ variant: "warning", title: "SQL Error", message: error });

      if (result && result.length > 0 && !error) {
        // Auto-chart (JSON config)
        updateMessage(assistantMsgId, { autoChartLoading: true });
        generateChartConfig(result, question, llmSettings)
          .then((cfg) => updateMessage(assistantMsgId, { autoChartConfig: cfg, autoChartLoading: false }))
          .catch(() => updateMessage(assistantMsgId, { autoChartLoading: false }));

        // Insights
        updateMessage(assistantMsgId, { insightsLoading: true });
        generateInsights(question, result, llmSettings)
          .then((insights) => updateMessage(assistantMsgId, { insights, insightsLoading: false }))
          .catch(() => updateMessage(assistantMsgId, { insightsLoading: false }));

        // Follow-up suggestions
        generateFollowUps(question, result, llmSettings)
          .then((suggestions) => updateMessage(assistantMsgId, { suggestions }))
          .catch(() => {});
      }

    } catch (err) {
      updateMessage(assistantMsgId, { error: String(err) });
      addToast({ variant: "error", title: "LLM Error", message: String(err) });
    } finally {
      setIsQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [schemas, context, messages, sessionId, addMessage, updateMessage, setIsQuerying, addToast, llmSettings, setSelectedMessageId]);

  const handleSubmit = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || isQuerying) return;
    setInput("");
    const userMsg: ChatMessage = { id: generateId(), role: "user", question: q, timestamp: Date.now() };
    addMessage(userMsg);

    if (schemas.length > 0) {
      const schemaSQL = schemas.map((s) => s.sql).join("\n\n");
      try {
        const { needsClarification, questions } = await checkClarification(q, schemaSQL, context, llmSettings);
        if (needsClarification && questions.length > 0) {
          addMessage({ id: generateId(), role: "clarifying", question: q, clarifyingQuestions: questions, timestamp: Date.now() });
          return;
        }
      } catch { /* skip */ }
    }
    await executeQuery(q);
  }, [isQuerying, schemas, context, addMessage, llmSettings, executeQuery]);

  const handleClarifiedSubmit = useCallback((enrichedQuestion: string) => {
    executeQuery(enrichedQuestion);
  }, [executeQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(input); }
  };

  const noData = schemas.length === 0;

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Left: Conversation ── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                <Sparkles size={26} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">DataChat</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  {noData ? "Load a dataset to start asking questions" : "Ask a question about your data"}
                </p>
              </div>
              {!noData && suggestionsLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={13} className="animate-spin" /> Generating suggestions…
                </div>
              )}
              {!noData && !suggestionsLoading && suggestedQuestions.length > 0 && (
                <div className="w-full max-w-sm space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 mb-2">Suggested questions</p>
                  {suggestedQuestions.map((q) => (
                    <button key={q} onClick={() => handleSubmit(q)}
                      className="w-full text-left text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-300 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onClarifiedSubmit={handleClarifiedSubmit}
              onFollowUp={handleSubmit}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-950 shrink-0">
          <div className={cn(
            "rounded-xl border bg-white dark:bg-gray-900 transition-colors",
            isQuerying ? "border-indigo-300 dark:border-indigo-700" : "border-gray-200 dark:border-gray-700",
          )}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isQuerying || noData}
              placeholder={noData ? "Load a dataset first…" : "Ask a question… (⌘+Enter to send)"}
              rows={2}
              className="w-full resize-none rounded-xl px-3 pt-3 pb-1 text-sm bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-xs text-gray-400">⌘+Enter to submit</span>
              <button
                onClick={() => handleSubmit(input)}
                disabled={!input.trim() || isQuerying || noData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
              >
                {isQuerying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isQuerying ? "Thinking…" : "Ask"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Output panel ── */}
      <div className="w-[420px] shrink-0 flex flex-col min-h-0 bg-white dark:bg-gray-950">
        <OutputPanel onFollowUp={handleSubmit} />
      </div>
    </div>
  );
}
