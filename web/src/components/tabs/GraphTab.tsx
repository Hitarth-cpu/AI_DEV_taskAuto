"use client";
import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { RefreshCw, FolderOpen, Layers, Clock, AlertCircle } from "lucide-react";

const FlowGraph = dynamic(() => import("@/components/graph/FlowGraph"), { ssr: false });

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncatePath(p: string, max = 28) {
  if (!p) return "—";
  return p.length > max ? "..." + p.slice(-(max - 3)) : p;
}

export default function GraphTab() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("__all__");

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [autos, assess] = await Promise.all([api.automateHistory(), api.assessHistory()]);
      setAutomations(autos);
      setAssessments(assess);
    } catch (err: any) {
      setFetchError(err.message ?? "Failed to load data from backend");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // All unique project paths from both sources
  const projectKeys = useMemo(() => {
    const paths = new Set<string>();
    automations.forEach((r) => { if (r.working_directory) paths.add(r.working_directory); });
    assessments.forEach((r) => { if (r.working_directory) paths.add(r.working_directory); });
    return [...paths].sort();
  }, [automations, assessments]);

  const hasUnpinned = useMemo(
    () => automations.some((r) => !r.working_directory) || assessments.some((r) => !r.working_directory),
    [automations, assessments]
  );

  const visibleAutos = useMemo(() => {
    if (selectedProject === "__all__") return automations;
    if (selectedProject === "__none__") return automations.filter((r) => !r.working_directory);
    return automations.filter((r) => r.working_directory === selectedProject);
  }, [selectedProject, automations]);

  const visibleAssess = useMemo(() => {
    if (selectedProject === "__all__") return assessments;
    if (selectedProject === "__none__") return assessments.filter((r) => !r.working_directory);
    return assessments.filter((r) => r.working_directory === selectedProject);
  }, [selectedProject, assessments]);

  const stats = useMemo(() => {
    const fixed = visibleAutos.filter((r) => {
      try { return JSON.parse(r.iteration_history || "[]").length > 0; } catch { return false; }
    }).length;
    const trained = visibleAutos.filter((r) => r.user_edited_script).length;
    const allRecords = [...visibleAutos, ...visibleAssess];
    const last = allRecords.length > 0
      ? allRecords.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
      : null;
    return { autos: visibleAutos.length, assessCount: visibleAssess.length, fixed, trained, last };
  }, [visibleAutos, visibleAssess]);

  const projectRunCount = (key: string) => {
    const a = key === "__none__"
      ? automations.filter((r) => !r.working_directory).length
      : automations.filter((r) => r.working_directory === key).length;
    const b = key === "__none__"
      ? assessments.filter((r) => !r.working_directory).length
      : assessments.filter((r) => r.working_directory === key).length;
    return a + b;
  };

  const lastRunForKey = (key: string) => {
    const recs = [
      ...(key === "__none__"
        ? automations.filter((r) => !r.working_directory)
        : automations.filter((r) => r.working_directory === key)),
      ...(key === "__none__"
        ? assessments.filter((r) => !r.working_directory)
        : assessments.filter((r) => r.working_directory === key)),
    ];
    if (!recs.length) return "";
    return timeAgo(recs.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b).created_at);
  };

  const navItem = (key: string, label: string, sublabel?: string) => {
    const active = selectedProject === key;
    const count  = key === "__all__" ? automations.length + assessments.length : projectRunCount(key);
    return (
      <button
        key={key}
        onClick={() => setSelectedProject(key)}
        style={{
          width: "100%", textAlign: "left", padding: "9px 12px",
          background: active ? "rgba(59,130,246,0.08)" : "transparent",
          border: `1px solid ${active ? "rgba(59,130,246,0.25)" : "transparent"}`,
          borderRadius: 8, cursor: "pointer", transition: "all 0.15s ease", marginBottom: 3,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 400, color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)" }}>
            {label}
          </span>
          <span style={{
            fontSize: 9.5, color: active ? "#3b82f6" : "rgba(255,255,255,0.2)",
            background: active ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)",
            padding: "1px 6px", borderRadius: 3,
          }}>
            {count}
          </span>
        </div>
        {sublabel && (
          <p style={{ fontSize: 9.5, color: "rgba(255,255,255,0.22)", fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sublabel}
          </p>
        )}
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden" }}
    >
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,8,16,0.6)", backdropFilter: "blur(12px)", flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}>
            Project Graph
          </h2>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Automation timeline linked to code assessments — click any node to time-travel
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            { label: "scripts",    value: stats.autos,       color: "#3b82f6" },
            { label: "assessments",value: stats.assessCount,  color: "#10b981" },
            { label: "fixed",      value: stats.fixed,        color: "#f59e0b" },
            { label: "trained",    value: stats.trained,      color: "#a855f7" },
          ].map((s) => (
            <div key={s.label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "5px 12px", minWidth: 48,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
                {s.label}
              </span>
            </div>
          ))}

          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10.5,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.5)", padding: "7px 12px", borderRadius: 7,
              cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.38, type: "spring", stiffness: 200, damping: 28 }}
          style={{
            width: 210, flexShrink: 0, overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(7,7,14,0.8)", padding: "14px 10px",
          }}
        >
          <p style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.2)", marginBottom: 10, paddingLeft: 4,
          }}>
            Projects
          </p>

          {navItem("__all__", "All projects")}

          {projectKeys.length > 0 && (
            <div style={{ margin: "12px 0 6px", padding: "0 4px", display: "flex", alignItems: "center", gap: 5 }}>
              <FolderOpen size={10} style={{ color: "rgba(255,255,255,0.18)" }} />
              <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Paths
              </span>
            </div>
          )}

          {projectKeys.map((key) => navItem(key, truncatePath(key), lastRunForKey(key)))}

          {hasUnpinned && (
            <>
              <div style={{ margin: "12px 0 6px", padding: "0 4px", display: "flex", alignItems: "center", gap: 5 }}>
                <Layers size={10} style={{ color: "rgba(255,255,255,0.18)" }} />
                <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  No path
                </span>
              </div>
              {navItem("__none__", "Unspecified")}
            </>
          )}

          {stats.last && (
            <div style={{ paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Clock size={9} style={{ color: "rgba(255,255,255,0.2)" }} />
                <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Last activity
                </span>
              </div>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>{timeAgo(stats.last.created_at)}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {stats.last.intent ?? stats.last.primary_language}
              </p>
            </div>
          )}
        </motion.aside>

        {/* Graph canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.45 }}
          style={{ flex: 1, position: "relative", background: "#08080f" }}
        >
          {fetchError && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 20, display: "flex", alignItems: "center", gap: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "10px 16px", maxWidth: 480,
            }}>
              <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "rgba(239,68,68,0.85)" }}>
                Backend error: {fetchError}
              </span>
            </div>
          )}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.06)",
                borderTopColor: "rgba(59,130,246,0.5)",
                animation: "spin 0.9s linear infinite",
              }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Loading project graph</span>
            </div>
          ) : (
            <FlowGraph
              key={selectedProject}
              automations={visibleAutos}
              assessments={visibleAssess}
            />
          )}

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 12, left: 16, display: "flex", gap: 10, zIndex: 10, flexWrap: "wrap" }}>
            {[
              { color: "#10b981", label: "Assessment" },
              { color: "#3b82f6", label: "Clean run" },
              { color: "#f59e0b", label: "Had fixes" },
              { color: "#a855f7", label: "RAG trained" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: item.color + "22", border: `1.5px solid ${item.color}55`,
                }} />
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)" }}>{item.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 18, height: 1.5,
                background: "repeating-linear-gradient(to right, rgba(16,185,129,0.4) 0, rgba(16,185,129,0.4) 4px, transparent 4px, transparent 8px)",
              }} />
              <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)" }}>Linked</span>
            </div>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .react-flow__controls button {
          background: rgba(12,12,22,0.95) !important;
          border-color: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.5) !important;
          fill: rgba(255,255,255,0.5) !important;
        }
        .react-flow__controls button:hover { background: rgba(20,20,35,0.98) !important; }
        .react-flow__minimap { border-radius: 8px; overflow: hidden; }
      `}</style>
    </motion.div>
  );
}
