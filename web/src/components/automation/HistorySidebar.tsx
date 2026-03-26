"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { History, X, RotateCcw } from "lucide-react";
import { HistorySkeleton } from "@/components/Skeleton";

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onRerun: (record: any) => void;
}

export default function HistorySidebar({ open, onClose, onRerun }: HistorySidebarProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.automateHistory()
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 bg-neutral-950 border-l border-neutral-800 z-40 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <History size={14} className="text-blue-400" />
            Script History
          </span>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <HistorySkeleton />
          ) : records.length === 0 ? (
            <p className="text-xs text-neutral-600 italic p-2">No scripts generated yet.</p>
          ) : (
            records.map((rec) => (
              <div
                key={rec.id}
                className="group p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition"
              >
                <p className="text-xs text-neutral-200 leading-snug line-clamp-2 mb-1.5">
                  {rec.intent}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                      {rec.target_env}
                    </span>
                    {rec.user_edited_script && (
                      <span className="text-[10px] uppercase bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                        RAG
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { onRerun(rec); onClose(); }}
                    className="flex items-center gap-1 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition hover:text-blue-300"
                  >
                    <RotateCcw size={11} /> Re-run
                  </button>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1">
                  {new Date(rec.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
