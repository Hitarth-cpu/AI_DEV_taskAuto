"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { ScriptSkeleton } from "@/components/Skeleton";
import KnowledgePanel from "@/components/automation/KnowledgePanel";
import VariablePanel from "@/components/automation/VariablePanel";
import DiffPanel from "@/components/automation/DiffPanel";
import HistorySidebar from "@/components/automation/HistorySidebar";
import TemplatesPanel from "@/components/automation/TemplatesPanel";
import { History, Save, Play, ShieldAlert, CheckCircle2 } from "lucide-react";

interface AutomationTabProps {
  agentStatus: "online" | "offline";
  onlineAgents: string[];
  executionLogs: string[];
  setExecutionLogs: React.Dispatch<React.SetStateAction<string[]>>;
  sendExecution: (script: string, isValidation: boolean, workingDir: string, token?: string) => void;
  onExit: (cb: (code: number, isValidation: boolean) => void) => void;
  activeResultRef: React.MutableRefObject<any>;
}

export default function AutomationTab({
  agentStatus,
  onlineAgents,
  executionLogs,
  setExecutionLogs,
  sendExecution,
  onExit,
  activeResultRef,
}: AutomationTabProps) {
  const [task, setTask] = useState("");
  const [env, setEnv] = useState("linux");
  const [workDir, setWorkDir] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("lastWorkDir") ?? "" : ""
  );
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoValidate, setAutoValidate] = useState(true);

  // Script editing
  const [editedScript, setEditedScript] = useState("");
  const [userCorrection, setUserCorrection] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);

  // Knowledge base
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const refreshDocs = () => api.knowledgeList().then(setKnowledgeDocs).catch(() => {});
  useEffect(() => { refreshDocs(); }, []);

  // Fix-it loop
  const [fixItIteration, setFixItIteration] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const [showFixOffer, setShowFixOffer] = useState(false);
  const [fixHistory, setFixHistory] = useState<Array<{ iteration: number; original: string; fixed: string; reasoning: string }>>([]);

  const fixIterRef = useRef(0);
  const logsRef = useRef<string[]>([]);
  useEffect(() => { fixIterRef.current = fixItIteration; }, [fixItIteration]);
  useEffect(() => { logsRef.current = executionLogs; }, [executionLogs]);

  // Keep activeResultRef in sync
  useEffect(() => { activeResultRef.current = result; }, [result]);

  // Active agent token (auto-set to first connected; user can override via dropdown)
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  useEffect(() => {
    if (onlineAgents.length > 0 && !onlineAgents.includes(selectedAgent)) {
      setSelectedAgent(onlineAgents[0]);
    }
    if (onlineAgents.length === 0) setSelectedAgent("");
  }, [onlineAgents]);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Save-as-template modal
  const [saveModal, setSaveModal] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplTags, setTplTags] = useState("");

  // Tabs for result area
  const [resultTab, setResultTab] = useState<"script" | "validation" | "blast">("script");

  // Wire exit callback
  useEffect(() => {
    onExit((code, isValidation) => {
      if (code !== 0 && !isValidation && fixIterRef.current < 3) {
        setShowFixOffer(true);
      }
      if (code === 0 && autoValidate && activeResultRef.current?.validation_script && !isValidation) {
        setExecutionLogs((p) => [...p, "\n[SYSTEM] Auto-running validation test…\n"]);
        sendExecution(activeResultRef.current.validation_script, true, workDir, selectedAgent || undefined);
      }
    });
  }, [autoValidate, workDir]);

  const reset = () => {
    setFixItIteration(0);
    setShowFixOffer(false);
    setFixHistory([]);
    setEditedScript("");
    setCorrectionSaved(false);
    setExecutionLogs([]);
    setResultTab("script");
  };

  const handleGenerate = async () => {
    if (!task.trim()) return;
    reset();
    setLoading(true);
    setResult(null);
    if (workDir) localStorage.setItem("lastWorkDir", workDir);
    try {
      const data: any = await api.automate({ task_description: task, target_env: env, working_directory: workDir });
      setResult(data);
      setEditedScript(data.script);
      if (data.blast_radius_report?.length > 0) setResultTab("blast");
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = (script: string, isValidation = false) => {
    if (!script) return;
    const pathLabel = workDir.trim() || "(daemon's current directory)";
    const agentLabel = selectedAgent || onlineAgents[0] || "default_agent";
    if (!window.confirm(`Run ${isValidation ? "Validation" : "Primary"} script?\n\nDirectory: ${pathLabel}\nAgent: ${agentLabel}`)) return;
    setExecutionLogs([]);
    setShowFixOffer(false);
    sendExecution(script, isValidation, workDir.trim(), agentLabel);
  };

  const handleAutoFix = async () => {
    if (fixIterRef.current >= 3 || !activeResultRef.current) return;
    const newIter = fixIterRef.current + 1;
    const prevScript = activeResultRef.current.script;
    setFixItIteration(newIter);
    setIsFixing(true);
    setShowFixOffer(false);
    try {
      const fixedData: any = await api.automateFix({
        original_intent: task,
        failed_script: prevScript,
        error_output: logsRef.current.join("").slice(-2000),
        target_env: env,
        iteration: newIter,
        record_id: activeResultRef.current.id ?? null,
        working_directory: workDir,
      });
      setFixHistory((p) => [...p, { iteration: newIter, original: prevScript, fixed: fixedData.script, reasoning: fixedData.reasoning }]);
      setResult(fixedData);
      setEditedScript(fixedData.script);
      setExecutionLogs([]);
      toast.success(`Fix attempt ${newIter} generated — review & run`);
    } catch (err: any) {
      toast.error(`Fix failed: ${err.message}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!userCorrection.trim()) return;
    if (!result?.id) {
      toast.error("No record ID — generate a script first before submitting a correction.");
      return;
    }
    try {
      await api.automateEdit({ id: result.id, task_description: task, target_env: env, user_edited_script: userCorrection });
      setCorrectionSaved(true);
      toast.success("Correction saved — regenerating improved script…");
      // Immediately rebuild so the AI uses the correction as RAG context right now
      await handleGenerate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveTemplate = async () => {
    if (!result || !tplName.trim()) return;
    try {
      await api.templatesCreate({
        name: tplName, description: tplDesc, script: result.script,
        validation_script: result.validation_script, target_env: env, tags: tplTags,
      });
      toast.success(`Template "${tplName}" saved`);
      setSaveModal(false); setTplName(""); setTplDesc(""); setTplTags("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLoadTemplate = (tpl: any) => {
    setResult({ script: tpl.script, validation_script: tpl.validation_script, reasoning: `Loaded from template: ${tpl.name}`, blast_radius_report: [] });
    setEditedScript(tpl.script);
    setEnv(tpl.target_env);
    toast.success(`Template "${tpl.name}" loaded`);
  };

  const handleRerun = (rec: any) => {
    setTask(rec.intent);
    setEnv(rec.target_env);
    setResult({ id: rec.id, script: rec.generated_script, validation_script: rec.validation_script, reasoning: rec.reasoning, blast_radius_report: rec.blast_radius_report ? JSON.parse(rec.blast_radius_report) : [] });
    setEditedScript(rec.generated_script);
    reset();
    toast.success("Script loaded from history");
  };

  const scriptLang = env === "windows" ? "powershell" : "bash";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <HistorySidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onRerun={handleRerun} />

      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-2xl font-semibold">Automation Engine</h2>
          <p className="text-neutral-400 text-sm mt-0.5">Describe an engineering objective to generate a cross-platform script instantly.</p>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 px-3 py-1.5 rounded-lg transition">
          <History size={13} /> History
        </button>
      </div>

      {/* Knowledge Base */}
      <div className="mt-4">
        <KnowledgePanel docs={knowledgeDocs} onRefresh={refreshDocs} />
        <TemplatesPanel onLoad={handleLoadTemplate} />
      </div>

      {/* Intent input */}
      <div className="mb-4">
        <label className="text-sm text-neutral-400 block mb-1.5 font-medium">Intent Description</label>
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50 transition"
          placeholder="e.g. Scrape all error logs from /tmp and zip them…"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm text-neutral-400 block mb-1.5 font-medium">Target Environment</label>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition"
          >
            <option value="linux">Linux / macOS (Bash)</option>
            <option value="windows">Windows (PowerShell)</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400 block mb-1.5 font-medium">
            Execution Directory <span className="text-neutral-600 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-200 focus:outline-none focus:border-neutral-600 transition placeholder-neutral-600"
              placeholder="e.g. /home/user/project"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
            />
            {workDir && (
              <button onClick={() => setWorkDir("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white text-xs">✕</button>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !task.trim()}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-500 transition shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:opacity-50 disabled:shadow-none"
      >
        {loading ? "Generating…" : "Build Script"}
      </button>

      {loading && <ScriptSkeleton />}

      {result && (
        <div className="mt-8 space-y-5">
          {/* Tabbed result header */}
          <div className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 bg-neutral-950 border border-neutral-800 rounded-xl p-1">
                {(["script", "validation", "blast"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setResultTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      resultTab === t ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                    }`}
                  >
                    {t === "script" ? "Script" : t === "validation" ? "Validation" : `Blast Radius${result.blast_radius_report?.length ? ` (${result.blast_radius_report.length})` : ""}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                  <input type="checkbox" checked={autoValidate} onChange={(e) => setAutoValidate(e.target.checked)} className="accent-blue-500 w-3 h-3" />
                  Auto-validate
                </label>
                {result.id && (
                  <button
                    onClick={() => setSaveModal(true)}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Save size={11} /> Save as Template
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  {onlineAgents.length > 1 && (
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 font-mono"
                    >
                      {onlineAgents.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => handleRun(result.script)}
                    disabled={agentStatus === "offline"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      agentStatus === "online"
                        ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30"
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${agentStatus === "online" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" : "bg-red-500"}`} />
                    {agentStatus === "online"
                      ? `Run via ${onlineAgents[0] ?? "CLI"}`
                      : "Agent Offline"}
                  </button>
                </div>
              </div>
            </div>

            {/* Script tab */}
            {resultTab === "script" && (
              <>
                <VariablePanel script={editedScript} onApply={(s) => setEditedScript(s)} />
                <CodeBlock
                  code={editedScript}
                  language={scriptLang}
                  height="280px"
                  label={env === "windows" ? "output.ps1" : "output.sh"}
                  readOnly={false}
                  onChange={setEditedScript}
                />
              </>
            )}

            {/* Validation tab */}
            {resultTab === "validation" && result.validation_script && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500">Verifies the main script succeeded (exits 0 on success).</p>
                  <button
                    onClick={() => handleRun(result.validation_script, true)}
                    disabled={agentStatus === "offline"}
                    className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition disabled:opacity-50"
                  >
                    <Play size={10} /> Run Validation
                  </button>
                </div>
                <CodeBlock code={result.validation_script} language={scriptLang} height="200px" label="validation script" />
              </div>
            )}
            {resultTab === "validation" && !result.validation_script && (
              <p className="text-sm text-neutral-600 italic">No validation script generated.</p>
            )}

            {/* Blast radius tab */}
            {resultTab === "blast" && (
              <div>
                {result.blast_radius_report?.length > 0 ? (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert size={15} className="text-red-400" />
                      <span className="text-sm font-semibold text-red-400">Destructive Actions Detected</span>
                    </div>
                    <ul className="text-sm text-neutral-300 space-y-1.5 list-disc pl-4">
                      {result.blast_radius_report.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 size={15} />
                    No destructive actions detected — safe to execute.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Execution logs */}
          {executionLogs.length > 0 && (
            <div className="animate-in fade-in">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Live Terminal
              </h4>
              <div className="bg-black/80 border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 h-52 overflow-y-auto whitespace-pre-wrap">
                {executionLogs.map((l, i) => <span key={i} className="block">{l}</span>)}
                <div className="text-neutral-600 animate-pulse mt-1">_</div>
              </div>
            </div>
          )}

          {/* Fix-It offer */}
          {showFixOffer && fixItIteration < 3 && (
            <div className="animate-in fade-in bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-400 mb-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                Execution Failed — Auto Fix-It Available
              </h4>
              <p className="text-xs text-neutral-400 mb-3">
                The AI will analyse the error logs and produce a corrected script. (Attempt {fixItIteration + 1}/3)
              </p>
              <button
                onClick={handleAutoFix}
                disabled={isFixing}
                className="flex items-center gap-2 bg-orange-600/20 text-orange-400 border border-orange-500/30 px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600/30 transition disabled:opacity-50"
              >
                {isFixing ? <><span className="animate-spin">↻</span> Generating fix…</> : `🔁 Auto-Fix (Attempt ${fixItIteration + 1}/3)`}
              </button>
            </div>
          )}

          {fixItIteration >= 3 && showFixOffer && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 font-medium">
              ⛔ Max fix iterations reached. Manual intervention required.
            </div>
          )}

          {/* Diff history */}
          {fixHistory.map((entry) => (
            <DiffPanel key={entry.iteration} original={entry.original} fixed={entry.fixed} iteration={entry.iteration} language={scriptLang} />
          ))}

          {/* Agent reasoning */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Agent Reasoning</h4>
            <p className="text-sm text-neutral-300 bg-neutral-900/40 border border-neutral-800/50 p-4 rounded-xl leading-relaxed">{result.reasoning}</p>
          </div>

          {/* Self-improving loop */}
          <div className="pt-5 border-t border-neutral-800">
            <h4 className="text-sm font-medium text-white mb-1">Self-Improving Loop</h4>
            <p className="text-xs text-neutral-500 mb-3">
              Did the AI make a mistake? Submit your corrected script — it will be used as RAG context for future generations.
            </p>
            <CodeBlock
              code={userCorrection}
              language={scriptLang}
              height="120px"
              label="paste your corrected script…"
              showCopy={false}
              readOnly={false}
              onChange={setUserCorrection}
            />
            <button
              onClick={handleSaveCorrection}
              disabled={correctionSaved || !userCorrection.trim()}
              className="mt-3 bg-neutral-800 text-neutral-200 px-4 py-2 rounded-xl text-xs font-medium hover:bg-neutral-700 transition disabled:opacity-50"
            >
              {correctionSaved ? "✓ Saved to memory" : "Submit Correction"}
            </button>
          </div>
        </div>
      )}

      {/* Save as Template modal */}
      {saveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save as Template</h3>
            <div className="space-y-3">
              <input
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                placeholder="Template name *"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
              <input
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                placeholder="Description (optional)"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
              />
              <input
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                placeholder="Tags (comma-separated, optional)"
                value={tplTags}
                onChange={(e) => setTplTags(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setSaveModal(false)} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition">Cancel</button>
              <button
                onClick={handleSaveTemplate}
                disabled={!tplName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-500 transition disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
