"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Terminal, GitBranch, Cpu } from "lucide-react";

interface DetailPanelProps {
  node: any | null;
  onClose: () => void;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.3)", marginBottom: 8,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function CodeBox({ code, color = "rgba(255,255,255,0.65)" }: { code: string; color?: string }) {
  return (
    <pre style={{
      fontSize: 10.5, fontFamily: "monospace", color,
      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 7, padding: "10px 12px", overflowY: "auto", maxHeight: 160,
      lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-all",
    }}>
      {code}
    </pre>
  );
}

export default function DetailPanel({ node, onClose }: DetailPanelProps) {
  const record = node?.data?.record ?? node?.data?.iter ?? null;
  const isIter = !node?.data?.record;

  const iterations: any[] = (() => {
    if (!node?.data?.record) return [];
    try { return JSON.parse(node.data.record.iteration_history || "[]"); } catch { return []; }
  })();

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="detail"
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 36 }}
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 380,
            background: "rgba(9,9,16,0.97)",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px)",
            zIndex: 50, overflowY: "auto", padding: "20px",
            display: "flex", flexDirection: "column", gap: 0,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                {isIter ? "Fix Iteration" : "Automation Record"}
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", lineHeight: 1.35, maxWidth: 300 }}>
                {isIter ? node.data.iter?.reasoning : record?.intent}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, padding: "5px 6px", cursor: "pointer", color: "rgba(255,255,255,0.4)",
                flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Metadata badges */}
          {!isIter && record && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {[
                { icon: <Terminal size={10} />, label: record.target_env },
                { icon: <Clock size={10} />, label: new Date(record.created_at).toLocaleString() },
                record.working_directory && { icon: <Cpu size={10} />, label: record.working_directory },
                iterations.length > 0 && { icon: <GitBranch size={10} />, label: `${iterations.length} fix iteration${iterations.length > 1 ? "s" : ""}` },
              ].filter(Boolean).map((item: any, i) => (
                <span key={i} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 10, color: "rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  padding: "3px 8px", borderRadius: 5,
                }}>
                  {item.icon} {item.label}
                </span>
              ))}
            </div>
          )}

          {/* Script */}
          {!isIter && record?.generated_script && (
            <Section label="Generated script">
              <CodeBox code={record.generated_script} color="rgba(120,220,140,0.85)" />
            </Section>
          )}

          {/* Validation script */}
          {!isIter && record?.validation_script && (
            <Section label="Validation script">
              <CodeBox code={record.validation_script} color="rgba(100,180,255,0.8)" />
            </Section>
          )}

          {/* Blast radius */}
          {!isIter && record?.blast_radius_report && (
            <Section label="Blast radius">
              <div style={{
                fontSize: 11, color: "rgba(239,68,68,0.8)", background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.12)", borderRadius: 7, padding: "10px 12px",
                lineHeight: 1.55,
              }}>
                {record.blast_radius_report}
              </div>
            </Section>
          )}

          {/* User-edited script */}
          {!isIter && record?.user_edited_script && (
            <Section label="User-corrected script (RAG source)">
              <CodeBox code={record.user_edited_script} color="rgba(168,85,247,0.85)" />
            </Section>
          )}

          {/* Fix iterations timeline */}
          {!isIter && iterations.length > 0 && (
            <Section label="Fix iterations">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {iterations.map((iter: any, i: number) => (
                  <div key={i} style={{
                    background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)",
                    borderLeft: "2px solid rgba(245,158,11,0.4)", borderRadius: 7, padding: "10px 12px",
                  }}>
                    <p style={{ fontSize: 9.5, fontWeight: 700, color: "#f59e0b", marginBottom: 5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Attempt {i + 1}
                    </p>
                    <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.45, marginBottom: iter.error_output ? 8 : 0 }}>
                      {iter.reasoning}
                    </p>
                    {iter.error_output && (
                      <pre style={{
                        fontSize: 9.5, color: "rgba(239,68,68,0.65)", fontFamily: "monospace",
                        background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "6px 8px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {iter.error_output.split("\n")[0]}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Iter node: just show reasoning + error */}
          {isIter && (
            <>
              <Section label="Reasoning">
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
                  {node.data.iter?.reasoning || "—"}
                </p>
              </Section>
              {node.data.iter?.error_output && (
                <Section label="Error output">
                  <CodeBox code={node.data.iter.error_output} color="rgba(239,68,68,0.75)" />
                </Section>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
