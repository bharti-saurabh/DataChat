import { useState, useEffect } from "react";
import { ExternalLink, Loader2, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { DemoConfig } from "@/types";
import { useDataStore } from "@/store/useDataStore";
import { loadFile } from "@/lib/db";
import { FileUpload } from "@/components/upload/FileUpload";
import { ClusterSectionInner } from "@/components/cluster/ClusterCard";
import { cn } from "@/lib/utils";

function ExplorerDemoGrid() {
  const [demos, setDemos] = useState<DemoConfig[]>([]);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const { addToast, setSchemas, setDbReady } = useDataStore();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then((r) => r.json())
      .then(({ demos }: { demos: DemoConfig[] }) => setDemos(demos))
      .catch(() => {});
  }, []);

  async function loadDemo(demo: DemoConfig) {
    if (loadingDemo) return;
    setLoadingDemo(demo.title);
    try {
      const blob = await fetch(demo.file).then((r) => r.blob());
      const file = new File([blob], demo.file.split("/").pop()!);
      const schemas = await loadFile(file);
      setSchemas(schemas);
      setDbReady(true);
      addToast({ variant: "success", title: `Loaded ${demo.title}` });
    } catch (err) {
      addToast({ variant: "error", title: "Failed to load demo", message: String(err) });
    } finally {
      setLoadingDemo(null);
    }
  }

  if (!demos.length) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-500 dark:text-gray-600" />
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">Try a demo dataset</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {demos.map((demo) => (
          <button
            key={demo.title}
            onClick={() => loadDemo(demo)}
            disabled={!!loadingDemo}
            className={cn(
              "group relative text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all",
              loadingDemo === demo.title && "opacity-60 cursor-wait",
            )}
          >
            {loadingDemo === demo.title && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <Loader2 size={18} className="animate-spin text-indigo-500" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">
                {demo.title}
              </h3>
              <ExternalLink size={12} className="shrink-0 text-gray-400 mt-0.5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{demo.body}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function InstructionsPanel() {
  const { explorerInstructions, setExplorerInstructions } = useDataStore();
  const [open, setOpen] = useState(!!explorerInstructions);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <SlidersHorizontal size={14} className="text-indigo-500" />
          Dashboard instructions
          <span className="text-[10px] font-normal text-gray-400 ml-1">(optional)</span>
        </div>
        <ChevronDown
          size={14}
          className={cn("text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 mb-2">
            These instructions apply to every dashboard you build. Use them to set preferences like focus areas, style, or data context.
          </p>
          <textarea
            value={explorerInstructions}
            onChange={(e) => setExplorerInstructions(e.target.value)}
            placeholder="e.g. Focus on revenue and growth trends. Prefer bar and line charts. Highlight any anomalies or outliers. Use concise titles."
            rows={4}
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 resize-none transition"
          />
          {explorerInstructions.trim() && (
            <p className="text-[10px] text-indigo-500 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
              Instructions saved — applied to all dashboard builds
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ExplorerLanding() {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">
            DataChat Explorer
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Upload your data and build AI-generated dashboards instantly
          </p>
        </div>

        {/* Upload */}
        <FileUpload />

        {/* General instructions */}
        <InstructionsPanel />

        {/* Data clusters */}
        <ClusterSectionInner />

        {/* Single-file demos */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">Single-file demos</h2>
          <p className="text-xs text-gray-400 mb-3">Quick-start with a single CSV dataset.</p>
          <ExplorerDemoGrid />
        </div>
      </div>
    </div>
  );
}
