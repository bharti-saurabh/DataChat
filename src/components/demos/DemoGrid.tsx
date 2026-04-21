import { useState, useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { DemoConfig } from "@/types";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { callLLMJSON } from "@/lib/llm";
import { cn } from "@/lib/utils";

export function DemoGrid() {
  const [demos, setDemos] = useState<DemoConfig[]>([]);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const { addToast, setSchemas, setContext, setSuggestedQuestions, setSuggestionsLoading, llmSettings } = useDataStore();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then((r) => r.json())
      .then(({ demos }: { demos: DemoConfig[] }) => setDemos(demos))
      .catch(() => addToast({ variant: "error", title: "Failed to load demos" }));
  }, [addToast]);

  async function loadDemo(demo: DemoConfig) {
    if (loadingDemo) return;
    setLoadingDemo(demo.title);
    try {
      const blob = await fetch(demo.file).then((r) => r.blob());
      const filename = demo.file.split("/").pop()!;
      const file = new File([blob], filename);
      const db = await getDB();

      if (filename.match(/\.(sqlite3|sqlite|db|s3db|sl3)$/i)) {
        await db.uploadSQLite(file);
      } else {
        await db.uploadCSV(file, ",");
      }

      const schemas = db.schema().map((s) => ({
        ...s,
        rowCount: db.tableRowCount(s.name),
        preview: db.tablePreview(s.name),
      }));
      setSchemas(schemas);
      setContext(demo.context ?? "");

      if (demo.questions?.length) {
        setSuggestedQuestions(demo.questions);
      } else {
        fetchSuggestions(schemas.map((s) => s.sql).join("\n\n"));
      }

      addToast({ variant: "success", title: `Loaded ${demo.title}` });
    } catch (err) {
      addToast({ variant: "error", title: "Failed to load demo", message: String(err) });
    } finally {
      setLoadingDemo(null);
    }
  }

  async function fetchSuggestions(schemaSQL: string) {
    setSuggestionsLoading(true);
    try {
      const resp = await callLLMJSON<{ questions: string[] }>({
        system: "Suggest 5 diverse, useful questions that a user can answer from this dataset using SQLite",
        user: schemaSQL,
        settings: llmSettings,
        schema: {
          type: "object",
          properties: { questions: { type: "array", items: { type: "string" }, additionalProperties: false } },
          required: ["questions"],
          additionalProperties: false,
        },
      });
      setSuggestedQuestions(resp.questions ?? []);
    } catch {
      setSuggestedQuestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  if (!demos.length) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <section className="py-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Try a demo dataset</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {demos.map((demo) => (
          <button
            key={demo.title}
            onClick={() => loadDemo(demo)}
            disabled={!!loadingDemo}
            className={cn(
              "group relative text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all",
              loadingDemo === demo.title && "opacity-60 cursor-wait",
            )}
          >
            {loadingDemo === demo.title && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <Loader2 size={20} className="animate-spin text-blue-600" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">{demo.title}</h3>
              <ExternalLink size={14} className="shrink-0 text-gray-400 mt-0.5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{demo.body}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
