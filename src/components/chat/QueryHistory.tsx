import { useState, useEffect, useCallback } from "react";
import { Pin, PinOff, Trash2, History, X, Search } from "lucide-react";
import { loadQueryHistory, togglePinQuery, deleteQueryHistory, type QueryHistoryItem } from "@/lib/persistence";
import { useDataStore } from "@/store/useDataStore";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function QueryHistory() {
  const { historyOpen, toggleHistory, sessionId } = useDataStore();
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    const data = await loadQueryHistory();
    setItems(data);
  }, []);

  useEffect(() => {
    if (historyOpen) reload();
  }, [historyOpen, reload]);

  if (!historyOpen) return null;

  const filtered = search
    ? items.filter((i) => i.question.toLowerCase().includes(search.toLowerCase()) || i.sql.toLowerCase().includes(search.toLowerCase()))
    : items;

  const pinned = filtered.filter((i) => i.pinned);
  const unpinned = filtered.filter((i) => !i.pinned);

  async function handlePin(id: string) {
    await togglePinQuery(id);
    reload();
  }

  async function handleDelete(id: string) {
    await deleteQueryHistory(id);
    reload();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <History size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">Query History</h2>
        <button onClick={toggleHistory} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <History size={24} className="opacity-40" />
            <p className="text-xs">No queries yet</p>
          </div>
        )}

        {pinned.length > 0 && (
          <div>
            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pinned</p>
            {pinned.map((item) => (
              <HistoryItem key={item.id} item={item} currentSession={item.sessionId === sessionId} onPin={handlePin} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {unpinned.length > 0 && (
          <div>
            {pinned.length > 0 && <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent</p>}
            {unpinned.map((item) => (
              <HistoryItem key={item.id} item={item} currentSession={item.sessionId === sessionId} onPin={handlePin} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryItem({
  item,
  currentSession,
  onPin,
  onDelete,
}: {
  item: QueryHistoryItem;
  currentSession: boolean;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 group",
        currentSession && "bg-blue-50/40 dark:bg-blue-950/10",
      )}
    >
      <div className="flex items-start gap-2">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left min-w-0">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{item.question}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {item.rowCount.toLocaleString()} rows · {formatRelativeTime(item.timestamp)}
          </p>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onPin(item.id)}
            title={item.pinned ? "Unpin" : "Pin"}
            className="p-0.5 text-gray-400 hover:text-yellow-500"
          >
            {item.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button onClick={() => onDelete(item.id)} title="Delete" className="p-0.5 text-gray-400 hover:text-red-500">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <pre className="mt-1.5 text-[10px] bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {item.sql}
        </pre>
      )}
    </div>
  );
}
