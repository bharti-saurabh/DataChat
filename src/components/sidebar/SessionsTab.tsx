import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Trash2, Plus, AlertTriangle } from "lucide-react";
import { loadSessions, deleteSession, type SavedSession } from "@/lib/persistence";
import { useDataStore } from "@/store/useDataStore";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SessionsTab() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const { sessionId, loadSession, newSession, schemas, addToast } = useDataStore();

  const reload = useCallback(async () => {
    const data = await loadSessions();
    setSessions(data);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function handleLoad(s: SavedSession) {
    loadSession(s.id, s.name, s.context, s.messages);
    addToast({ variant: "info", title: `Loaded: ${s.name}`, message: schemas.length ? undefined : "Re-upload your data to run new queries." });
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteSession(id);
    reload();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sessions</h2>
          <button
            onClick={() => newSession()}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-colors"
          >
            <Plus size={10} /> New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <MessageSquare size={22} className="opacity-40" />
            <p className="text-xs">No saved sessions yet</p>
          </div>
        )}

        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => handleLoad(s)}
            className={cn(
              "w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 group transition-colors",
              s.id === sessionId && "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-500",
            )}
          >
            <div className="flex items-start gap-2">
              <MessageSquare size={13} className="mt-0.5 shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{s.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {s.messageCount} message{s.messageCount !== 1 ? "s" : ""} · {formatRelativeTime(s.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(s.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </button>
        ))}
      </div>

      {/* Warning when no DB data loaded */}
      {schemas.length === 0 && sessions.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span>No data loaded. Re-upload your file to run queries on a restored session.</span>
          </div>
        </div>
      )}
    </div>
  );
}
