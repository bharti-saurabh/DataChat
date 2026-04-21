import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar.js";
import { Navbar } from "./Navbar.js";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-canvas)" }}>
      {/* Ambient background blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{
          position: "absolute", top: "10%", left: "15%",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "10%",
          width: 360, height: 360, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        {/* Dot grid overlay */}
        <div className="bg-dots absolute inset-0 opacity-30" />
      </div>

      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 relative">
        <Navbar />
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
