import { useStore } from "@/store/useStore.js";
import { ChatPanel } from "@/components/chat/ChatPanel.js";
import { Database } from "lucide-react";
import { Link } from "react-router-dom";

export function ChatPage() {
  const activeConnection = useStore((s) => s.activeConnection);

  if (!activeConnection) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] glass flex items-center justify-center">
          <Database size={24} className="text-[var(--color-accent)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">No connection active</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Connect to a database to start chatting with your data.
          </p>
        </div>
        <Link
          to="/connections"
          className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] text-white text-sm transition-colors"
        >
          Manage connections
        </Link>
      </div>
    );
  }

  return <ChatPanel />;
}
