import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Link2, ClipboardPaste, FileText, Database, CheckCircle, Layers, Loader2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { loadFile, loadURL, pasteData } from "@/lib/db";
import { autoAnalyze } from "@/lib/autoAnalyze";
import { cn } from "@/lib/utils";

type Tab = "upload" | "url" | "paste" | "samples";

const SAMPLES = [
  { title: "World", body: "239 countries and their cities — population, language, geography.", url: "https://raw.githubusercontent.com/gramener/datasets/main/world.db" },
  { title: "NBA", body: "Basketball match stats — players, teams, rebounds, assists.", url: "https://raw.githubusercontent.com/gramener/datasets/main/nba.db" },
  { title: "CraftBeer", body: "Craft beers by style, ABV, IBU, and brewery by state.", url: "https://raw.githubusercontent.com/gramener/datasets/main/craftbeer.db" },
  { title: "Atherosclerosis", body: "20-year longitudinal study — demographics, blood pressure, cholesterol.", url: "https://raw.githubusercontent.com/gramener/datasets/main/atherosclerosis.db" },
  { title: "Card Transactions", body: "Card transaction data — amounts, channels, fraud flags, decline codes.", url: "https://raw.githubusercontent.com/gramener/datasets/main/card_transactions.csv" },
  { title: "HR: Employee Data", body: "Employee master — salary, department, performance, gender, hire date.", url: "https://raw.githubusercontent.com/gramener/datasets/main/employee_data.csv" },
  { title: "Marvel Powers", body: "Every Marvel character's powers at weakest and strongest from Marvel Fandom.", url: "https://raw.githubusercontent.com/sanand0/marvel-powers/master/marvel-powers-summary.csv" },
  { title: "EHR Data", body: "Electronic health records — demographics, comorbidities, medications, visits.", url: "https://raw.githubusercontent.com/gramener/datasets/refs/heads/main/ehr.csv" },
];

export function DataSourceModal() {
  const { dataSourceOpen, toggleDataSource, setSchemas, setDbReady, addToast } = useDataStore();
  const [tab, setTab] = useState<Tab>("upload");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const schemas = await loadFile(file);
      setSchemas(schemas);
      setDbReady(true);
      setLoaded(true);
      addToast({ variant: "success", title: `Loaded ${file.name}`, message: `${schemas.length} table(s) ready` });
      autoAnalyze(schemas, setSchemas).then(setSchemas).catch(() => {});
      setTimeout(() => { setLoaded(false); toggleDataSource(); }, 800);
    } catch (e) {
      addToast({ variant: "error", title: "Failed to load file", message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleURL = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const schemas = await loadURL(url, urlName || "data");
      setSchemas(schemas);
      setDbReady(true);
      setLoaded(true);
      addToast({ variant: "success", title: "Data loaded from URL" });
      autoAnalyze(schemas, setSchemas).then(setSchemas).catch(() => {});
      setTimeout(() => { setLoaded(false); toggleDataSource(); }, 800);
    } catch (e) {
      addToast({ variant: "error", title: "Failed to load URL", message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    try {
      const schemas = await pasteData(pasteText, "pasted_data");
      setSchemas(schemas);
      setDbReady(true);
      setLoaded(true);
      addToast({ variant: "success", title: "Pasted data loaded" });
      autoAnalyze(schemas, setSchemas).then(setSchemas).catch(() => {});
      setTimeout(() => { setLoaded(false); toggleDataSource(); }, 800);
    } catch (e) {
      addToast({ variant: "error", title: "Failed to parse pasted data", message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleSample = async (url: string, title: string) => {
    setLoadingSample(title);
    setLoading(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const filename = url.split("/").pop() ?? title;
      const file = new File([blob], filename, { type: blob.type });
      const schemas = await loadFile(file);
      setSchemas(schemas);
      setDbReady(true);
      setLoaded(true);
      addToast({ variant: "success", title: `Loaded ${title}`, message: `${schemas.length} table(s) ready` });
      autoAnalyze(schemas, setSchemas).then(setSchemas).catch(() => {});
      setTimeout(() => { setLoaded(false); toggleDataSource(); }, 800);
    } catch (e) {
      addToast({ variant: "error", title: "Failed to load sample", message: String(e) });
    } finally {
      setLoading(false);
      setLoadingSample(null);
    }
  };

  const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "upload", icon: <Upload size={13} />, label: "Upload" },
    { id: "samples", icon: <Layers size={13} />, label: "Samples" },
    { id: "url", icon: <Link2 size={13} />, label: "URL" },
    { id: "paste", icon: <ClipboardPaste size={13} />, label: "Paste" },
  ];

  const FILE_TYPES = ["CSV", "TSV", "Excel", "JSON", "Parquet", "SQLite"];

  return (
    <AnimatePresence>
      {dataSourceOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(13,13,26,0.35)", backdropFilter: "blur(4px)" }}
            onClick={toggleDataSource}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6"
            style={{
              background: "rgba(255,255,255,0.99)",
              borderRadius: 24,
              border: "1px solid var(--border)",
              boxShadow: "0 24px 80px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.10))", border: "1px solid rgba(99,102,241,0.18)" }}>
                  <Database size={16} style={{ color: "var(--indigo)" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Connect Data Source</h2>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>Upload, fetch, or paste your data</p>
                </div>
              </div>
              <button
                onClick={toggleDataSource}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-3)", background: "rgba(99,102,241,0.04)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.09)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.04)"; }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid var(--border)" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all")}
                  style={tab === t.id
                    ? { background: "white", color: "var(--indigo)", boxShadow: "0 1px 4px rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.14)" }
                    : { color: "var(--text-3)", background: "transparent", border: "1px solid transparent" }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Upload */}
            {tab === "upload" && (
              <div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="rounded-2xl p-8 text-center cursor-pointer transition-all"
                  style={{
                    border: `2px dashed ${loaded ? "#10b981" : dragging ? "var(--indigo)" : "rgba(99,102,241,0.2)"}`,
                    background: loaded
                      ? "rgba(16,185,129,0.05)"
                      : dragging
                      ? "rgba(99,102,241,0.05)"
                      : "rgba(99,102,241,0.02)",
                  }}
                >
                  {loaded ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle size={32} style={{ color: "#10b981" }} />
                      <p className="text-sm font-semibold" style={{ color: "#059669" }}>Data loaded!</p>
                    </div>
                  ) : loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--indigo)", borderTopColor: "transparent" }} />
                      <p className="text-sm" style={{ color: "var(--text-3)" }}>Processing…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <FileText size={22} style={{ color: "var(--indigo)" }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Drop file here or click to browse</p>
                        <p className="mt-1" style={{ fontSize: 11, color: "var(--text-3)" }}>{FILE_TYPES.join(" · ")}</p>
                      </div>
                    </div>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept=".csv,.tsv,.txt,.xlsx,.xls,.json,.parquet,.db,.sqlite,.sqlite3"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                  />
                </div>
              </div>
            )}

            {/* URL */}
            {tab === "url" && (
              <div className="space-y-3">
                <div>
                  <label className="label">Data URL</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} className="input w-full" placeholder="https://example.com/data.csv" />
                  <p className="mt-1" style={{ fontSize: 10, color: "var(--text-3)" }}>Supports CSV, JSON, and Parquet URLs</p>
                </div>
                <div>
                  <label className="label">Table Name (optional)</label>
                  <input value={urlName} onChange={(e) => setUrlName(e.target.value)} className="input w-full" placeholder="my_data" />
                </div>
                <button onClick={handleURL} disabled={!url || loading} className="btn-primary w-full">
                  {loading ? "Loading…" : "Load Data"}
                </button>
              </div>
            )}

            {/* Paste */}
            {tab === "paste" && (
              <div className="space-y-3">
                <div>
                  <label className="label">Paste CSV / TSV data</label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={7}
                    className="input w-full resize-none font-mono"
                    style={{ fontSize: 11 }}
                    placeholder={"name,value,category\nAlpha,42,A\nBeta,87,B"}
                  />
                </div>
                <button onClick={handlePaste} disabled={!pasteText.trim() || loading} className="btn-primary w-full">
                  {loading ? "Parsing…" : "Load Data"}
                </button>
              </div>
            )}

            {/* Samples */}
            {tab === "samples" && (
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
                {SAMPLES.map((s) => {
                  const isLoading = loadingSample === s.title;
                  return (
                    <button
                      key={s.title}
                      onClick={() => handleSample(s.url, s.title)}
                      disabled={loading}
                      className="text-left rounded-xl p-3 transition-all border hover:border-indigo-300 hover:shadow-sm disabled:opacity-50"
                      style={{ borderColor: "var(--border)", background: "rgba(99,102,241,0.02)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{s.title}</span>
                        {isLoading && <Loader2 size={10} className="animate-spin shrink-0" style={{ color: "var(--indigo)" }} />}
                      </div>
                      <p className="leading-snug" style={{ fontSize: 10, color: "var(--text-3)" }}>{s.body}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
