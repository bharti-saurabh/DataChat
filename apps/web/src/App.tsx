import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell.js";
import { ChatPage } from "@/pages/ChatPage.js";
import { ConnectionsPage } from "@/pages/ConnectionsPage.js";
import { DashboardPage } from "@/pages/DashboardPage.js";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" } },
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} className="h-full" {...pageVariants}>
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <AppShell>
      <AnimatedRoutes />
    </AppShell>
  );
}
