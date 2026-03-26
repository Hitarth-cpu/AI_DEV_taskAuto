"use client";
import { Zap, Code2, History, Terminal, Brain, ShieldCheck, RefreshCcw } from "lucide-react";

type Tab = "overview" | "assessment" | "automation" | "telemetry";

interface OverviewTabProps {
  setActiveTab: (t: Tab) => void;
  agentStatus: "online" | "offline";
}

export default function OverviewTab({ setActiveTab, agentStatus }: OverviewTabProps) {
  const cards = [
    {
      title: "Skill Assessment Engine",
      desc: "Analyse code proficiency, detect anti-patterns, and get AI-powered QA feedback with real execution output.",
      action: () => setActiveTab("assessment"),
      label: "Run Assessment",
      icon: <Code2 size={20} className="text-neutral-400" />,
      style: "bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700",
    },
    {
      title: "Automation Engine",
      desc: "Generate cross-platform Bash / PowerShell scripts from a plain-English description with blast-radius safety reports.",
      action: () => setActiveTab("automation"),
      label: "Build a Script",
      icon: <Zap size={20} className="text-blue-400" />,
      style: "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]",
    },
    {
      title: "Script History & Telemetry",
      desc: "Browse every generated script, assessment record, and team correction stored in the local database.",
      action: () => setActiveTab("telemetry"),
      label: "Open Telemetry",
      icon: <History size={20} className="text-neutral-400" />,
      style: "bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700",
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="mb-10">
        <h2 className="text-3xl font-semibold mb-2 tracking-tight">Agent Overview</h2>
        <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
          A fully agentic DevOps assistant — generate, execute, validate, and self-heal scripts with real-time
          interaction and team-level intelligence.
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              agentStatus === "online"
                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                : "bg-red-500"
            }`}
          />
          <span className={agentStatus === "online" ? "text-green-400" : "text-red-400"}>
            CLI Daemon {agentStatus === "online" ? "connected" : "offline"}
          </span>
          {agentStatus === "offline" && (
            <code className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded ml-2">
              python -m cli.daemon --token default_agent
            </code>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 flex flex-col hover:border-neutral-700 transition"
          >
            <div className="mb-3">{c.icon}</div>
            <h3 className="text-base font-semibold text-white mb-2">{c.title}</h3>
            <p className="text-sm text-neutral-400 flex-1 leading-relaxed">{c.desc}</p>
            <button
              onClick={c.action}
              className={`mt-5 w-full px-4 py-2 rounded-xl text-sm font-medium transition ${c.style}`}
            >
              {c.label}
            </button>
          </div>
        ))}
      </div>

      {/* Feature summary */}
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Zero-Click Execution", icon: <Terminal size={15} className="text-blue-400" />,    desc: "Remote CLI daemon" },
          { label: "RAG Knowledge Base",   icon: <Brain size={15} className="text-purple-400" />,     desc: "Upload docs & configs" },
          { label: "Blast Radius Reports", icon: <ShieldCheck size={15} className="text-green-400" />,desc: "Safety before execution" },
          { label: "Auto Fix-It Loop",     icon: <RefreshCcw size={15} className="text-orange-400" />,desc: "Self-healing scripts" },
        ].map((f) => (
          <div
            key={f.label}
            className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20"
          >
            <div className="mb-2">{f.icon}</div>
            <p className="text-xs font-semibold text-white">{f.label}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
