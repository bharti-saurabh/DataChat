import { useRef, useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Database } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { callLLMJSON } from "@/lib/llm";
import { cn } from "@/lib/utils";

const ACCEPTED = ".csv,.sqlite3,.db,.sqlite,.s3db,.sl3";

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast, setSchemas, setSuggestedQuestions, setSuggestionsLoading, llmSettings } = useDataStore();

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      if (uploading) return;
      setUploading(true);
      const db = await getDB();
      let imported = 0;

      for (const file of Array.from(files)) {
        try {
          if (file.name.match(/\.(sqlite3|sqlite|db|s3db|sl3)$/i)) {
            await db.uploadSQLite(file);
            addToast({ variant: "success", title: "Imported", message: `SQLite DB: ${file.name}` });
          } else if (file.name.match(/\.csv$/i)) {
            const tableName = await db.uploadCSV(file, ",");
            addToast({ variant: "success", title: "Imported", message: `Table: ${tableName}` });
          } else if (file.name.match(/\.tsv$/i)) {
            const tableName = await db.uploadCSV(file, "\t");
            addToast({ variant: "success", title: "Imported", message: `Table: ${tableName}` });
          } else {
            addToast({ variant: "warning", title: "Skipped", message: `Unknown file type: ${file.name}` });
            continue;
          }
          imported++;
        } catch (err) {
          addToast({ variant: "error", title: `Error: ${file.name}`, message: String(err) });
        }
      }

      if (imported > 0) {
        const schemas = db.schema().map((s) => ({
          ...s,
          rowCount: db.tableRowCount(s.name),
          preview: db.tablePreview(s.name),
        }));
        setSchemas(schemas);
        fetchSuggestions(schemas.map((s) => s.sql).join("\n\n"));
      }
      setUploading(false);
    },
    [uploading, addToast, setSchemas, setSuggestedQuestions, llmSettings],
  );

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all",
        dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600",
        uploading && "pointer-events-none opacity-60",
      )}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />

      <div className="flex items-center gap-3 text-gray-400">
        <FileSpreadsheet size={28} />
        <Upload size={20} />
        <Database size={28} />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {dragging ? "Drop files here" : "Upload your data"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">CSV, TSV, or SQLite (.db, .sqlite3) — drag & drop or click</p>
      </div>

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-xl">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Importing…</span>
          </div>
        </div>
      )}
    </div>
  );
}
