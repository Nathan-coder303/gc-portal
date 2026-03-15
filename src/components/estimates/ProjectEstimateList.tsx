"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEstimateFromTemplate, createBlankEstimate, archiveEstimate } from "@/app/[companyId]/[projectId]/estimates/actions";
import { fmt } from "@/lib/estimates/totals";
import { TrashIcon } from "@/components/ui/icons";

type Template = { id: string; name: string };
type Estimate = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total: number;
  createdAt: Date;
  template: { name: string } | null;
};

export default function ProjectEstimateList({
  companyId,
  projectId,
  estimates,
  templates,
  canEdit,
  canArchive,
}: {
  companyId: string;
  projectId: string;
  estimates: Estimate[];
  templates: Template[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState<"template" | "blank">("template");
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    startTransition(async () => {
      try {
        let result;
        if (mode === "template" && selectedTemplate) {
          result = await createEstimateFromTemplate(projectId, selectedTemplate, name);
        } else {
          result = await createBlankEstimate(projectId, name);
        }
        if (result.success) {
          router.push(`/${companyId}/${projectId}/estimates/${result.id}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create estimate");
      }
    });
  }

  async function handleArchive(estimateId: string) {
    if (!confirm("Archive this estimate?")) return;
    startTransition(async () => {
      await archiveEstimate(estimateId, projectId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Project Estimates</h2>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              + New Estimate
            </button>
          )}
          <a
            href={`/${companyId}/estimates`}
            className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Manage Templates
          </a>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <h3 className="font-medium text-sm" style={{ color: "#e6edf3" }}>New Estimate</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setMode("template")}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={mode === "template" ? { background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" } : { border: "1px solid #30373f", color: "#8b949e" }}
            >
              From Template
            </button>
            <button
              onClick={() => setMode("blank")}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={mode === "blank" ? { background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" } : { border: "1px solid #30373f", color: "#8b949e" }}
            >
              Blank
            </button>
          </div>
          {mode === "template" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {templates.length === 0 && <option value="">No templates available</option>}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Estimate Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 123 Main St Addition"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: "#f85149" }}>{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {isPending ? "Creating..." : "Create Estimate"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: "1px solid #30373f", color: "#8b949e" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {estimates.length === 0 ? (
        <div className="rounded-xl p-10 text-center text-sm" style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}>
          No estimates yet. Create one above.
        </div>
      ) : (
        <div className="space-y-2">
          {estimates.map((est) => (
            <div key={est.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={`/${companyId}/${projectId}/estimates/${est.id}`}
                    className="font-medium hover:underline"
                    style={{ color: "#e6edf3" }}
                  >
                    {est.name}
                  </a>
                  <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
                    {est.status}
                  </span>
                </div>
                {est.template && (
                  <p className="text-xs mt-0.5" style={{ color: "#484f58" }}>From template: {est.template.name}</p>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ color: "#C9A84C" }}>${fmt(est.total)}</div>
                <div className="text-xs" style={{ color: "#484f58" }}>
                  {new Date(est.createdAt).toLocaleDateString()}
                </div>
              </div>
              {canArchive && (
                <button
                  onClick={() => handleArchive(est.id)}
                  disabled={isPending}
                  className="w-7 h-7 rounded flex items-center justify-center ml-2 disabled:opacity-50"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Archive"
                >
                  <TrashIcon size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
