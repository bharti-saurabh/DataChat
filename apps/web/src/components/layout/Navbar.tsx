import { useLocation } from "react-router-dom";
import { useStore } from "@/store/useStore.js";

const titles: Record<string, string> = {
  "/chat": "Chat",
  "/dashboard": "Dashboard",
  "/connections": "Connections",
  "/settings": "Settings",
};

export function Navbar() {
  const { pathname } = useLocation();
  const activeConnection = useStore((s) => s.activeConnection);

  return (
    <header className="h-12 flex items-center px-4 gap-3 glass border-b border-[var(--color-border)] shrink-0">
      <h1 className="text-sm font-semibold text-holo">{titles[pathname] ?? "DataChat"}</h1>

      {activeConnection && (
        <>
          <span className="text-[var(--color-border)] select-none">·</span>
          <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            {activeConnection.label}
          </span>
        </>
      )}
    </header>
  );
}
