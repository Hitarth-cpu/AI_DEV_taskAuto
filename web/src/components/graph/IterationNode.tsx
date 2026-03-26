"use client";
import { Handle, Position } from "@xyflow/react";

export default function IterationNode({ data, selected }: any) {
  const { iter, iterIdx, dimmed } = data;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "";
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: 220,
        background: selected ? "rgba(20,14,5,0.98)" : "rgba(14,10,3,0.95)",
        borderTop: `1px solid ${selected ? "#f59e0b" : "rgba(245,158,11,0.15)"}`,
        borderRight: `1px solid ${selected ? "#f59e0b" : "rgba(245,158,11,0.15)"}`,
        borderBottom: `1px solid ${selected ? "#f59e0b" : "rgba(245,158,11,0.15)"}`,
        borderLeft: "3px solid #f59e0b",
        borderRadius: 8,
        padding: "11px 13px",
        transition: "opacity 0.25s ease",
        opacity: dimmed ? 0.2 : 1,
        boxShadow: selected
          ? "0 0 0 1px rgba(245,158,11,0.2), 0 16px 32px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.3)",
        cursor: "pointer",
        willChange: "transform",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#f59e0b", border: "none", width: 6, height: 6 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{
          fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#f59e0b", background: "rgba(245,158,11,0.08)",
          padding: "2px 6px", borderRadius: 3, border: "1px solid rgba(245,158,11,0.2)",
        }}>
          Fix {iterIdx + 1}
        </span>
      </div>

      <p style={{
        fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.4,
        display: "-webkit-box", WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {iter.reasoning || "No reasoning recorded."}
      </p>

      {iter.error_output && (
        <p style={{
          marginTop: 7, fontSize: 9.5, color: "rgba(239,68,68,0.7)",
          fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {iter.error_output.trim().split("\n")[0]}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#f59e0b", border: "none", width: 6, height: 6 }}
      />
    </div>
  );
}
