"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type AgentStatus = "online" | "offline";

export interface WsHook {
  agentStatus: AgentStatus;
  executionLogs: string[];
  setExecutionLogs: React.Dispatch<React.SetStateAction<string[]>>;
  sendExecution: (script: string, isValidation: boolean, workingDir: string, token?: string) => void;
  onExit: (cb: (code: number, isValidation: boolean) => void) => void;
  activeResultRef: React.MutableRefObject<any>;
}

export function useAgentWebSocket(): WsHook {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("offline");
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const activeResultRef = useRef<any>(null);
  const exitCbRef = useRef<((code: number, isValidation: boolean) => void) | null>(null);
  const autoValidateRef = useRef(true);

  // Expose setter so parent can keep ref in sync
  const onExit = useCallback((cb: (code: number, isValidation: boolean) => void) => {
    exitCbRef.current = cb;
  }, []);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(7);
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";
    const ws = new WebSocket(`${wsBase}/ws/ui/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "agent_status") {
        setAgentStatus(data.status);
      } else if (data.type === "log") {
        setExecutionLogs((prev) => [...prev, data.data]);
      } else if (data.type === "exit") {
        setExecutionLogs((prev) => [
          ...prev,
          `\n[Process exited with code ${data.code}]`,
        ]);
        exitCbRef.current?.(data.code, data.is_validation === true);
      } else if (data.type === "error") {
        setExecutionLogs((prev) => [...prev, `\n[ERROR] ${data.message}`]);
      }
    };

    return () => ws.close();
  }, []);

  const sendExecution = useCallback(
    (script: string, isValidation: boolean, workingDir: string, token = "default_agent") => {
      wsRef.current?.send(
        JSON.stringify({
          action: "execute_remote",
          token,
          script,
          is_validation: isValidation,
          working_directory: workingDir,
        })
      );
    },
    []
  );

  return { agentStatus, executionLogs, setExecutionLogs, sendExecution, onExit, activeResultRef };
}
