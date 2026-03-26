"use client";

import { Toaster } from "sonner";
import Header from "@/components/Header";
import OverviewTab from "@/components/tabs/OverviewTab";
import AssessmentTab from "@/components/tabs/AssessmentTab";
import AutomationTab from "@/components/tabs/AutomationTab";
import TelemetryTab from "@/components/tabs/TelemetryTab";
import GraphTab from "@/components/tabs/GraphTab";
import { useAgentWebSocket } from "@/hooks/useWebSocket";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";

type Tab = "overview" | "assessment" | "automation" | "telemetry" | "graph";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [theme, toggleTheme] = useTheme();
  const ws = useAgentWebSocket();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <Toaster theme="dark" position="bottom-right" richColors closeButton />

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agentStatus={ws.agentStatus}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {activeTab === "graph" ? (
        <div className="flex-1 overflow-hidden">
          <GraphTab />
        </div>
      ) : (
        <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10">
          {activeTab === "overview" && (
            <OverviewTab setActiveTab={setActiveTab} agentStatus={ws.agentStatus} />
          )}
          {activeTab === "assessment" && <AssessmentTab />}
          {activeTab === "automation" && (
            <AutomationTab
              agentStatus={ws.agentStatus}
              executionLogs={ws.executionLogs}
              setExecutionLogs={ws.setExecutionLogs}
              sendExecution={ws.sendExecution}
              onExit={ws.onExit}
              activeResultRef={ws.activeResultRef}
            />
          )}
          {activeTab === "telemetry" && <TelemetryTab />}
        </main>
      )}
    </div>
  );
}
