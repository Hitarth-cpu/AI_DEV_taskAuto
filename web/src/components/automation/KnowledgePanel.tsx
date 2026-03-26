"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Trash2, Upload, BookOpen } from "lucide-react";

interface KnowledgePanelProps {
  docs: any[];
  onRefresh: () => void;
}

export default function KnowledgePanel({ docs, onRefresh }: KnowledgePanelProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.knowledgeUpload(file);
      toast.success(`"${file.name}" added to knowledge base`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    try {
      await api.knowledgeDelete(docId);
      toast.success(`"${filename}" removed`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="mb-5 border border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <BookOpen size={14} className="text-purple-400" />
          Team Knowledge Base
          {docs.length > 0 && (
            <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {docs.length} doc{docs.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="text-neutral-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 mb-3">
            Upload READMEs, configs, or scripts. The AI retrieves relevant chunks when generating your automation.
          </p>

          <label className="inline-flex items-center gap-2 cursor-pointer mb-3">
            <span
              className={`flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <Upload size={12} />
              {uploading ? "Uploading…" : "Upload Document"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.sh,.ps1,.py,.json,.yaml,.yml,.env,.cfg,.conf,.toml,.ini"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>

          {docs.length > 0 ? (
            <div className="space-y-1.5">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-purple-400 text-xs">📄</span>
                    <span className="text-xs font-mono text-neutral-300 truncate">{doc.filename}</span>
                    {doc.added_at && (
                      <span className="text-xs text-neutral-600 flex-shrink-0">
                        {new Date(doc.added_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    className="text-neutral-600 hover:text-red-400 transition ml-2 flex-shrink-0 p-1 rounded hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-600 italic">
              No documents yet. Upload some to improve generation quality.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
