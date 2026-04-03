"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type AgentStatus = "online" | "offline";

export interface WsHook {
  agentStatus: AgentStatus;
  onlineAgents: string[];
  executionLogs: string[];
  setExecutionLogs: React.Dispatch<React.SetStateAction<string[]>>;
  sendExecution: (script: string, isValidation: boolean, workingDir: string, token?: string) => void;
  onExit: (cb: (code: number, isValidation: boolean) => void) => void;
  activeResultRef: React.MutableRefObject<any>;
}

export function useAgentWebSocket(): WsHook {
  const [onlineAgents, setOnlineAgents] = useState<string[]>([]);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const activeResultRef = useRef<any>(null);
  const exitCbRef = useRef<((code: number, isValidation: boolean) => void) | null>(null);
  // Keep a ref in sync so sendExecution always reads the latest token list
  const onlineAgentsRef = useRef<string[]>([]);

  const onExit = useCallback((cb: (code: number, isValidation: boolean) => void) => {
    exitCbRef.current = cb;
  }, []);

  useEffect(() => {
    onlineAgentsRef.current = onlineAgents;
  }, [onlineAgents]);

  useEffect(() => {
    const sessionId = Math.random().toString(36).substring(7);
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";
    const ws = new WebSocket(`${wsBase}/ws/ui/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "agent_status") {
        const { token, status } = data;
        setOnlineAgents((prev) => {
          if (status === "online") {
            return prev.includes(token) ? prev : [...prev, token];
          } else {
            return prev.filter((t) => t !== token);
          }
        });
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

  // Auto-pick the first connected agent; fall back to "default_agent" only
  // if nothing is connected (so the error message is still meaningful).
  const sendExecution = useCallback(
    (script: string, isValidation: boolean, workingDir: string, token?: string) => {
      const target = token ?? onlineAgentsRef.current[0] ?? "default_agent";
      wsRef.current?.send(
        JSON.stringify({
          action: "execute_remote",
          token: target,
          script,
          is_validation: isValidation,
          working_directory: workingDir,
        })
      );
    },
    []
  );

  const agentStatus: AgentStatus = onlineAgents.length > 0 ? "online" : "offline";

  return { agentStatus, onlineAgents, executionLogs, setExecutionLogs, sendExecution, onExit, activeResultRef };
}
