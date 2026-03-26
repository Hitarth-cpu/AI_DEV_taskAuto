"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { LibraryBig, Trash2, Play } from "lucide-react";

interface TemplatesPanelProps {
  onLoad: (rec: any) => void;
}

export default function TemplatesPanel({ onLoad }: TemplatesPanelProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.templatesList()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (open) refresh(); }, [open]);

  const handleDelete = async (id: number, name: string) => {
    try {
      await api.templatesDelete(id);
      toast.success(`Template "${name}" deleted`);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mb-5 border border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <LibraryBig size={14} className="text-blue-400" />
          Script Templates Library
          {templates.length > 0 && open && (
            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              {templates.length}
            </span>
          )}
        </span>
        <span className="text-neutral-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800">
          {loading ? (
            <p className="text-xs text-neutral-600">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-neutral-600 italic">
              No templates saved yet. Generate a script and click "Save as Template".
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group flex items-start justify-between gap-3 p-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tpl.name}</p>
                    {tpl.description && (
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">{tpl.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] uppercase bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                        {tpl.target_env}
                      </span>
                      {tpl.tags?.split(",").filter(Boolean).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => onLoad(tpl)}
                      className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded hover:bg-blue-500/20 transition"
                    >
                      <Play size={10} /> Load
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="p-1 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
