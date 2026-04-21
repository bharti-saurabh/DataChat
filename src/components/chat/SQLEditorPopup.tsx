import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Play, X, Wand2, Loader2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import type { QueryRow } from "@/types";
import { ResultsTable } from "@/components/results/ResultsTable";

interface SQLEditorPopupProps {
  sql: string;
  onClose: () => void;
}

export function SQLEditorPopup({ sql: initialSQL, onClose }: SQLEditorPopupProps) {
  const [sql, setSQL] = useState(initialSQL);
  const [result, setResult] = useState<QueryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const { llmSettings, schemas, addToast } = useDataStore();

  const runSQL = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const db = await getDB();
      const data = db.exec(sql, { rowMode: "object" });
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [sql]);

  const fixWithAI = useCallback(async () => {
    if (!error) return;
    setFixing(true);
    try {
      const schemaSQL = schemas.map((s) => s.sql).join("\n\n");
      const response = await callLLM({
        system: `You are an expert SQLite query writer. Fix the SQL query that caused an error.
Schema:
${schemaSQL}

Return ONLY the fixed SQL query inside a \`\`\`sql code fence. No explanation.`,
        user: `Error: ${error}\n\nSQL:\n${sql}`,
        settings: llmSettings,
      });
      const match = response.match(/```sql\s*\n([\s\S]*?)```/i);
      if (match?.[1]) {
        setSQL(match[1].trim());
        addToast({ variant: "info", title: "SQL fixed by AI — review before running" });
      }
    } catch (e) {
      addToast({ variant: "error", title: "Fix failed", message: String(e) });
    } finally {
      setFixing(false);
    }
  }, [error, sql, schemas, llmSettings, addToast]);

  return (
    <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">SQL Editor</span>
        <div className="flex items-center gap-2">
          {error && (
            <button
              onClick={fixWithAI}
              disabled={fixing}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900"
            >
              {fixing ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              Fix with AI
            </button>
          )}
          <button
            onClick={runSQL}
            disabled={running}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Run
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={14} />
          </button>
        </div>
      </div>

      <Editor
        height="180px"
        defaultLanguage="sql"
        value={sql}
        onChange={(v) => setSQL(v ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
        }}
        theme="vs-dark"
      />

      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 border-t border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {result && result.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <ResultsTable data={result} />
        </div>
      )}
      {result && result.length === 0 && (
        <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-200 dark:border-gray-700">No results.</p>
      )}
    </div>
  );
}
