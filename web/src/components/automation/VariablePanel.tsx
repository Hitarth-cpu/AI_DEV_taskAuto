"use client";
import { useEffect, useState } from "react";
import { Variable } from "lucide-react";

interface VariablePanelProps {
  script: string;
  onApply: (substituted: string) => void;
}

function detectVars(script: string): string[] {
  const seen = new Set<string>();
  // Match $MY_VAR, ${MY_VAR}, {{myVar}}, <MY_VAR>
  const patterns = [
    /\$\{([A-Z][A-Z0-9_]+)\}/g,
    /\$([A-Z][A-Z0-9_]{2,})/g,
    /\{\{([a-zA-Z][a-zA-Z0-9_]+)\}\}/g,
    /<([A-Z][A-Z0-9_]+)>/g,
  ];
  patterns.forEach((re) => {
    let m;
    while ((m = re.exec(script)) !== null) seen.add(m[1]);
  });
  return Array.from(seen);
}

export default function VariablePanel({ script, onApply }: VariablePanelProps) {
  const [vars, setVars] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const detected = detectVars(script);
    setVars(detected);
    setValues((prev) => {
      const next: Record<string, string> = {};
      detected.forEach((v) => { next[v] = prev[v] ?? ""; });
      return next;
    });
  }, [script]);

  if (vars.length === 0) return null;

  const handleApply = () => {
    let out = script;
    vars.forEach((v) => {
      const val = values[v] || `$${v}`;
      out = out
        .replace(new RegExp(`\\$\\{${v}\\}`, "g"), val)
        .replace(new RegExp(`\\$${v}\\b`, "g"), val)
        .replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), val)
        .replace(new RegExp(`<${v}>`, "g"), val);
    });
    onApply(out);
  };

  return (
    <div className="mb-4 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-yellow-400 mb-3">
        <Variable size={14} />
        Variable Substitution
        <span className="text-xs font-normal text-neutral-400">— fill in detected placeholders before running</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {vars.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <span className="text-xs font-mono text-yellow-400 w-36 flex-shrink-0 truncate">${v}</span>
            <input
              type="text"
              placeholder={`value for $${v}`}
              value={values[v]}
              onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-yellow-500/50"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleApply}
        className="text-xs bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-600/30 transition font-medium"
      >
        Apply Variables to Script
      </button>
    </div>
  );
}
