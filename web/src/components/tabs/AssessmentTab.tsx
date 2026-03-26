"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { AssessmentSkeleton } from "@/components/Skeleton";

const LANGUAGES = ["python", "javascript", "typescript", "bash", "powershell", "go", "java", "rust"];

export default function AssessmentTab() {
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("python");
  const [projectPath, setProjectPath] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAssess = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await api.assess({
        code_snippet: code,
        language: lang,
        ...(projectPath.trim() ? { working_directory: projectPath.trim() } : {}),
      });
      setResult(data);
    } catch (err: any) {
      toast.error(`Assessment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const severityClass = (s: string) =>
    s === "High"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : s === "Medium"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold mb-1">Code Skill Assessment</h2>
      <div className="flex items-center justify-between mb-4">
        <p className="text-neutral-400 text-sm">
          Paste a snippet — the AI executes it locally, then delivers a QA + proficiency review.
        </p>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition capitalize"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Optional project path */}
      <div className="mb-4">
        <input
          type="text"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="Project path (optional — links this assessment to the Graph view)"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 font-mono transition"
        />
      </div>

      {/* Monaco editor for input */}
      <div className="mb-4">
        <CodeBlock
          code={code}
          language={lang}
          height="260px"
          label={`paste ${lang} snippet here…`}
          showCopy={false}
          readOnly={false}
          onChange={setCode}
        />
      </div>

      <button
        onClick={handleAssess}
        disabled={loading || !code.trim()}
        className="bg-neutral-100 text-neutral-900 px-6 py-2 rounded-xl text-sm font-medium hover:bg-white transition disabled:opacity-50"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAssess(); }}
      >
        {loading ? "Analysing…" : "Analyse Code"}
      </button>

      {loading && <AssessmentSkeleton />}

      {result && (
        <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold">Results ({result.primary_language})</h3>
            <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold uppercase">
              {result.overall_level}
            </span>
          </div>

          {/* Score + Strengths */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs text-neutral-500 block mb-1">Technical Score</span>
              <span className="text-3xl font-bold">{result.technical_score}</span>
              <span className="text-neutral-500 text-sm"> / 10</span>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs text-neutral-500 block mb-2">Key Strengths</span>
              <ul className="text-sm list-disc pl-4 text-neutral-300 space-y-0.5">
                {result.key_strengths?.length > 0
                  ? result.key_strengths.map((s: string, i: number) => <li key={i}>{s}</li>)
                  : <li className="text-neutral-600">None identified</li>}
              </ul>
            </div>
          </div>

          {/* Areas for improvement */}
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Areas for Improvement
          </h4>
          <div className="space-y-2 mb-6">
            {result.areas_for_improvement?.map((item: any, i: number) => (
              <div
                key={i}
                className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityClass(item.severity)}`}>
                    {item.severity}
                  </span>
                  <span className="text-sm font-medium text-neutral-200">{item.issue}</span>
                </div>
                <p className="text-xs text-neutral-400">{item.suggestion}</p>
              </div>
            ))}
          </div>

          {/* QA execution output */}
          {result.test_execution_output && (
            <>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-4">
                QA Execution Output
              </h4>
              <CodeBlock
                code={result.test_execution_output}
                language="shell"
                height="140px"
                label="stdout / stderr"
                showCopy={false}
              />
            </>
          )}

          {/* Tester suggestions */}
          {result.tester_suggestions?.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-5">
                QA Tester Suggestions
              </h4>
              <ul className="text-sm list-disc pl-4 text-neutral-300 space-y-1">
                {result.tester_suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
