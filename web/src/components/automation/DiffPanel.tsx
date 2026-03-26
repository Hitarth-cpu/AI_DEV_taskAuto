"use client";
import { DiffBlock } from "@/components/CodeBlock";

interface DiffPanelProps {
  original: string;
  fixed: string;
  iteration: number;
  language?: string;
}

export default function DiffPanel({ original, fixed, iteration, language = "shell" }: DiffPanelProps) {
  return (
    <div className="mb-6">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-400 mb-3">
        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
        Fix Applied — Attempt {iteration} diff
      </h4>
      <DiffBlock original={original} modified={fixed} language={language} height="240px" />
    </div>
  );
}
