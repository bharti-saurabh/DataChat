import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, TrendingUp, MessageSquarePlus, ChevronDown, ChevronUp } from "lucide-react";
import type { InsightResult } from "@datachat/shared";

interface InsightsPanelProps {
  insights: InsightResult;
  onFollowUp?: (q: string) => void;
}

const ACCENT = "var(--color-accent)";
const CYAN   = "var(--color-cyan)";
const WARN   = "#f59e0b";
const MUTED  = "var(--color-text-muted)";

export function InsightsPanel({ insights, onFollowUp }: InsightsPanelProps) {
  const [open, setOpen] = useState(true);

  const hasContent =
    insights.summary ||
    insights.anomalies.length > 0 ||
    insights.trends.length > 0 ||
    insights.suggestions.length > 0;

  if (!hasContent) return null;

  return (
    <div style={{
      borderRadius: "0.625rem",
      border: "1px solid var(--color-border-glow)",
      background: "linear-gradient(135deg, var(--color-accent-pale) 0%, var(--color-cyan-pale) 100%)",
      overflow: "hidden",
      fontSize: "0.8rem",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          background: "transparent", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--color-border-soft)" : "none",
        }}
      >
        <Sparkles size={12} style={{ color: ACCENT, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: ACCENT, flex: 1, textAlign: "left", letterSpacing: "0.03em" }}>
          AI Insights
        </span>
        {open ? <ChevronUp size={12} style={{ color: MUTED }} /> : <ChevronDown size={12} style={{ color: MUTED }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0.625rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {insights.summary && (
                <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>
                  {insights.summary}
                </p>
              )}
              {insights.anomalies.length > 0 && (
                <Section icon={<AlertTriangle size={11} style={{ color: WARN }} />} label="Anomalies" color={WARN}>
                  {insights.anomalies.map((a, i) => <BulletItem key={i} color={WARN}>{a}</BulletItem>)}
                </Section>
              )}
              {insights.trends.length > 0 && (
                <Section icon={<TrendingUp size={11} style={{ color: CYAN }} />} label="Trends" color={CYAN}>
                  {insights.trends.map((t, i) => <BulletItem key={i} color={CYAN}>{t}</BulletItem>)}
                </Section>
              )}
              {insights.suggestions.length > 0 && (
                <Section icon={<MessageSquarePlus size={11} style={{ color: ACCENT }} />} label="Follow-up questions" color={ACCENT}>
                  {insights.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onFollowUp?.(s)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "0.25rem 0.5rem", borderRadius: "0.375rem",
                        background: "transparent", border: `1px solid ${ACCENT}33`,
                        cursor: onFollowUp ? "pointer" : "default",
                        color: ACCENT, fontSize: "0.775rem", lineHeight: 1.45,
                        transition: "background var(--duration-fast)",
                      }}
                      onMouseEnter={(e) => { if (onFollowUp) (e.currentTarget as HTMLElement).style.background = `${ACCENT}18`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {s}
                    </button>
                  ))}
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ icon, label, color, children }: {
  icon: React.ReactNode; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.3rem" }}>
        {icon}
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>{children}</div>
    </div>
  );
}

function BulletItem({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
      <span style={{ color, marginTop: "0.35rem", flexShrink: 0, fontSize: "0.55rem" }}>●</span>
      <span style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
