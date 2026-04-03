/**
 * Centralized API client.
 * All fetch calls go through here so base URL and error handling are consistent.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Automation ───────────────────────────────────────────────────────────────

export const api = {
  automate: (payload: { task_description: string; target_env: string; working_directory?: string }) =>
    request("/api/v1/automate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  automateEdit: (payload: { id: number; task_description: string; target_env: string; user_edited_script: string }) =>
    request("/api/v1/automate/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  automateFix: (payload: {
    original_intent: string;
    failed_script: string;
    error_output: string;
    target_env: string;
    iteration: number;
    record_id?: number | null;
    working_directory?: string;
  }) =>
    request("/api/v1/automate/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  automateHistory: () => request<any[]>("/api/v1/automate/history"),

  // ── Assessment ──────────────────────────────────────────────────────────────

  assess: (payload: { code_snippet: string; language: string; working_directory?: string }) =>
    request("/api/v1/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  assessHistory: () => request<any[]>("/api/v1/assess/history"),

  // ── Knowledge Base ──────────────────────────────────────────────────────────

  knowledgeList: () => request<any[]>("/api/v1/knowledge/documents"),

  knowledgeUpload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request("/api/v1/knowledge/upload", { method: "POST", body: form });
  },

  knowledgeDelete: (docId: string) =>
    request(`/api/v1/knowledge/documents/${docId}`, { method: "DELETE" }),

  // ── Templates ───────────────────────────────────────────────────────────────

  templatesList: () => request<any[]>("/api/v1/templates"),

  templatesCreate: (payload: {
    name: string;
    description?: string;
    script: string;
    validation_script?: string;
    target_env: string;
    tags?: string;
  }) =>
    request("/api/v1/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  templatesDelete: (id: number) =>
    request(`/api/v1/templates/${id}`, { method: "DELETE" }),

  // ── Health ───────────────────────────────────────────────────────────────────

  health: () => request<{ status: string; agents_online: string[] }>("/health"),
};
