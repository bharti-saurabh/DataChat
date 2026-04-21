import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquare, LayoutDashboard, Database, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils.js";

const nav = [
  { to: "/chat",        icon: MessageSquare,  label: "Chat" },
  { to: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { to: "/connections", icon: Database,         label: "Connections" },
];

export function Sidebar() {
  return (
    <aside
      style={{
        width: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingBlock: "1rem",
        gap: "0.25rem",
        borderRight: "1px solid var(--color-border)",
        background: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
        backdropFilter: "blur(16px)",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "1rem" }}>
        <motion.div
          whileHover={{ scale: 1.08 }}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, var(--color-accent), var(--color-cyan))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px var(--color-accent-glow)",
            cursor: "default",
          }}
        >
          <Zap size={16} color="#fff" fill="#fff" />
        </motion.div>
      </div>

      {/* Nav links */}
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} title={label} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          {({ isActive }) => (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn("nav-active-bar")}
              style={{
                width: 40, height: 40, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background var(--duration-normal), color var(--duration-normal)",
                background: isActive ? "var(--color-accent-pale)" : "transparent",
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                boxShadow: isActive ? "0 0 12px var(--color-accent-glow)" : "none",
                position: "relative",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: "absolute", left: 0, top: "20%", height: "60%",
                    width: 2, borderRadius: "0 2px 2px 0",
                    background: "var(--color-accent)",
                    boxShadow: "0 0 6px var(--color-accent)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={17} />
            </motion.div>
          )}
        </NavLink>
      ))}

      {/* Settings — pinned to bottom */}
      <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
        <NavLink to="/settings" title="Settings">
          {({ isActive }) => (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 40, height: 40, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                background: isActive ? "var(--color-accent-pale)" : "transparent",
              }}
            >
              <Settings size={17} />
            </motion.div>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
