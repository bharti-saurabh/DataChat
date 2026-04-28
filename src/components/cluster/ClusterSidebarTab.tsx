import { useDataStore } from "@/store/useDataStore";
import { ERDiagram } from "./ERDiagram";
import { ExternalLink } from "lucide-react";

export function ClusterSidebarTab() {
  const { activeCluster, toggleExplorer } = useDataStore();

  if (!activeCluster) return null;

  const totalRows = activeCluster.tables.reduce((sum, t) => sum + t.estimatedRows, 0);

  function openExplorer() {
    toggleExplorer();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{activeCluster.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{activeCluster.shortName}</p>
            <p className="text-[10px] text-gray-400">{activeCluster.domain}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
          <span className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">{activeCluster.tables.length} tables</span>
          <span className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
            {totalRows >= 1000 ? `${(totalRows / 1000).toFixed(0)}K` : totalRows} rows
          </span>
          <span className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">{activeCluster.relationships.length} relationships</span>
        </div>
      </div>

      {/* Compact ER diagram */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Schema Map</p>
        <ERDiagram cluster={activeCluster} compact />
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Tables</p>
        <div className="space-y-1">
          {activeCluster.tables.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${t.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{t.displayName}</p>
                <p className="text-[10px] text-gray-400 truncate">{t.grain}</p>
              </div>
              <span className="text-[9px] text-gray-400 shrink-0">
                {t.estimatedRows >= 1000 ? `${(t.estimatedRows / 1000).toFixed(0)}K` : t.estimatedRows}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Open full explorer button */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={openExplorer}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-colors"
        >
          <ExternalLink size={11} /> Explore in detail
        </button>
      </div>
    </div>
  );
}
