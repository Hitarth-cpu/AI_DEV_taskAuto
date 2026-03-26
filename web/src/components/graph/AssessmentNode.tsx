"use client";
import { Handle, Position } from "@xyflow/react";

const LEVEL_COLOR: Record<string, string> = {
  Advanced:     "#10b981",
  Intermediate: "#3b82f6",
  Beginner:     "#f59e0b",
  Unknown:      "#6b7280",
};

export default function AssessmentNode({ data, selected }: any) {
  const { record, dimmed } = data;
  const accent = LEVEL_COLOR[record.overall_level] ?? "#6b7280";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(3px)`;
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "";
  };

  const scoreBar = Math.round((record.technical_score / 10) * 100);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: 220,
        background: selected ? "rgba(5,18,14,0.98)" : "rgba(4,14,10,0.95)",
        borderTop:    `1px solid ${selected ? accent : "rgba(16,185,129,0.12)"}`,
        borderRight:  `1px solid ${selected ? accent : "rgba(16,185,129,0.12)"}`,
        borderBottom: `1px solid ${selected ? accent : "rgba(16,185,129,0.12)"}`,
        borderLeft:   `3px solid ${accent}`,
        borderRadius: 9,
        padding: "12px 14px",
        transition: "opacity 0.25s ease, box-shadow 0.2s ease",
        opacity: dimmed ? 0.2 : 1,
        boxShadow: selected
          ? `0 0 0 1px ${accent}22, 0 20px 40px rgba(0,0,0,0.5)`
          : "0 4px 18px rgba(0,0,0,0.3)",
        cursor: "pointer",
        willChange: "transform",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: accent, border: "none", width: 6, height: 6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: accent, border: "none", width: 6, height: 6 }}
      />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{
          fontSize: 8.5, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase",
          color: accent, background: `${accent}14`, padding: "2px 7px",
          borderRadius: 4, border: `1px solid ${accent}30`,
        }}>
          {record.primary_language}
        </span>
        <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
          #{record.id}
        </span>
      </div>

      {/* Level + score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
          {record.overall_level}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>
          {record.technical_score}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>/10</span>
        </span>
      </div>

      {/* Score bar */}
      <div style={{
        height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 9999, marginBottom: 9, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${scoreBar}%`,
          background: `linear-gradient(to right, ${accent}99, ${accent})`,
          borderRadius: 9999, transition: "width 0.6s ease",
        }} />
      </div>

      {/* Path */}
      {record.working_directory && (
        <p style={{
          fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 7,
        }}>
          {record.working_directory}
        </p>
      )}

      {/* Timestamp */}
      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.25)" }}>
        {new Date(record.created_at).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: accent, border: "none", width: 6, height: 6 }}
      />
    </div>
  );
}
