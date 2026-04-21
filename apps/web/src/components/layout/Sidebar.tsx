import { NavLink } from "react-router-dom";
import { MessageSquare, LayoutDashboard, Database, Settings } from "lucide-react";
import { cn } from "@/lib/utils.js";

const nav = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/connections", icon: Database, label: "Connections" },
];

export function Sidebar() {
  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-2 glass border-r border-[var(--color-border)] shrink-0">
      {/* Logo mark */}
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-4">
        <span className="text-white font-bold text-sm">D</span>
      </div>

      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
              isActive
                ? "bg-[var(--color-accent-glow)] text-[var(--color-accent)] glass-glow"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
            )
          }
        >
          <Icon size={18} />
        </NavLink>
      ))}

      <div className="mt-auto">
        <NavLink
          to="/settings"
          title="Settings"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-all"
        >
          <Settings size={18} />
        </NavLink>
      </div>
    </aside>
  );
}
