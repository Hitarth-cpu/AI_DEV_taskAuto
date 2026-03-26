"use client";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AutomationNode from "./AutomationNode";
import IterationNode from "./IterationNode";
import AssessmentNode from "./AssessmentNode";
import DetailPanel from "./DetailPanel";

const nodeTypes = {
  automationNode: AutomationNode,
  iterationNode:  IterationNode,
  assessmentNode: AssessmentNode,
};

const ASSESS_X    = -60;
const AUTO_X      = 340;
const ITER_X_0    = 760;
const ITER_X_STEP = 300;
const V_GAP       = 220;

function buildGraph(automations: any[], assessments: any[]) {
  const sortedAuto   = [...automations].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const sortedAssess = [...assessments].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ── Automation nodes ──────────────────────────────────────────────────────
  sortedAuto.forEach((record, index) => {
    const y     = index * V_GAP;
    const mainId = `auto-${record.id}`;

    nodes.push({
      id:   mainId,
      type: "automationNode",
      position: { x: AUTO_X, y },
      data: { record, index, dimmed: false },
    });

    if (index > 0) {
      edges.push({
        id:     `e-auto-${index}`,
        source: `auto-${sortedAuto[index - 1].id}`,
        target: mainId,
        type:   "smoothstep",
        style:  { stroke: "rgba(255,255,255,0.11)", strokeWidth: 1.5 },
      });
    }

    // Fix iteration branches (right side)
    let iters: any[] = [];
    try { iters = JSON.parse(record.iteration_history || "[]"); } catch {}
    iters.forEach((iter: any, ii: number) => {
      const iterNodeId = `iter-${record.id}-${ii}`;
      nodes.push({
        id:   iterNodeId,
        type: "iterationNode",
        position: { x: ITER_X_0 + ii * ITER_X_STEP, y },
        data: { iter, iterIdx: ii, dimmed: false },
      });
      const src = ii === 0 ? mainId : `iter-${record.id}-${ii - 1}`;
      edges.push({
        id:     `ie-${record.id}-${ii}`,
        source: src,
        target: iterNodeId,
        type:   "smoothstep",
        style:  { stroke: "rgba(245,158,11,0.35)", strokeWidth: 1.2, strokeDasharray: "5 4" },
      });
    });
  });

  // ── Assessment nodes ──────────────────────────────────────────────────────
  sortedAssess.forEach((record, index) => {
    const y        = index * V_GAP;
    const assessId = `assess-${record.id}`;

    nodes.push({
      id:   assessId,
      type: "assessmentNode",
      position: { x: ASSESS_X, y },
      data: { record, dimmed: false },
    });

    if (index > 0) {
      edges.push({
        id:     `e-assess-${index}`,
        source: `assess-${sortedAssess[index - 1].id}`,
        target: assessId,
        type:   "smoothstep",
        style:  { stroke: "rgba(16,185,129,0.15)", strokeWidth: 1.2 },
      });
    }

    // Cross-links: assessment → automation nodes with matching working_directory
    if (record.working_directory) {
      sortedAuto.forEach((auto: any) => {
        if (auto.working_directory === record.working_directory) {
          edges.push({
            id:           `link-${record.id}-${auto.id}`,
            source:       assessId,
            sourceHandle: "right",
            target:       `auto-${auto.id}`,
            type:         "smoothstep",
            style:        { stroke: "rgba(16,185,129,0.28)", strokeWidth: 1, strokeDasharray: "4 4" },
          });
        }
      });
    }
  });

  return { nodes, edges, sortedAuto };
}

interface FlowGraphProps {
  automations: any[];
  assessments: any[];
}

export default function FlowGraph({ automations, assessments }: FlowGraphProps) {
  const { nodes: initNodes, edges: initEdges, sortedAuto } = useMemo(
    () => buildGraph(automations, assessments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useMemo(() => {
    const { nodes: n, edges: e } = buildGraph(automations, assessments);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automations, assessments]);

  const autoIds = useMemo(() => sortedAuto.map((r: any) => `auto-${r.id}`), [sortedAuto]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    const selIdx = autoIds.indexOf(node.id.startsWith("auto-") ? node.id : "");

    setNodes((prev) =>
      prev.map((n) => {
        const nIdx = autoIds.indexOf(n.id.startsWith("auto-") ? n.id : "");
        return { ...n, data: { ...n.data, dimmed: selIdx >= 0 && nIdx > selIdx } };
      })
    );
    setEdges((prev) =>
      prev.map((e) => {
        const srcIdx = autoIds.indexOf(e.source);
        return { ...e, style: { ...e.style, opacity: selIdx >= 0 && srcIdx > selIdx ? 0.1 : 1 } };
      })
    );
  }, [autoIds, setNodes, setEdges]);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, dimmed: false } })));
    setEdges((prev) => prev.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })));
  }, [setNodes, setEdges]);

  const isEmpty = automations.length === 0 && assessments.length === 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={clearSelection}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.05)" />
        <Controls style={{
          background: "rgba(12,12,20,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
        }} />
        <MiniMap
          style={{
            background: "rgba(8,8,16,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
          }}
          nodeColor={(n) => {
            if (n.type === "iterationNode")  return "rgba(245,158,11,0.6)";
            if (n.type === "assessmentNode") return "rgba(16,185,129,0.6)";
            const rec = (n.data?.record) as any;
            if (rec?.user_edited_script) return "rgba(168,85,247,0.6)";
            return "rgba(59,130,246,0.5)";
          }}
          maskColor="rgba(0,0,0,0.5)"
        />
        {isEmpty && (
          <Panel position="top-center">
            <div style={{ marginTop: 80, textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 13 }}>
              No records for this project yet.
            </div>
          </Panel>
        )}
      </ReactFlow>

      <DetailPanel node={selectedNode} onClose={clearSelection} />
    </div>
  );
}
