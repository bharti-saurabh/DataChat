import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { DemoGrid } from "@/components/demos/DemoGrid";
import { FileUpload } from "@/components/upload/FileUpload";
import { SidebarShell } from "@/components/sidebar/SidebarShell";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { QueryHistory } from "@/components/chat/QueryHistory";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { loadLLMSettings, saveLLMSettings } from "@/lib/persistence";
import { DEFAULT_LLM_SETTINGS } from "@/lib/llm";

export default function App() {
  const { theme, sidebarOpen, schemas, setDbReady, setLLMSettings } = useDataStore();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.classList.toggle("dark", mq.matches);
      const listener = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  // Initialize SQLite and load saved settings on mount
  useEffect(() => {
    getDB()
      .then(() => setDbReady(true))
      .catch(console.error);
    loadLLMSettings()
      .then((s: import("@/types").LLMSettings | null) => {
        if (!s) return;
        // Sanitize: if saved model looks like a display name (uppercase / spaces),
        // silently fall back to the default model so the user doesn't stay broken.
        const modelOk = s.model && !/[A-Z\s]/.test(s.model);
        const sanitized = modelOk ? s : { ...s, model: DEFAULT_LLM_SETTINGS.model };
        if (!modelOk) saveLLMSettings(sanitized).catch(console.error);
        setLLMSettings(sanitized);
      })
      .catch(console.error);
  }, [setDbReady, setLLMSettings]);

  const hasData = schemas.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar />

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        {sidebarOpen && (
          <aside className="flex flex-col w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <SidebarShell />
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!hasData ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">DataChat</h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400">Talk to your dataset in natural language</p>
                </div>
                <FileUpload />
                <DemoGrid />
              </div>
            </div>
          ) : (
            <ChatPanel />
          )}
        </main>
      </div>

      {/* Overlays */}
      <Dashboard />
      <QueryHistory />
      <SettingsPanel />
      <ToastProvider />
    </div>
  );
}
