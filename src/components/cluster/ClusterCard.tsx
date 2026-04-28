import { useState } from "react";
import { Loader2, Database, ArrowRight } from "lucide-react";
import { loadCluster } from "@/lib/clusterLoader";
import { useDataStore } from "@/store/useDataStore";
import { cn } from "@/lib/utils";
import type { DataCluster } from "@/types/cluster";

interface ClusterCardProps {
  cluster: DataCluster;
  onLoaded?: () => void;
}

export function ClusterCard({ cluster, onLoaded }: ClusterCardProps) {
  const {
    addToast, setSchemas, setDbReady, setActiveCluster,
    setClusterLoadProgress, clusterLoadProgress, setSidebarTab,
    setSuggestedQuestions, setContext,
  } = useDataStore();

  const [loading, setLoading] = useState(false);

  const totalRows = cluster.tables.reduce((sum, t) => sum + t.estimatedRows, 0);
  const isThisLoading = loading && clusterLoadProgress !== null;

  async function handleLoad() {
    if (loading) return;
    setLoading(true);
    setClusterLoadProgress({ step: 0, total: cluster.tables.length, tableName: "" });
    try {
      const schemas = await loadCluster(cluster, (p) => setClusterLoadProgress(p));
      setSchemas(schemas);
      setDbReady(true);
      setActiveCluster(cluster);
      setContext(cluster.llmContext);
      if (cluster.suggestedQuestions?.length) {
        setSuggestedQuestions(cluster.suggestedQuestions);
      }
      setSidebarTab("cluster");
      addToast({ variant: "success", title: `${cluster.icon} ${cluster.name} loaded`, message: `${cluster.tables.length} tables ready` });
      onLoaded?.();
    } catch (err) {
      addToast({ variant: "error", title: "Failed to load cluster", message: String(err) });
    } finally {
      setLoading(false);
      setClusterLoadProgress(null);
    }
  }

  const progress = clusterLoadProgress;

  return (
    <div className={cn(
      "relative rounded-2xl border-2 bg-white dark:bg-gray-900 overflow-hidden transition-all",
      loading
        ? "border-indigo-300 dark:border-indigo-700"
        : "border-indigo-100 dark:border-indigo-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg",
    )}>
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cluster.icon}</span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">{cluster.name}</h3>
              <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">{cluster.domain}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{cluster.tables.length} tables</p>
            <p className="text-[10px] text-gray-400">{(totalRows / 1000).toFixed(0)}K+ rows</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{cluster.description}</p>

        {/* Table pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {cluster.tables.map((t) => (
            <span key={t.id}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <span className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
              {t.displayName}
            </span>
          ))}
        </div>

        {/* Relationship hint */}
        <div className="flex items-center gap-1.5 mb-4 text-[10px] text-gray-400">
          <Database size={10} className="shrink-0" />
          <span>Spine: <span className="font-medium text-indigo-500">{cluster.tables.find(t => t.id === cluster.spineTable)?.displayName}</span> · {cluster.relationships.length} FK relationships · universal join key: <span className="font-mono">{cluster.relationships[0]?.toColumn ?? "id"}</span></span>
        </div>

        {/* Load button / progress */}
        {isThisLoading && progress ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
              <Loader2 size={13} className="animate-spin shrink-0" />
              <span>Loading {progress.tableName}…</span>
              <span className="ml-auto text-gray-400">{progress.step}/{progress.total}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${(progress.step / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={handleLoad}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
          >
            Load Cluster <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

import { ALL_CLUSTERS } from "@/data/clusters";

export function ClusterSectionInner({ onLoaded }: { onLoaded?: () => void }) {
  if (!ALL_CLUSTERS.length) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Data Clusters</h2>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-100 dark:border-indigo-900">
          Multi-table
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4 -mt-1">
        Pre-linked datasets with schema relationships, AI context, and join-ready tables.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {ALL_CLUSTERS.map((c) => (
          <ClusterCard key={c.id} cluster={c} onLoaded={onLoaded} />
        ))}
      </div>
    </section>
  );
}
