import { Database, History, Settings, PanelLeft, Sun, Moon, Monitor, LayoutDashboard, Table2 } from "lucide-react";
import { useDataStore, type Theme } from "@/store/useDataStore";
import { cn } from "@/lib/utils";

const themeOptions: { label: string; value: Theme; icon: React.ReactNode }[] = [
  { label: "Light", value: "light", icon: <Sun size={14} /> },
  { label: "Dark",  value: "dark",  icon: <Moon size={14} /> },
  { label: "Auto",  value: "auto",  icon: <Monitor size={14} /> },
];

export function Navbar() {
  const {
    theme, setTheme, toggleSidebar, toggleHistory, toggleSettings,
    toggleDashboard, toggleExplorer,
    historyOpen, settingsOpen, dashboardOpen, explorerOpen,
    sessionName, schemas,
  } = useDataStore();

  const hasData = schemas.length > 0;

  return (
    <header className="sticky top-0 z-40 flex h-13 items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 gap-3">
      <button onClick={toggleSidebar}
        className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        title="Toggle sidebar">
        <PanelLeft size={17} />
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Database size={14} className="text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">DataChat</span>
        {sessionName && sessionName !== "New session" && (
          <>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-xs text-gray-400 truncate max-w-[180px]">{sessionName}</span>
          </>
        )}
      </div>

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

        {/* Explorer */}
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

        {/* Dashboard */}
        <button onClick={toggleDashboard} title="Dashboard"
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            dashboardOpen
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
          )}>
          <LayoutDashboard size={17} />
        </button>

        {/* History */}
        <button onClick={toggleHistory} title="Query history"
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            historyOpen
              ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
          )}>
          <History size={17} />
        </button>

        {/* Settings */}
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
