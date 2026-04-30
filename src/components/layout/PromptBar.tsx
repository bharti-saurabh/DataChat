import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, Wand2 } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { buildDashboard, executeWidget } from "@/lib/widgetBuilder";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Build me an executive overview of this data",
  "Show key trends and metrics",
  "Analyse distributions and top performers",
  "Create a summary dashboard",
];

export function PromptBar() {
  const { schemas, llmSettings, isBuilding, setIsBuilding, setWidgets, setDashboardTitle, addToast, dbReady, widgets, updateWidget, explorerInstructions } = useDataStore();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const q = input.trim();
    if (!q || isBuilding || !dbReady) return;
    setInput("");
    setIsBuilding(true);
    try {
      const { title, widgets: newWidgets } = await buildDashboard(q, schemas, llmSettings, widgets, explorerInstructions);
      setDashboardTitle(title);
      const finalWidgets = widgets.length === 0 ? newWidgets : [...widgets, ...newWidgets];
      setWidgets(finalWidgets);
      const withData = await Promise.all(newWidgets.map((w) => executeWidget(w)));
      withData.forEach((w) => updateWidget(w.id, { data: w.data, loading: false, error: w.error }));
    } catch (e) {
      addToast({ variant: "error", title: "Build failed", message: String(e) });
    } finally {
      setIsBuilding(false);
    }
  }, [input, isBuilding, dbReady, schemas, llmSettings, widgets]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 2px rgba(99,102,241,0.3), 0 8px 40px rgba(99,102,241,0.12)"
            : "0 2px 12px rgba(99,102,241,0.06), 0 0 0 1px rgba(99,102,241,0.1)",
        }}
        className="rounded-2xl overflow-hidden bg-white"
      >
        {/* Example prompts */}
        <AnimatePresence>
          {focused && !input && !isBuilding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-3 flex flex-wrap gap-1.5"
            >
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                  className="text-[11px] px-3 py-1 rounded-full border font-medium transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
                  {p}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mb-0.5"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))" }}>
            <Wand2 size={13} style={{ color: "var(--indigo)" }} />
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isBuilding || !dbReady}
            placeholder={!dbReady ? "Connect a data source first…" : "Describe the dashboard you want to build… (⌘+Enter to send)"}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm focus:outline-none leading-relaxed"
            style={{ color: "var(--text-1)", maxHeight: 120, overflowY: "auto" }}
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isBuilding || !dbReady}
            className={cn(
              "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mb-0.5",
              input.trim() && !isBuilding && dbReady
                ? "text-white shadow-lg"
                : "cursor-not-allowed opacity-30",
            )}
            style={input.trim() && !isBuilding && dbReady
              ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }
              : { background: "#e5e7eb" }}
          >
            {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>

        {isBuilding && (
          <div className="px-4 pb-3 flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--indigo)" }}>
            <Sparkles size={10} className="animate-pulse" />
            Building your dashboard…
          </div>
        )}
      </motion.div>
    </div>
  );
}
