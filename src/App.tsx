import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/layout/ToastProvider";
import { RoleSelection } from "@/components/layout/RoleSelection";
import { DemoGrid } from "@/components/demos/DemoGrid";
import { FileUpload } from "@/components/upload/FileUpload";
import { SidebarShell } from "@/components/sidebar/SidebarShell";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { QueryHistory } from "@/components/chat/QueryHistory";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DataExplorerModal } from "@/components/explorer/DataExplorerModal";
import { BentoGrid } from "@/components/grid/BentoGrid";
import { PromptBar } from "@/components/layout/PromptBar";
import { DataSourceModal } from "@/components/datasource/DataSourceModal";
import { ExplorerLanding } from "@/components/layout/ExplorerLanding";
import { useDataStore } from "@/store/useDataStore";
import { getDB } from "@/lib/db";
import { loadLLMSettings, saveLLMSettings } from "@/lib/persistence";
import { DEFAULT_LLM_SETTINGS } from "@/lib/llm";
import type { AppMode } from "@/types";

export default function App() {
  const { theme, sidebarOpen, schemas, setDbReady, setLLMSettings, mode, setMode } = useDataStore();
  const [roleSelected, setRoleSelected] = useState(false);

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

  // Init DB + load saved settings
  useEffect(() => {
    getDB()
      .then(() => setDbReady(true))
      .catch(console.error);
    loadLLMSettings()
      .then((s: import("@/types").LLMSettings | null) => {
        if (!s) return;
        const modelOk = s.model && !/[A-Z\s]/.test(s.model);
        const sanitized = modelOk ? s : { ...s, model: DEFAULT_LLM_SETTINGS.model };
        if (!modelOk) saveLLMSettings(sanitized).catch(console.error);
        setLLMSettings(sanitized);
      })
      .catch(console.error);
  }, [setDbReady, setLLMSettings]);

  const hasData = schemas.length > 0;

  const handleRoleSelect = (selectedMode: AppMode) => {
    setMode(selectedMode);
    setRoleSelected(true);
  };

  // Show role selection on first visit (no data, no role chosen yet)
  if (!roleSelected && !hasData) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <RoleSelection onSelect={handleRoleSelect} />
        <ToastProvider />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      <Navbar />

      {mode === "analyst" ? (
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="flex flex-col w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <SidebarShell />
            </aside>
          )}

          {/* Main */}
          <main className="flex-1 flex min-w-0 overflow-hidden">
            {!hasData ? (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
                  <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                      DataChat Analyst
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                      Talk to your dataset in natural language
                    </p>
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
      ) : (
        /* Explorer mode */
        <div className="relative flex-1 min-h-0 overflow-hidden bg-[var(--bg-base)]">
          {/* Ambient orbs — visible in both states */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-[120px]" />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            {!hasData ? (
              <ExplorerLanding />
            ) : (
              <>
                <div className="flex-1 min-h-0">
                  <BentoGrid />
                </div>
                <PromptBar />
              </>
            )}
          </div>

          <DataSourceModal />
        </div>
      )}

      {/* Full-screen overlays */}
      <Dashboard />
      <DataExplorerModal />
      <QueryHistory />
      <SettingsPanel />
      <ToastProvider />
    </div>
  );
}
