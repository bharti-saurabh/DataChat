import { Database, History, Settings, PanelLeft, Sun, Moon, Monitor, LayoutDashboard } from "lucide-react";
import { useDataStore, type Theme } from "@/store/useDataStore";
import { cn } from "@/lib/utils";

const themeOptions: { label: string; value: Theme; icon: React.ReactNode }[] = [
  { label: "Light", value: "light", icon: <Sun size={14} /> },
  { label: "Dark", value: "dark", icon: <Moon size={14} /> },
  { label: "Auto", value: "auto", icon: <Monitor size={14} /> },
];

export function Navbar() {
  const { theme, setTheme, toggleSidebar, toggleHistory, toggleSettings, toggleDashboard, historyOpen, settingsOpen, dashboardOpen, sessionName } = useDataStore();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 gap-3">
      <button
        onClick={toggleSidebar}
        className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
        title="Toggle sidebar"
      >
        <PanelLeft size={18} />
      </button>

      <div className="flex items-center gap-2 flex-1">
        <Database size={18} className="text-blue-600" />
        <span className="font-semibold text-gray-900 dark:text-gray-100">DataChat</span>
        {sessionName && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{sessionName}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              title={opt.label}
              className={cn(
                "px-2 py-1.5 text-xs flex items-center gap-1 transition-colors",
                theme === opt.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              {opt.icon}
            </button>
          ))}
        </div>

        <button
          onClick={toggleDashboard}
          className={cn(
            "rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
            dashboardOpen ? "bg-blue-50 dark:bg-blue-950 text-blue-600" : "text-gray-600 dark:text-gray-400",
          )}
          title="Dashboard"
        >
          <LayoutDashboard size={18} />
        </button>

        <button
          onClick={toggleHistory}
          className={cn(
            "rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
            historyOpen ? "bg-blue-50 dark:bg-blue-950 text-blue-600" : "text-gray-600 dark:text-gray-400",
          )}
          title="Query history"
        >
          <History size={18} />
        </button>

        <button
          onClick={toggleSettings}
          className={cn(
            "rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
            settingsOpen ? "bg-blue-50 dark:bg-blue-950 text-blue-600" : "text-gray-600 dark:text-gray-400",
          )}
          title="LLM Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
