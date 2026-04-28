import { useDataStore } from "@/store/useDataStore";
import { SchemaExplorer } from "@/components/schema/SchemaExplorer";
import { SessionsTab } from "@/components/sidebar/SessionsTab";
import { ClusterSidebarTab } from "@/components/cluster/ClusterSidebarTab";
import { cn } from "@/lib/utils";
import type { SidebarTab } from "@/types";

export function SidebarShell() {
  const { sidebarTab, setSidebarTab, activeCluster } = useDataStore();

  const tabs: { id: SidebarTab; label: string }[] = [
    { id: "schema",   label: "Schema"   },
    ...(activeCluster ? [{ id: "cluster" as SidebarTab, label: "Cluster" }] : []),
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              sidebarTab === tab.id
                ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {sidebarTab === "schema"   && <SchemaExplorer />}
        {sidebarTab === "cluster"  && <ClusterSidebarTab />}
        {sidebarTab === "sessions" && <SessionsTab />}
      </div>
    </div>
  );
}
