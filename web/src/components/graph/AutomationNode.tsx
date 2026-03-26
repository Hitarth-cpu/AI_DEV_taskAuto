"use client";
import { Handle, Position } from "@xyflow/react";

const STATUS = {
  edited: { border: "#a855f7", label: "RAG trained", bg: "rgba(168,85,247,0.07)" },
  fixed:  { border: "#f59e0b", label: "",            bg: "rgba(245,158,11,0.07)" },
  clean:  { border: "#3b82f6", label: "",            bg: "rgba(59,130,246,0.05)"  },
};

export default function AutomationNode({ data, selected }: any) {
  const { record, dimmed } = data;
  let status: keyof typeof STATUS = "clean";
  let iterCount = 0;

  if (record.user_edited_script) {
    status = "edited";
  } else if (record.iteration_history) {
    try {
      const iters = JSON.parse(record.iteration_history);
      if (iters.length > 0) { status = "fixed"; iterCount = iters.length; }
    } catch {}
  }

  const c = STATUS[status];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(4px)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = "";
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: 270,
        background: selected ? "rgba(16,16,28,0.98)" : "rgba(11,11,20,0.95)",
        borderTop: `1px solid ${selected ? c.border : "rgba(255,255,255,0.07)"}`,
        borderRight: `1px solid ${selected ? c.border : "rgba(255,255,255,0.07)"}`,
        borderBottom: `1px solid ${selected ? c.border : "rgba(255,255,255,0.07)"}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: 10,
        padding: "14px 15px",
        transition: "opacity 0.25s ease, box-shadow 0.2s ease",
        opacity: dimmed ? 0.25 : 1,
        boxShadow: selected
          ? `0 0 0 1px ${c.border}22, 0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 4px 24px rgba(0,0,0,0.35)",
        cursor: "pointer",
        willChange: "transform",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: c.border, border: "none", width: 7, height: 7 }}
      />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase",
          color: c.border, background: c.bg, padding: "2px 7px", borderRadius: 4,
          border: `1px solid ${c.border}33`,
        }}>
          {record.target_env}
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
          #{record.id}
        </span>
      </div>

      {/* Intent */}
      <p style={{
        fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.85)",
        lineHeight: 1.45, marginBottom: 9,
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {record.intent}
      </p>

      {/* Working dir */}
      {record.working_directory && (
        <p style={{
          fontSize: 9.5, color: "rgba(255,255,255,0.25)", fontFamily: "monospace",
          marginBottom: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {record.working_directory}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)" }}>
          {new Date(record.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {iterCount > 0 && (
            <span style={{
              fontSize: 9, color: "#f59e0b", background: "rgba(245,158,11,0.1)",
              padding: "1px 6px", borderRadius: 3, border: "1px solid rgba(245,158,11,0.2)",
            }}>
              {iterCount} fix{iterCount > 1 ? "es" : ""}
            </span>
          )}
          {record.user_edited_script && (
            <span style={{
              fontSize: 9, color: "#a855f7", background: "rgba(168,85,247,0.1)",
              padding: "1px 6px", borderRadius: 3, border: "1px solid rgba(168,85,247,0.2)",
            }}>
              trained
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: c.border, border: "none", width: 7, height: 7 }}
      />
    </div>
  );
}
