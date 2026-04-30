import { useRef, useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Database, Link, Cloud, Table, Loader2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { loadFile, loadURL, getSchemas } from "@/lib/db";
import { callLLMJSON } from "@/lib/llm";
import { autoAnalyze } from "@/lib/autoAnalyze";
import { cn } from "@/lib/utils";

const ACCEPTED = ".csv,.tsv,.xlsx,.xls,.json,.parquet,.sqlite3,.db,.sqlite,.s3db,.sl3";

type Tab = "file" | "url" | "s3" | "sheets";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "file",   label: "File",   icon: <Upload size={13} /> },
  { id: "url",    label: "URL",    icon: <Link size={13} /> },
  { id: "s3",     label: "S3",     icon: <Cloud size={13} /> },
  { id: "sheets", label: "Sheets", icon: <Table size={13} /> },
];

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>("file");
  const [urlInput, setUrlInput] = useState("");
  const [s3Input, setS3Input] = useState("");
  const [sheetsInput, setSheetsInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const { addToast, setSchemas, setDbReady, setSuggestedQuestions, setSuggestionsLoading, llmSettings } = useDataStore();

  async function fetchSuggestions(schemaSQL: string) {
    setSuggestionsLoading(true);
    try {
      const resp = await callLLMJSON<{ questions: string[] }>({
        system: "Suggest 5 diverse, useful questions that a user can answer from this dataset using DuckDB SQL",
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

  const afterLoad = useCallback(async () => {
    const schemas = await getSchemas();
    if (schemas.length > 0) {
      setSchemas(schemas);
      setDbReady(true);
      fetchSuggestions(schemas.map((s) => s.sql).join("\n\n"));
      autoAnalyze(schemas, setSchemas).then(setSchemas).catch(() => {});
    }
  }, [setSchemas, setDbReady]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (uploading) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await loadFile(file);
        addToast({ variant: "success", title: "Imported", message: file.name });
      } catch (err) {
        addToast({ variant: "error", title: `Error: ${file.name}`, message: String(err) });
      }
    }
    await afterLoad();
    setUploading(false);
  }, [uploading, addToast, afterLoad]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  async function loadFromUrl(rawUrl: string, label: string) {
    if (!rawUrl.trim() || uploading) return;
    setUrlError("");
    setUploading(true);
    try {
      const tableName = rawUrl.split("/").pop()?.split("?")[0]?.replace(/[^a-zA-Z0-9_]/g, "_") ?? "imported";
      await loadURL(rawUrl.trim(), tableName);
      addToast({ variant: "success", title: "Loaded", message: label });
      await afterLoad();
    } catch (err) {
      setUrlError(String(err));
      addToast({ variant: "error", title: "Load failed", message: String(err) });
    } finally {
      setUploading(false);
    }
  }

  function sheetsUrlToCsv(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const gid = url.match(/[?&]gid=(\d+)/)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setUrlError(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "file" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all",
              dragging ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden"
              onChange={(e) => e.target.files && processFiles(e.target.files)} />
            <div className="flex items-center gap-3 text-gray-300 dark:text-gray-600">
              <FileSpreadsheet size={26} />
              <Upload size={18} />
              <Database size={26} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {dragging ? "Drop files here" : "Upload your data"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                CSV, TSV, Excel, JSON, Parquet, SQLite — drag & drop or click
              </p>
            </div>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 rounded-xl">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Importing…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "url" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Load a CSV, Parquet, or JSON file from a public URL.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && loadFromUrl(urlInput, urlInput.split("/").pop() ?? "file")}
                placeholder="https://example.com/data.csv"
                className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400"
              />
              <button
                onClick={() => loadFromUrl(urlInput, urlInput.split("/").pop() ?? "file")}
                disabled={!urlInput.trim() || uploading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
                Load
              </button>
            </div>
            {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          </div>
        )}

        {tab === "s3" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Paste the HTTPS URL of a publicly accessible S3 object.</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={s3Input}
                onChange={(e) => { setS3Input(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && loadFromUrl(s3Input, "S3 file")}
                placeholder="https://my-bucket.s3.amazonaws.com/data.csv"
                className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400"
              />
              <button
                onClick={() => loadFromUrl(s3Input, "S3 file")}
                disabled={!s3Input.trim() || uploading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
                Load
              </button>
            </div>
            <p className="text-[11px] text-gray-400">The bucket must allow public read access (no auth required).</p>
            {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          </div>
        )}

        {tab === "sheets" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Paste a Google Sheets URL. The sheet must be set to "Anyone with the link can view".</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={sheetsInput}
                onChange={(e) => { setSheetsInput(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const csvUrl = sheetsUrlToCsv(sheetsInput);
                  if (csvUrl) loadFromUrl(csvUrl, "Google Sheet");
                  else setUrlError("Could not parse a Google Sheets URL from this link.");
                }}
                placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400"
              />
              <button
                onClick={() => {
                  const csvUrl = sheetsUrlToCsv(sheetsInput);
                  if (csvUrl) loadFromUrl(csvUrl, "Google Sheet");
                  else setUrlError("Could not parse a Google Sheets URL from this link.");
                }}
                disabled={!sheetsInput.trim() || uploading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Table size={13} />}
                Load
              </button>
            </div>
            {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
