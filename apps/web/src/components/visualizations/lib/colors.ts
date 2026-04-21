// Holographic palette cycling through accent → cyan → violet → green → amber
export const PALETTE = [
  "#3b82f6", // blue
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // green
  "#fbbf24", // amber
  "#f87171", // coral
  "#60a5fa", // light blue
  "#4ade80", // lime
];

export function paletteColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// CSS var shortcuts
export const C = {
  accent:   "var(--color-accent)",
  cyan:     "var(--color-cyan)",
  border:   "var(--color-border)",
  surface2: "var(--color-surface-2)",
  surface3: "var(--color-surface-3)",
  textMuted: "var(--color-text-muted)",
  textSecondary: "var(--color-text-secondary)",
} as const;
