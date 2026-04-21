import { useState, useEffect } from "react";
import { X, Eye, EyeOff, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { useDataStore } from "@/store/useDataStore";
import { saveLLMSettings } from "@/lib/persistence";
import { MODELS, DEFAULT_LLM_SETTINGS } from "@/lib/llm";
import type { LLMSettings } from "@/types";


/** Returns a warning string if the model ID looks wrong, else null. */
function validateModel(model: string): string | null {
  if (!model.trim()) return "Model ID cannot be empty.";
  // Uppercase letters are a strong sign of a display name, not an API ID
  if (/[A-Z]/.test(model)) return `"${model}" looks like a display name, not an API model ID. API IDs use lowercase (e.g. gpt-4.1-mini).`;
  if (model.includes(" ")) return "Model ID should not contain spaces.";
  return null;
}

const IS_KNOWN = (model: string) => MODELS.slice(0, -1).some((m) => m.value === model);

export function SettingsPanel() {
  const { settingsOpen, toggleSettings, llmSettings, setLLMSettings, addToast } = useDataStore();
  const [showKey, setShowKey] = useState(false);
  // Local draft — nothing touches the store until Save
  const [draft, setDraft] = useState<LLMSettings>(llmSettings);
  const [isCustom, setIsCustom] = useState(!IS_KNOWN(llmSettings.model));

  // Sync draft when panel opens
  useEffect(() => {
    if (settingsOpen) {
      setDraft(llmSettings);
      setIsCustom(!IS_KNOWN(llmSettings.model));
    }
  }, [settingsOpen, llmSettings]);

  if (!settingsOpen) return null;

  const modelWarning = isCustom ? validateModel(draft.model) : null;

  function handleDropdownChange(value: string) {
    if (value === "__custom__") {
      setIsCustom(true);
      // Don't overwrite the model yet — let user type
    } else {
      setIsCustom(false);
      setDraft((d) => ({ ...d, model: value }));
    }
  }

  async function handleSave() {
    const warning = isCustom ? validateModel(draft.model) : null;
    if (warning) {
      addToast({ variant: "error", title: "Invalid model ID", message: warning });
      return;
    }
    setLLMSettings(draft);
    await saveLLMSettings(draft);
    addToast({ variant: "success", title: "Settings saved" });
    toggleSettings();
  }

  function handleReset() {
    setDraft(DEFAULT_LLM_SETTINGS);
    setIsCustom(false);
  }

  const dropdownValue = isCustom ? "__custom__" : draft.model;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={toggleSettings}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">LLM Settings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Reset to defaults"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-300"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={toggleSettings} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Base URL */}
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Base URL</span>
            <input
              type="url"
              value={draft.baseUrl}
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.openai.com/v1"
            />
          </label>

          {/* API Key */}
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</span>
            <div className="relative mt-1">
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sk-…"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {/* Model */}
          <div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</span>
              <select
                value={dropdownValue}
                onChange={(e) => handleDropdownChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODELS.filter((m) => m.value !== "custom").map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                <option value="__custom__">Custom model ID…</option>
              </select>
            </label>

            {/* Custom model text input */}
            {isCustom && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  value={draft.model}
                  onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g. gpt-4.1-mini"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400">Use the exact API model ID (lowercase, no spaces).</p>
                {modelWarning && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2.5 py-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{modelWarning}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Temperature */}
          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</span>
              <span className="text-sm text-gray-500">{draft.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: parseFloat(e.target.value) }))}
              className="mt-2 w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Precise (0)</span>
              <span>Creative (1)</span>
            </div>
          </label>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Check size={16} /> Save Settings
        </button>
      </div>
    </div>
  );
}
