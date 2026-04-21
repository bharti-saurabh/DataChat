import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Plug, CheckCircle, XCircle, Loader2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";
import { useStore } from "@/store/useStore.js";
import type { ConnectionConfig, DBType } from "@datachat/shared";

const DB_TYPES: DBType[] = ["postgres", "mysql", "sqlite", "bigquery", "snowflake"];

const DB_META: Record<DBType, { color: string; label: string }> = {
  postgres:  { color: "#3b82f6", label: "PostgreSQL" },
  mysql:     { color: "#f59e0b", label: "MySQL" },
  sqlite:    { color: "#22d3ee", label: "SQLite" },
  bigquery:  { color: "#34d399", label: "BigQuery" },
  snowflake: { color: "#a78bfa", label: "Snowflake" },
};

const emptyForm: ConnectionConfig = {
  label: "", type: "postgres",
  host: "localhost", port: 5432,
  database: "", user: "", password: "", ssl: false,
};

const cardVariants = {
  initial: { opacity: 0, y: 8 },
  animate: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.18, delay: i * 0.05 } }),
  exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

export function ConnectionsPage() {
  const qc = useQueryClient();
  const setActiveConnection = useStore((s) => s.setActiveConnection);
  const activeConnection = useStore((s) => s.activeConnection);

  const [form, setForm] = useState<ConnectionConfig>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; error?: string } | null>(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: api.connections.list,
  });

  const createMutation = useMutation({
    mutationFn: api.connections.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); setShowForm(false); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: api.connections.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });

  const testConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.connections.test(id);
      setTestResult({ id, ...res });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto", height: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Database connections</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
            Connect to PostgreSQL, MySQL, Snowflake, BigQuery, or SQLite
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary"
        >
          <Plus size={14} /> New connection
        </motion.button>
      </div>

      {/* New connection form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass"
            style={{ borderRadius: "0.875rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>New connection</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Field label="Label">
                <input className="input-base" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="My Postgres DB" />
              </Field>
              <Field label="Type">
                <select className="input-base" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DBType }))}>
                  {DB_TYPES.map((t) => <option key={t} value={t}>{DB_META[t].label}</option>)}
                </select>
              </Field>
              <Field label="Host">
                <input className="input-base" value={form.host ?? ""} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="localhost" />
              </Field>
              <Field label="Port">
                <input className="input-base" type="number" value={form.port ?? ""} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} placeholder="5432" />
              </Field>
              <Field label="Database">
                <input className="input-base" value={form.database ?? ""} onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))} />
              </Field>
              <Field label="User">
                <input className="input-base" value={form.user ?? ""} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} />
              </Field>
              <Field label="Password" style={{ gridColumn: "1 / -1" }}>
                <input className="input-base" type="password" value={form.password ?? ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => createMutation.mutate(form)}
                disabled={!form.label || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                Save connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: "0.75rem" }} />)}
        </div>
      ) : connections.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>No connections yet — add one above.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <AnimatePresence>
            {connections.map((conn, i) => {
              const meta = DB_META[conn.type as DBType] ?? { color: "var(--color-accent)", label: conn.type };
              const isActive = activeConnection?.id === conn.id;
              const testRes = testResult?.id === conn.id ? testResult : null;

              return (
                <motion.div
                  key={conn.id}
                  custom={i}
                  variants={cardVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onClick={() => setActiveConnection(conn)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.875rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.75rem",
                    background: "color-mix(in srgb, var(--color-surface-2) 90%, transparent)",
                    border: `1px solid ${isActive ? meta.color + "66" : "var(--color-border)"}`,
                    boxShadow: isActive ? `0 0 20px ${meta.color}18` : "none",
                    cursor: "pointer",
                    transition: "border-color var(--duration-normal), box-shadow var(--duration-normal)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  whileHover={{ borderColor: meta.color + "44" }}
                >
                  {/* DB type colour bar */}
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                    background: meta.color,
                    opacity: isActive ? 1 : 0.4,
                    borderRadius: "0.75rem 0 0 0.75rem",
                  }} />

                  {/* DB type badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "0.5rem", flexShrink: 0,
                    background: meta.color + "18",
                    border: `1px solid ${meta.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginLeft: "0.25rem",
                  }}>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.04em", color: meta.color }}>
                      {conn.type.slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Labels */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conn.label}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{meta.label}</p>
                  </div>

                  {/* Active badge */}
                  {isActive && (
                    <span className="tag" style={{ color: meta.color, borderColor: meta.color + "55", fontSize: "0.65rem" }}>
                      active
                    </span>
                  )}

                  {/* Test result */}
                  {testRes && (
                    testRes.ok
                      ? <CheckCircle size={14} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                      : <XCircle size={14} style={{ color: "var(--color-error)", flexShrink: 0 }} />
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.25rem" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-icon"
                      title="Test connection"
                      onClick={() => testConnection(conn.id)}
                    >
                      {testingId === conn.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plug size={14} />}
                    </button>
                    <button
                      className="btn-icon"
                      title="Delete"
                      onClick={() => deleteMutation.mutate(conn.id)}
                      style={{ color: "var(--color-text-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-error)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <ChevronRight size={14} style={{ color: "var(--color-text-dim)", flexShrink: 0 }} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", ...style }}>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", letterSpacing: "0.03em" }}>{label}</span>
      {children}
    </label>
  );
}
