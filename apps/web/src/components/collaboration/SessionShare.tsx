import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Check } from "lucide-react";
import { useStore } from "@/store/useStore.js";

export function SessionShare() {
  const roomId = useStore((s) => s.roomId);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${location.origin}/chat?room=${roomId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      onClick={copy}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      title={`Room: ${roomId} — click to copy share link`}
      style={{
        display: "flex", alignItems: "center", gap: "0.375rem",
        padding: "0.2rem 0.625rem",
        borderRadius: 9999,
        border: "1px solid var(--color-border)",
        background: copied ? "var(--color-accent-pale)" : "var(--color-surface-2)",
        cursor: "pointer",
        fontSize: "0.7rem",
        fontFamily: "var(--font-mono)",
        color: copied ? "var(--color-accent)" : "var(--color-text-muted)",
        transition: "background var(--duration-normal), color var(--duration-normal), border-color var(--duration-normal)",
        borderColor: copied ? "var(--color-accent)" : "var(--color-border)",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied
          ? <motion.span key="check"  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check  size={11} /></motion.span>
          : <motion.span key="link"   initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Link2  size={11} /></motion.span>
        }
      </AnimatePresence>
      {roomId}
    </motion.button>
  );
}
