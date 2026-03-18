"use client";

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assessment' | 'automation' | 'telemetry'>('overview');
  
  // States for Assessment
  const [assessmentCode, setAssessmentCode] = useState('');
  const [assessmentLang, setAssessmentLang] = useState('python');
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  // States for Automation
  const [automationTask, setAutomationTask] = useState('');
  const [automationEnv, setAutomationEnv] = useState('linux');
  const [automationResult, setAutomationResult] = useState<any>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const [userEditedScript, setUserEditedScript] = useState('');
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [executionPath, setExecutionPath] = useState('');

  // Zero-Click Execution States
  const [remoteAgentStatus, setRemoteAgentStatus] = useState<'offline'|'online'>('online'); // default assumed online for MVP dev
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [autoValidate, setAutoValidate] = useState(true);
  
  // Use a ref to hold the latest automation result to access it inside the WebSocket callback
  const activeResultRef = useRef<any>(null);
  useEffect(() => {
    activeResultRef.current = automationResult;
  }, [automationResult]);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(7);
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/ui/${sessionId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'agent_status') {
        setRemoteAgentStatus(data.status);
      } else if (data.type === 'log') {
        setExecutionLogs(prev => [...prev, data.data]);
      } else if (data.type === 'exit') {
        setExecutionLogs(prev => [...prev, `\n[Process exited with code ${data.code}]`]);
        
        // Auto-run validation script if successful
        if (data.code === 0 && autoValidate && activeResultRef.current?.validation_script && data.is_validation !== true) {
          setExecutionLogs(prev => [...prev, `\n[SYSTEM] Auto-Running Validation Test...\n`]);
          ws.send(JSON.stringify({
            action: "execute_remote",
            token: "default_agent",
            script: activeResultRef.current.validation_script,
            is_validation: true
          }));
        }
      } else if (data.type === 'error') {
        alert(data.message);
      }
    };

    setWsConnection(ws);
    return () => ws.close();
  }, []);

  const handleRemoteExecution = (scriptToRun: string, isValidation: boolean = false) => {
    if (!wsConnection || !scriptToRun) return;

    // Confirm with user showing the execution path
    const pathLabel = executionPath.trim() || '(daemon\'s current directory)';
    const actionLabel = isValidation ? 'Validation' : 'Primary';
    const confirmed = window.confirm(
      `Run ${actionLabel} Script?\n\nExecution directory: ${pathLabel}\n\nContinue?`
    );
    if (!confirmed) return;

    setExecutionLogs(prev => [...prev, `\n[SYSTEM] Initiating remote execution... (${isValidation ? 'Validation' : 'Primary'})\n`]);
    wsConnection.send(JSON.stringify({
      action: "execute_remote",
      token: "default_agent",
      script: scriptToRun,
      is_validation: isValidation,
      working_directory: executionPath.trim()
    }));
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // States for Telemetry
  const [assessHistory, setAssessHistory] = useState<any[]>([]);
  const [autoHistory, setAutoHistory] = useState<any[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const fetchHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const [resAssess, resAuto] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/v1/assess/history'),
        fetch('http://127.0.0.1:8000/api/v1/automate/history')
      ]);
      setAssessHistory(await resAssess.json());
      setAutoHistory(await resAuto.json());
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'telemetry') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleAssessment = async () => {
    if (!assessmentCode.trim()) return;
    setIsAssessing(true);
    setAssessmentResult(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_snippet: assessmentCode, language: assessmentLang })
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAssessmentResult(data);
    } catch (error) {
      console.error(error);
      alert("Error processing assessment. Is the backend running?");
    } finally {
      setIsAssessing(false);
    }
  };

  const handleAutomation = async () => {
    if (!automationTask.trim()) return;
    setIsAutomating(true);
    setAutomationResult(null);
    setEditSubmitted(false);
    setUserEditedScript('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_description: automationTask, target_env: automationEnv, working_directory: executionPath.trim() })
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAutomationResult(data);
    } catch (error) {
      console.error(error);
      alert("Error processing automation. Is the backend running?");
    } finally {
      setIsAutomating(false);
    }
  };

  const submitCorrection = async () => {
    if (!automationResult?.id || !userEditedScript.trim()) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/automate/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: automationResult.id,
          task_description: automationTask,
          target_env: automationEnv,
          user_edited_script: userEditedScript 
        })
      });
      if (res.ok) setEditSubmitted(true);
    } catch (e) {
      console.error("Failed to submit correction", e);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 px-6 py-4 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold tracking-tight cursor-pointer" onClick={() => setActiveTab('overview')}>AI Dev Agent</h1>
        <nav className="flex gap-4 text-sm font-medium">
          <button onClick={() => setActiveTab('overview')} className={`${activeTab === 'overview' ? 'text-white' : 'text-neutral-400'} hover:text-white transition-colors`}>Dashboard</button>
          <button onClick={() => setActiveTab('assessment')} className={`${activeTab === 'assessment' ? 'text-white' : 'text-neutral-400'} hover:text-white transition-colors`}>Skills</button>
          <button onClick={() => setActiveTab('automation')} className={`${activeTab === 'automation' ? 'text-white' : 'text-neutral-400'} hover:text-white transition-colors`}>Automation</button>
          <button onClick={() => setActiveTab('telemetry')} className={`${activeTab === 'telemetry' ? 'text-white' : 'text-neutral-400'} hover:text-white transition-colors`}>Telemetry DB</button>
        </nav>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-12">
        {activeTab === 'overview' && (
          <>
            <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-semibold mb-3 tracking-tight">Agent Overview</h2>
              <p className="text-neutral-400 max-w-2xl leading-relaxed text-sm">
                Monitor and automate your development lifecycle. Review assessed scripts, execute local automations, and optimize your workflows seamlessly.
              </p>
            </section>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 shadow-sm hover:border-neutral-700 transition flex flex-col">
                  <h3 className="text-lg font-medium mb-2 text-white">Skill Assessment Engine</h3>
                  <p className="text-sm text-neutral-400 mb-6 flex-1">Analyze code proficiency and detect anti-patterns instantly.</p>
                  <button onClick={() => setActiveTab('assessment')} className="bg-neutral-800 text-neutral-200 border border-neutral-700 w-full px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-700 transition">Run Assessment</button>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 shadow-sm hover:border-neutral-700 transition flex flex-col">
                  <h3 className="text-lg font-medium mb-2 text-white">Automation Execution</h3>
                  <p className="text-sm text-neutral-400 mb-6 flex-1">Generate dynamic scripts (Bash, PowerShell) via plain English.</p>
                  <button onClick={() => setActiveTab('automation')} className="bg-blue-600 text-white px-4 py-2 w-full rounded-lg text-sm font-medium hover:bg-blue-500 transition shadow-[0_0_15px_rgba(37,99,235,0.3)]">Request Automation</button>
                </div>
             </div>
          </>
        )}

        {activeTab === 'assessment' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold mb-2">Code Skill Assessment</h2>
            <div className="flex justify-between items-end mb-4">
              <p className="text-neutral-400 text-sm">Paste a code snippet below to evaluate its complexity, quality, and potential issues.</p>
              <select 
                 className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition"
                 value={assessmentLang}
                 onChange={(e) => setAssessmentLang(e.target.value)}
              >
                 <option value="python">Python</option>
                 <option value="javascript">JavaScript (Node)</option>
                 <option value="bash">Bash</option>
                 <option value="powershell">PowerShell</option>
              </select>
            </div>
            
            <textarea 
              className="w-full h-64 bg-neutral-900 border border-neutral-800 rounded-lg p-4 font-mono text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 mb-4 transition"
              placeholder={`Paste your ${assessmentLang} snippet here...`}
              value={assessmentCode}
              onChange={(e) => setAssessmentCode(e.target.value)}
            />
            
            <button 
              onClick={handleAssessment} 
              disabled={isAssessing || !assessmentCode.trim()}
              className="bg-neutral-100 text-neutral-900 px-6 py-2 rounded-lg text-sm font-medium hover:bg-white transition disabled:opacity-50"
            >
              {isAssessing ? 'Processing...' : 'Analyze Code'}
            </button>

            {assessmentResult && (
              <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Results ({assessmentResult.primary_language})</h3>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-semibold">{assessmentResult.overall_level}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-500 block mb-1">Technical Score</span>
                    <span className="text-2xl font-bold">{assessmentResult.technical_score} / 10</span>
                  </div>
                  <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-500 block mb-1">Key Strengths</span>
                    <ul className="text-sm list-disc pl-4 text-neutral-300">
                      {assessmentResult.key_strengths.length > 0 ? 
                        assessmentResult.key_strengths.map((s: string, i: number) => <li key={i}>{s}</li>) : 
                        <li>None identified</li>}
                    </ul>
                  </div>
                </div>

                <h4 className="text-sm font-semibold mb-3 text-neutral-400 uppercase tracking-wider">Areas for Improvement</h4>
                <div className="space-y-3">
                  {assessmentResult.areas_for_improvement.map((item: any, i: number) => (
                    <div key={i} className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          item.severity === 'High' ? 'bg-red-500/20 text-red-500' :
                          item.severity === 'Medium' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-500'
                        }`}>{item.severity}</span>
                        <span className="text-sm font-medium text-neutral-200">{item.issue}</span>
                      </div>
                      <span className="text-sm text-neutral-400">{item.suggestion}</span>
                    </div>
                  ))}
                </div>

                {assessmentResult.test_execution_output && (
                  <>
                    <h4 className="text-sm font-semibold mb-3 mt-8 text-neutral-400 uppercase tracking-wider">QA Tester Execution Output</h4>
                    <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {assessmentResult.test_execution_output}
                    </div>

                    <h4 className="text-sm font-semibold mb-3 mt-6 text-neutral-400 uppercase tracking-wider">QA Tester Suggestions</h4>
                    <ul className="text-sm list-disc pl-4 text-neutral-300 mb-4 space-y-1">
                      {assessmentResult.tester_suggestions && assessmentResult.tester_suggestions.length > 0 ? 
                        assessmentResult.tester_suggestions.map((s: string, i: number) => <li key={i}>{s}</li>) : 
                        <li className="text-neutral-500">No specific execution suggestions.</li>}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold mb-2">Automation Engine</h2>
            <p className="text-neutral-400 text-sm mb-6">Describe an engineering objective to generate a cross-platform script instantly.</p>
            
            <div className="mb-4">
               <label className="text-sm text-neutral-400 block mb-2 font-medium">Intent Description</label>
               <input 
                 className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition"
                 placeholder="e.g. Scrape all error logs from the temp directory and zip them..."
                 value={automationTask}
                 onChange={(e) => setAutomationTask(e.target.value)}
                 onKeyDown={(e) => { if(e.key === 'Enter') handleAutomation() }}
               />
            </div>

            <div className="mb-6">
               <label className="text-sm text-neutral-400 block mb-2 font-medium">Target Environment</label>
               <select 
                 className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600 transition"
                 value={automationEnv}
                 onChange={(e) => setAutomationEnv(e.target.value)}
               >
                 <option value="linux">Linux / macOS (Bash)</option>
                 <option value="windows">Windows (PowerShell)</option>
               </select>
            </div>

            <div className="mb-6">
               <label className="text-sm text-neutral-400 block mb-2 font-medium">
                 Execution Directory
                 <span className="ml-2 text-xs text-neutral-600 font-normal">(optional — where the script will run)</span>
               </label>
               <div className="relative">
                 <input
                   className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-200 font-mono focus:outline-none focus:border-neutral-600 transition placeholder-neutral-600"
                   placeholder={`e.g. D:\\my-project  or  /home/user/project`}
                   value={executionPath}
                   onChange={(e) => setExecutionPath(e.target.value)}
                 />
                 {executionPath.trim() && (
                   <button
                     onClick={() => setExecutionPath('')}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 text-xs transition"
                   >✕ clear</button>
                 )}
               </div>
               {executionPath.trim() && (
                 <p className="mt-1.5 text-xs text-blue-400/80 flex items-center gap-1">
                   <span>▶</span> Scripts will execute in: <span className="font-mono">{executionPath.trim()}</span>
                 </p>
               )}
            </div>
            
            <button 
              onClick={handleAutomation} 
              disabled={isAutomating || !automationTask.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition shadow-[0_0_15px_rgba(37,99,235,0.2)] disabled:opacity-50 disabled:shadow-none"
            >
              {isAutomating ? 'Generating...' : 'Build Script'}
            </button>

            {automationResult && (
              <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <h3 className="text-lg font-medium mb-4">Generated Automation</h3>
                
                <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden mb-4">
                  <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex justify-between items-center text-xs text-neutral-400 font-mono">
                    <span>{automationEnv === 'windows' ? 'output.ps1' : 'output.sh'}</span>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer hover:text-neutral-300 transition">
                        <input 
                          type="checkbox" 
                          checked={autoValidate} 
                          onChange={(e) => setAutoValidate(e.target.checked)}
                          className="w-3 h-3 accent-blue-500 rounded bg-neutral-800 border-neutral-700"
                        />
                        Auto-Validate
                      </label>
                      <button 
                        onClick={() => handleRemoteExecution(automationResult.script)}
                        disabled={remoteAgentStatus === 'offline'}
                        className={`px-3 py-1 rounded transition flex items-center gap-2 ${remoteAgentStatus === 'online' ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-medium' : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${remoteAgentStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></span>
                        {remoteAgentStatus === 'online' ? 'Run via Remote CLI' : 'Agent Offline'}
                      </button>
                      <button 
                        onClick={() => handleCopy(automationResult.script)} 
                        className="p-1 hover:bg-neutral-800 text-neutral-300 rounded transition flex items-center gap-1.5"
                      >
                        {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {isCopied ? <span className="text-green-400">Copied</span> : <span>Copy</span>}
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm font-mono text-green-400">
                    <code>{automationResult.script}</code>
                  </pre>
                </div>

                {/* Zero-Click Execution Terminal Stream */}
                {executionLogs.length > 0 && (
                  <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-green-400 uppercase tracking-wider">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Live Terminal Execution
                    </h4>
                    <div className="bg-black/80 rounded-lg border border-neutral-800 p-4 font-mono text-xs text-neutral-300 h-48 overflow-y-auto whitespace-pre-wrap shadow-inner relative">
                       {executionLogs.map((log, i) => (
                         <span key={i} className="block">{log}</span>
                       ))}
                       <div className="mt-2 text-neutral-600 animate-pulse">_</div>
                    </div>
                  </div>
                )}

                <h4 className="text-sm font-semibold mb-2 text-neutral-400 uppercase tracking-wider">Agent Reasoning</h4>
                <p className="text-sm text-neutral-300 bg-neutral-800/30 p-4 rounded-lg border border-neutral-800/50 mb-6">
                  {automationResult.reasoning}
                </p>

                {automationResult.blast_radius_report && automationResult.blast_radius_report.length > 0 && (
                  <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-red-400 uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                      Blast Radius Safety Report
                    </h4>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                      <p className="text-xs text-red-400 mb-3 font-medium">⚠️ Destructive Action Detected. Review carefully before execution.</p>
                      <ul className="text-sm list-disc pl-4 text-neutral-300 space-y-1">
                        {automationResult.blast_radius_report.map((warning: string, i: number) => (
                           <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {automationResult.validation_script && (
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                       <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
                         <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                         Automated Validation Test
                       </h4>
                       <button 
                         onClick={() => handleRemoteExecution(automationResult.validation_script, true)}
                         disabled={remoteAgentStatus === 'offline'}
                         className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded font-medium disabled:opacity-50"
                       >
                         Run Validation
                       </button>
                    </div>
                    <p className="text-xs text-neutral-400 mb-2">This script checks if the above automation succeeded without errors.</p>
                    <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg overflow-x-auto text-xs font-mono text-blue-300">
                      <code>{automationResult.validation_script}</code>
                    </pre>
                  </div>
                )}

                {/* The Self-Improving Loop Hook */}
                <div className="pt-6 border-t border-neutral-800">
                  <h4 className="text-md font-medium text-white mb-2">Self-Improving Loop</h4>
                  <p className="text-xs text-neutral-400 mb-4">Did the agent make a mistake? Paste your corrected robust script below. The agent will learn this for the future via RAG.</p>
                  <textarea 
                    className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-3 font-mono text-xs text-neutral-300 focus:outline-none focus:border-neutral-600 mb-3"
                    placeholder="Paste working script here..."
                    value={userEditedScript}
                    onChange={(e) => setUserEditedScript(e.target.value)}
                  />
                  <button 
                    onClick={submitCorrection}
                    disabled={editSubmitted || !userEditedScript.trim()}
                    className="bg-neutral-800 text-neutral-200 px-4 py-2 rounded-lg text-xs font-medium hover:bg-neutral-700 transition disabled:opacity-50"
                  >
                    {editSubmitted ? 'Team Preference Saved!' : 'Submit Correction to DB'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-1">SQL DB Telemetry</h2>
                <p className="text-neutral-400 text-sm">Visualizing the contents of your Microsoft SQL Server memory schemas.</p>
              </div>
              <button 
                onClick={fetchHistory}
                disabled={isFetchingHistory}
                className="bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-neutral-700 transition"
              >
                Refresh Data
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Skill History Table */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-6 border-b border-neutral-800 pb-3">SkillAssessmentsRecord</h3>
                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                  {assessHistory.length === 0 ? <p className="text-base text-neutral-500">No assessments logged yet.</p> : null}
                  {assessHistory.map((record) => (
                    <div key={record.id} className="bg-neutral-900/60 border border-neutral-700/50 p-6 rounded-2xl shadow-lg hover:shadow-xl hover:border-neutral-600 transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-sm font-mono text-neutral-400">ID: {record.id}</span>
                        <span className="text-sm font-mono text-neutral-400">{new Date(record.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center mb-5">
                        <span className="text-lg font-semibold text-white">{record.primary_language}</span>
                        <span className="text-xs font-medium uppercase bg-neutral-800 px-3 py-1 rounded-md text-neutral-200">{record.overall_level}</span>
                        <span className="text-xs font-bold uppercase bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-md text-blue-400">Score: {record.technical_score}/10</span>
                      </div>
                      <pre className="text-xs text-neutral-300 font-mono overflow-x-hidden bg-neutral-950 p-4 rounded-lg border border-neutral-800/80 max-h-32 break-all shadow-inner">{record.raw_snippet}</pre>
                      
                      {record.test_execution_output && (
                        <pre className="mt-5 text-sm text-green-400/90 font-mono bg-neutral-950 p-4 rounded-lg border border-green-500/20 max-h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                          {record.test_execution_output}
                        </pre>
                      )}
                      {record.tester_suggestions && (
                        <div className="mt-5 text-sm leading-relaxed text-neutral-200 bg-neutral-800/60 border border-neutral-700 p-4 rounded-lg">
                          <strong className="text-white block mb-2">QA Suggestions:</strong> 
                          <span className="block text-neutral-300">
                            {(() => {
                              try {
                                return JSON.parse(record.tester_suggestions).join(" • ");
                              } catch {
                                return record.tester_suggestions;
                              }
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Automation History Table */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-6 border-b border-neutral-800 pb-3">AutomationMemory</h3>
                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                  {autoHistory.length === 0 ? <p className="text-base text-neutral-500">No automations logged yet.</p> : null}
                  {autoHistory.map((record) => (
                    <div key={record.id} className="bg-neutral-900/60 border border-neutral-700/50 p-6 rounded-2xl shadow-lg hover:shadow-xl hover:border-neutral-600 transition-all duration-300 relative overflow-hidden">
                      {record.user_edited_script && (
                        <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 text-xs uppercase font-bold px-3 py-1.5 rounded-bl-xl border-l border-b border-green-500/20">
                          RAG Context Trained
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-sm font-mono text-neutral-400">ID: {record.id}</span>
                        <span className="text-sm font-mono text-neutral-400">{new Date(record.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-lg font-medium text-white mb-3 leading-relaxed">"{record.intent}"</p>
                      <div className="flex flex-wrap gap-2 mb-5">
                        <span className="text-xs font-medium uppercase bg-neutral-800 px-3 py-1.5 rounded-md text-neutral-200">{record.target_env}</span>
                        {record.working_directory && (
                          <span className="text-xs font-medium bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-md text-blue-400 font-mono">dir: {record.working_directory}</span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-4">
                        <div>
                           <span className="text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider block">Generated</span>
                           <pre className="text-xs text-green-400/90 font-mono overflow-x-hidden bg-neutral-950 p-4 rounded-lg border border-neutral-800/80 max-h-40 overflow-y-auto shadow-inner">{record.generated_script}</pre>
                        </div>
                        <div>
                           <span className="text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider block">User Edited</span>
                           <pre className="text-xs text-blue-400/90 font-mono overflow-x-hidden bg-neutral-950 p-4 rounded-lg border border-neutral-800/80 max-h-40 overflow-y-auto shadow-inner">{record.user_edited_script || "No manual corrections"}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
