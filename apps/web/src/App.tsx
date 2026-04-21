import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell.js";
import { ChatPage } from "@/pages/ChatPage.js";
import { ConnectionsPage } from "@/pages/ConnectionsPage.js";
import { DashboardPage } from "@/pages/DashboardPage.js";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  );
}
