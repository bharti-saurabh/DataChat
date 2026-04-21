import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar.js";
import { Navbar } from "./Navbar.js";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full bg-canvas bg-grid">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
