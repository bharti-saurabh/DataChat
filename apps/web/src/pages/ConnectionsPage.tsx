import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Plug, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";
import { useStore } from "@/store/useStore.js";
import type { ConnectionConfig, DBType } from "@datachat/shared";

const DB_TYPES: DBType[] = ["postgres", "mysql", "sqlite", "bigquery", "snowflake"];

const emptyForm: ConnectionConfig = {
  label: "",
  type: "postgres",
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
  ssl: false,
};

export function ConnectionsPage() {
  const qc = useQueryClient();
  const setActiveConnection = useStore((s) => s.setActiveConnection);
  const activeConnection = useStore((s) => s.activeConnection);

  const [form, setForm] = useState<ConnectionConfig>(emptyForm);
  const [showForm, setShowForm] = useState(false);

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

  const testMutation = useMutation({ mutationFn: api.connections.test });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Connections</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage your database connections</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] text-white text-sm transition-colors"
        >
          <Plus size={15} /> New connection
        </button>
      </div>

      {/* New connection form */}
      {showForm && (
        <div className="glass rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">New Connection</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label">
              <Input value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="My Postgres DB" />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DBType }))}
                className="input-base"
              >
                {DB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Host">
              <Input value={form.host ?? ""} onChange={(v) => setForm((f) => ({ ...f, host: v }))} placeholder="localhost" />
            </Field>
            <Field label="Port">
              <Input value={String(form.port ?? "")} onChange={(v) => setForm((f) => ({ ...f, port: Number(v) }))} placeholder="5432" />
            </Field>
            <Field label="Database">
              <Input value={form.database ?? ""} onChange={(v) => setForm((f) => ({ ...f, database: v }))} />
            </Field>
            <Field label="User">
              <Input value={form.user ?? ""} onChange={(v) => setForm((f) => ({ ...f, user: v }))} />
            </Field>
            <Field label="Password" className="col-span-2">
              <Input type="password" value={form.password ?? ""} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.label || createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Connection list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : connections.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">No connections yet.</p>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={cn(
                "glass rounded-xl px-4 py-3 flex items-center gap-3 transition-all cursor-pointer",
                activeConnection?.id === conn.id && "glass-glow border-[var(--color-accent)]",
              )}
              onClick={() => setActiveConnection(conn)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{conn.label}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{conn.type}</p>
              </div>

              {activeConnection?.id === conn.id && (
                <span className="text-xs text-[var(--color-accent)] font-medium">active</span>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); testMutation.mutate(conn.id); }}
                title="Test connection"
                className="p-1.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(conn.id); }}
                title="Delete"
                className="p-1.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Test result */}
      {testMutation.data && (
        <div className={cn(
          "flex items-center gap-2 text-sm rounded-lg px-3 py-2",
          testMutation.data.ok
            ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
            : "bg-[var(--color-error)]/10 text-[var(--color-error)]",
        )}>
          {testMutation.data.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {testMutation.data.ok ? "Connection successful" : testMutation.data.error}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-base"
    />
  );
}
