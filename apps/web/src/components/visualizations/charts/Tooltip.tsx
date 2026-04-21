import type { ReactNode } from "react";

interface TooltipProps {
  x: number;
  y: number;
  children: ReactNode;
}

export function Tooltip({ x, y, children }: TooltipProps) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -100%)",
      pointerEvents: "none",
      zIndex: 50,
      background: "color-mix(in srgb, var(--color-surface-3) 95%, transparent)",
      backdropFilter: "blur(8px)",
      border: "1px solid var(--color-border)",
      borderRadius: "0.5rem",
      padding: "0.375rem 0.625rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.125rem",
      fontSize: "0.8rem",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      whiteSpace: "nowrap",
      marginBottom: 6,
    }}>
      {children}
      {/* Arrow */}
      <div style={{
        position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
        width: 0, height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "5px solid var(--color-border)",
      }} />
    </div>
  );
}
