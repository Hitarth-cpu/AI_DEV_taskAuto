"use client";
import { Sun, Moon, Terminal } from "lucide-react";
import { Theme } from "@/hooks/useTheme";
import { AgentStatus } from "@/hooks/useWebSocket";

type Tab = "overview" | "assessment" | "automation" | "telemetry" | "graph";

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  agentStatus: AgentStatus;
  theme: Theme;
  toggleTheme: () => void;
}

export default function Header({ activeTab, setActiveTab, agentStatus, theme, toggleTheme }: HeaderProps) {
  const navItem = (id: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`text-sm font-medium transition-colors ${
        activeTab === id ? "text-white" : "text-neutral-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 px-6 py-3 flex items-center justify-between z-20">
      {/* Brand */}
      <button
        onClick={() => setActiveTab("overview")}
        className="flex items-center gap-2 text-lg font-bold tracking-tight hover:text-white transition"
      >
        <Terminal size={18} className="text-blue-400" />
        AI Dev Agent
      </button>

      {/* Nav */}
      <nav className="flex gap-5">
        {navItem("overview", "Dashboard")}
        {navItem("assessment", "Skills")}
        {navItem("automation", "Automation")}
        {navItem("graph", "Graph")}
        {navItem("telemetry", "Telemetry")}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* CLI agent indicator */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span
            className={`w-2 h-2 rounded-full ${
              agentStatus === "online"
                ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]"
                : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            }`}
          />
          CLI {agentStatus === "online" ? "connected" : "offline"}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
