import { Database, History, Settings, PanelLeft, Sun, Moon, Monitor, LayoutDashboard, Table2, PlusCircle, Trash2 } from "lucide-react";
import { useDataStore, type Theme } from "@/store/useDataStore";
import { cn } from "@/lib/utils";

const themeOptions: { label: string; value: Theme; icon: React.ReactNode }[] = [
  { label: "Light", value: "light", icon: <Sun size={14} /> },
  { label: "Dark",  value: "dark",  icon: <Moon size={14} /> },
  { label: "Auto",  value: "auto",  icon: <Monitor size={14} /> },
];

export function Navbar() {
  const {
    mode, setMode,
    theme, setTheme,
    toggleSidebar, toggleHistory, toggleSettings, toggleDashboard, toggleExplorer,
    historyOpen, settingsOpen, dashboardOpen, explorerOpen,
    sessionName, schemas,
    dashboardTitle, widgets, toggleDataSource, clearExplorerDashboard,
  } = useDataStore();

  const hasData = schemas.length > 0;

  return (
    <header className="sticky top-0 z-40 flex h-13 items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 gap-3">
      {/* Sidebar toggle — Analyst only */}
      {mode === "analyst" && (
        <button onClick={toggleSidebar}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          title="Toggle sidebar">
          <PanelLeft size={17} />
        </button>
      )}

      {/* Logo + breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Database size={14} className="text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">DataChat</span>

        {mode === "analyst" && sessionName && sessionName !== "New session" && (
          <>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-xs text-gray-400 truncate max-w-[180px]">{sessionName}</span>
          </>
        )}

        {mode === "explorer" && dashboardTitle && (
          <>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-xs text-gray-400 truncate max-w-[180px]">{dashboardTitle}</span>
            {widgets.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                {widgets.length} widgets
              </span>
            )}
          </>
        )}
      </div>

      {/* Mode switcher */}
      <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ml-2">
        <button
          onClick={() => setMode("analyst")}
          className={cn(
            "px-3 py-1 text-xs font-medium transition-colors",
            mode === "analyst"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400",
          )}>
          Analyst
        </button>
        <button
          onClick={() => setMode("explorer")}
          className={cn(
            "px-3 py-1 text-xs font-medium transition-colors",
            mode === "explorer"
              ? "bg-indigo-600 text-white"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400",
          )}>
          Explorer
        </button>
      </div>

      <div className="flex-1" />

      {/* Explorer: live data pill */}
      {mode === "explorer" && hasData && (
        <button onClick={toggleDataSource}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:opacity-80 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {schemas.map((s) => s.name).join(", ").slice(0, 28)}
        </button>
      )}

      <div className="flex items-center gap-1">
        {/* Theme */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {themeOptions.map((opt) => (
            <button key={opt.value} onClick={() => setTheme(opt.value)} title={opt.label}
              className={cn(
                "px-2 py-1.5 flex items-center gap-1 transition-colors",
                theme === opt.value
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}>
              {opt.icon}
            </button>
          ))}
        </div>

        {/* Analyst actions */}
        {mode === "analyst" && (
          <>
            {hasData && (
              <button onClick={toggleExplorer} title="Data Explorer"
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  explorerOpen
                    ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                )}>
                <Table2 size={17} />
              </button>
            )}
            <button onClick={toggleDashboard} title="Dashboard"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                dashboardOpen
                  ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}>
              <LayoutDashboard size={17} />
            </button>
            <button onClick={toggleHistory} title="Query history"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                historyOpen
                  ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}>
              <History size={17} />
            </button>
          </>
        )}

        {/* Explorer actions */}
        {mode === "explorer" && (
          <>
            <button onClick={toggleDataSource} title="Connect data"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-xs font-medium">
              <PlusCircle size={15} />
              <span>Data</span>
            </button>
            {widgets.length > 0 && (
              <button onClick={clearExplorerDashboard} title="Clear dashboard"
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                <Trash2 size={15} />
              </button>
            )}
          </>
        )}

        {/* Settings — always visible */}
        <button onClick={toggleSettings} title="LLM Settings"
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            settingsOpen
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
          )}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
