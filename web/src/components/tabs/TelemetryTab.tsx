"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RefreshCw, AlertCircle } from "lucide-react";

export default function TelemetryTab() {
  const [assessHistory, setAssessHistory] = useState<any[]>([]);
  const [autoHistory, setAutoHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [a, b] = await Promise.all([api.assessHistory(), api.automateHistory()]);
      setAssessHistory(a);
      setAutoHistory(b);
    } catch (err: any) {
      setFetchError(err.message ?? "Failed to load data from backend");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-1">SQL DB Telemetry</h2>
          <p className="text-sm text-neutral-400">Live view of all records stored in the local agent database.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-xl transition disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 mb-6 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>Backend error: {fetchError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assessments */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-neutral-800">
            SkillAssessmentRecords <span className="text-neutral-600 text-sm font-normal">({assessHistory.length})</span>
          </h3>
          <div className="space-y-4 max-h-[680px] overflow-y-auto pr-2">
            {assessHistory.length === 0 && <p className="text-sm text-neutral-600 italic">No assessments yet.</p>}
            {assessHistory.map((r) => (
              <div key={r.id} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition">
                <div className="flex justify-between text-xs text-neutral-500 mb-3 font-mono">
                  <span>#{r.id}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <span className="text-base font-semibold text-white capitalize">{r.primary_language}</span>
                  <span className="text-xs uppercase bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md">{r.overall_level}</span>
                  <span className="text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md">
                    {r.technical_score}/10
                  </span>
                </div>
                <pre className="text-xs text-neutral-400 font-mono bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-28 overflow-hidden">{r.raw_snippet}</pre>
                {r.test_execution_output && (
                  <pre className="mt-3 text-xs text-green-400/90 font-mono bg-neutral-950 border border-green-500/20 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {r.test_execution_output}
                  </pre>
                )}
                {r.tester_suggestions && (
                  <div className="mt-3 text-xs text-neutral-300 bg-neutral-800/60 border border-neutral-700 p-3 rounded-lg">
                    <strong className="text-white">QA Suggestions:</strong>{" "}
                    {(() => { try { return JSON.parse(r.tester_suggestions).join(" • "); } catch { return r.tester_suggestions; } })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Automations */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-neutral-800">
            AutomationMemory <span className="text-neutral-600 text-sm font-normal">({autoHistory.length})</span>
          </h3>
          <div className="space-y-4 max-h-[680px] overflow-y-auto pr-2">
            {autoHistory.length === 0 && <p className="text-sm text-neutral-600 italic">No automations yet.</p>}
            {autoHistory.map((r) => (
              <div key={r.id} className="relative bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition overflow-hidden">
                {r.user_edited_script && (
                  <span className="absolute top-0 right-0 text-[10px] uppercase font-bold text-green-400 bg-green-500/10 border-l border-b border-green-500/20 px-2 py-1 rounded-bl-xl">
                    RAG Trained
                  </span>
                )}
                <div className="flex justify-between text-xs text-neutral-500 mb-2 font-mono">
                  <span>#{r.id}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm font-medium text-white mb-3 leading-snug">"{r.intent}"</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="text-xs uppercase bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md">{r.target_env}</span>
                  {r.working_directory && (
                    <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                      {r.working_directory}
                    </span>
                  )}
                  {r.iteration_history && (() => { try { const h = JSON.parse(r.iteration_history); return h.length > 0 ? <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-md">{h.length} fix{h.length > 1 ? "es" : ""}</span> : null; } catch { return null; } })()}
                </div>
                <pre className="text-xs text-green-400/90 font-mono bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-36 overflow-y-auto">{r.generated_script}</pre>
                {r.user_edited_script && (
                  <pre className="mt-2 text-xs text-blue-400/90 font-mono bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-28 overflow-y-auto">{r.user_edited_script}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
