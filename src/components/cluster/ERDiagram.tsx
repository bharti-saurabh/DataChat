import { useCallback, useRef, useState } from "react";
import type { DataCluster, ClusterTable } from "@/types/cluster";

interface NodePos { x: number; y: number }

interface ERDiagramProps {
  cluster: DataCluster;
  compact?: boolean;             // smaller variant for sidebar
  onTableClick?: (tableId: string) => void;
  highlightTable?: string;
}

const NODE_W = 148;
const NODE_H = 56;
const NODE_W_SM = 110;
const NODE_H_SM = 40;

function formatRows(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M rows`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K rows`;
  return `${n} rows`;
}

export function ERDiagram({ cluster, compact = false, onTableClick, highlightTable }: ERDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const NW = compact ? NODE_W_SM : NODE_W;
  const NH = compact ? NODE_H_SM : NODE_H;

  // Node positions as percentage of SVG viewport converted to absolute px
  // We track positions as { x, y } in px (within a 640×360 or 360×260 virtual canvas)
  const VW = compact ? 360 : 640;
  const VH = compact ? 260 : 360;

  const [positions, setPositions] = useState<Record<string, NodePos>>(() =>
    Object.fromEntries(
      cluster.tables.map((t) => [
        t.id,
        { x: (t.position.x / 100) * VW, y: (t.position.y / 100) * VH },
      ])
    )
  );

  // ── Drag handling ────────────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    if (compact) return; // no drag in compact mode
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const svgRect = svg.getBoundingClientRect();
    const scaleX = VW / svgRect.width;
    const scaleY = VH / svgRect.height;
    const pos = positions[tableId];

    draggingNode.current = tableId;
    dragOffset.current = {
      dx: (e.clientX - svgRect.left) * scaleX - pos.x,
      dy: (e.clientY - svgRect.top) * scaleY - pos.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!draggingNode.current) return;
      const nx = Math.max(0, Math.min(VW - NW, (ev.clientX - svgRect.left) * scaleX - dragOffset.current.dx));
      const ny = Math.max(0, Math.min(VH - NH, (ev.clientY - svgRect.top) * scaleY - dragOffset.current.dy));
      setPositions((prev) => ({ ...prev, [draggingNode.current!]: { x: nx, y: ny } }));
    };
    const onUp = () => {
      draggingNode.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [compact, positions, VW, VH, NW, NH]);

  // ── Edge rendering ────────────────────────────────────────────────────────────
  function edgePath(from: ClusterTable, to: ClusterTable): string {
    const fp = positions[from.id];
    const tp = positions[to.id];
    if (!fp || !tp) return "";
    const fx = fp.x + NW / 2;
    const fy = fp.y + NH / 2;
    const tx = tp.x + NW / 2;
    const ty = tp.y + NH / 2;
    const cpx = (fx + tx) / 2;
    return `M ${fx} ${fy} Q ${cpx} ${fy} ${tx} ${ty}`;
  }

  // ── Tooltip position ─────────────────────────────────────────────────────────
  function edgeMidpoint(from: ClusterTable, to: ClusterTable) {
    const fp = positions[from.id];
    const tp = positions[to.id];
    if (!fp || !tp) return { x: 0, y: 0 };
    return {
      x: (fp.x + NW / 2 + tp.x + NW / 2) / 2,
      y: (fp.y + NH / 2 + tp.y + NH / 2) / 2,
    };
  }

  const tableMap = Object.fromEntries(cluster.tables.map((t) => [t.id, t]));

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        style={{ cursor: compact ? "default" : "default" }}
      >
        {/* ── Edges ── */}
        {cluster.relationships.map((rel) => {
          const from = tableMap[rel.fromTable];
          const to = tableMap[rel.toTable];
          if (!from || !to) return null;
          const edgeId = `${rel.fromTable}-${rel.toTable}`;
          const isHovered = hoveredEdge === edgeId;
          const mid = edgeMidpoint(from, to);

          return (
            <g key={edgeId}>
              {/* Wide invisible hit area */}
              <path
                d={edgePath(from, to)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onMouseEnter={() => setHoveredEdge(edgeId)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
              {/* Visible edge */}
              <path
                d={edgePath(from, to)}
                fill="none"
                stroke={isHovered ? "#6366f1" : "#cbd5e1"}
                strokeWidth={isHovered ? 2 : 1.5}
                strokeDasharray={isHovered ? "none" : "4 3"}
                markerEnd="url(#arrow)"
                style={{ transition: "stroke 0.15s" }}
              />
              {/* Hover tooltip */}
              {isHovered && !compact && (
                <foreignObject
                  x={mid.x - 70} y={mid.y - 28}
                  width={140} height={40}
                  style={{ pointerEvents: "none" }}
                >
                  <div className="bg-gray-900 text-white text-[9px] rounded-md px-2 py-1 text-center leading-tight shadow-lg">
                    <div className="font-medium">{rel.fromColumn} → {rel.toColumn}</div>
                    <div className="text-gray-400">{rel.cardinality}</div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* ── Arrow marker ── */}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* ── Nodes ── */}
        {cluster.tables.map((table) => {
          const pos = positions[table.id];
          if (!pos) return null;
          const isSpine = table.id === cluster.spineTable;
          const isHighlighted = highlightTable === table.id;
          const isHov = hoveredNode === table.id;

          // Derive a lighter hex from the color class for fill

          return (
            <g
              key={table.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ cursor: compact ? (onTableClick ? "pointer" : "default") : "grab" }}
              onMouseDown={(e) => onNodeMouseDown(e, table.id)}
              onMouseEnter={() => setHoveredNode(table.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onTableClick?.(table.id)}
            >
              {/* Shadow */}
              <rect
                x={2} y={3} width={NW} height={NH}
                rx={6} fill="rgba(0,0,0,0.06)"
              />
              {/* Background */}
              <rect
                width={NW} height={NH}
                rx={6}
                fill="white"
                stroke={isSpine ? "#6366f1" : isHighlighted ? "#6366f1" : "#e2e8f0"}
                strokeWidth={isSpine || isHighlighted ? 2 : 1}
                style={{ transition: "stroke 0.15s, fill 0.15s" }}
              />
              {/* Color accent strip */}
              <rect
                width={NW} height={compact ? 5 : 6} rx={6}
                fill={colorClassToHex(table.color)}
                style={{ clipPath: `inset(0 0 ${NH - (compact ? 5 : 6)}px 0 round 6px 6px 0 0)` }}
              />

              {/* Spine crown icon */}
              {isSpine && !compact && (
                <text x={NW - 12} y={14} fontSize={9} textAnchor="middle" fill="#6366f1" fontWeight="700">★</text>
              )}

              {/* Table name */}
              <text
                x={compact ? 6 : 8}
                y={compact ? 24 : 26}
                fontSize={compact ? 9 : 10}
                fontWeight="600"
                fill="#1e293b"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {truncate(table.displayName, compact ? 16 : 20)}
              </text>

              {/* Row count */}
              {!compact && (
                <text
                  x={8} y={42}
                  fontSize={8.5}
                  fill="#94a3b8"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {formatRows(table.estimatedRows)} · {table.grain.split(" ").slice(0, 3).join(" ")}
                </text>
              )}
              {compact && (
                <text x={6} y={34} fontSize={7.5} fill="#94a3b8" style={{ fontFamily: "system-ui, sans-serif" }}>
                  {formatRows(table.estimatedRows)}
                </text>
              )}

              {/* Hover tooltip (full diagram only) */}
              {isHov && !compact && (
                <foreignObject x={NW + 4} y={0} width={160} height={80} style={{ pointerEvents: "none" }}>
                  <div className="bg-gray-900 text-white text-[9px] rounded-lg px-2.5 py-2 shadow-xl leading-snug z-50">
                    <div className="font-semibold mb-0.5">{table.displayName}</div>
                    <div className="text-gray-400 mb-1">{table.grain}</div>
                    <div className="text-indigo-300">PK: {table.primaryKey}</div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* ── Legend (full only) ── */}
        {!compact && (
          <g transform={`translate(${VW - 120}, ${VH - 36})`}>
            <rect width={112} height={30} rx={4} fill="white" stroke="#e2e8f0" strokeWidth={1} />
            <text x={8} y={11} fontSize={7.5} fill="#64748b" fontFamily="system-ui">★ Spine table</text>
            <line x1={8} y1={20} x2={24} y2={20} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={28} y={23} fontSize={7.5} fill="#64748b" fontFamily="system-ui">FK relationship</text>
          </g>
        )}
      </svg>

      {/* Drag hint */}
      {!compact && (
        <p className="text-center text-[10px] text-gray-400 mt-1">Drag nodes to rearrange · hover edges for join details</p>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Map tailwind bg color classes to approximate hex for SVG fill
function colorClassToHex(cls: string): string {
  const map: Record<string, string> = {
    "bg-indigo-600": "#4f46e5",
    "bg-violet-500": "#8b5cf6",
    "bg-blue-500": "#3b82f6",
    "bg-rose-500": "#f43f5e",
    "bg-amber-500": "#f59e0b",
    "bg-red-600": "#dc2626",
    "bg-teal-500": "#14b8a6",
    "bg-green-500": "#22c55e",
    "bg-orange-500": "#f97316",
    "bg-pink-500": "#ec4899",
    "bg-cyan-500": "#06b6d4",
    "bg-purple-500": "#a855f7",
  };
  return map[cls] ?? "#6366f1";
}
