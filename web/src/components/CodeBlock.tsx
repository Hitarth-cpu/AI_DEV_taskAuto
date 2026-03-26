"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

// Monaco is loaded client-side only (avoids SSR issues)
const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950 animate-pulse rounded" />,
});

const MonacoDiff = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-neutral-950 animate-pulse rounded" />,
});

const LANG_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  bash: "shell",
  powershell: "powershell",
  go: "go",
  rust: "rust",
  java: "java",
  linux: "shell",
  windows: "powershell",
};

interface CodeBlockProps {
  code: string;
  language?: string;
  height?: string;
  label?: string;
  showCopy?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function CodeBlock({
  code,
  language = "shell",
  height = "220px",
  label,
  showCopy = true,
  readOnly = true,
  onChange,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const monacoLang = LANG_MAP[language] ?? language;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      {(label || showCopy) && (
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
          <span className="text-xs font-mono text-neutral-400">{label ?? monacoLang}</span>
          {showCopy && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      <MonacoEditor
        height={height}
        language={monacoLang}
        value={code}
        theme="vs-dark"
        onChange={readOnly ? undefined : (v) => onChange?.(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          folding: true,
          wordWrap: "on",
          renderLineHighlight: readOnly ? "none" : "line",
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}

interface DiffBlockProps {
  original: string;
  modified: string;
  language?: string;
  height?: string;
}

export function DiffBlock({ original, modified, language = "shell", height = "260px" }: DiffBlockProps) {
  const monacoLang = LANG_MAP[language] ?? language;
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-xs font-mono">
        <span className="text-red-400">— Failed script</span>
        <span className="text-neutral-600">vs</span>
        <span className="text-green-400">+ Fixed script</span>
      </div>
      <MonacoDiff
        height={height}
        language={monacoLang}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          renderSideBySide: true,
        }}
      />
    </div>
  );
}
