"use client";

import { useState, useTransition } from "react";
import { createTemplate, archiveTemplate } from "@/app/[companyId]/estimates/actions";

type Template = {
  id: string;
  name: string;
  description: string | null;
  divisionCount: number;
  itemCount: number;
  createdAt: Date;
};

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

export default function TemplateList({
  companyId,
  templates,
  canEdit,
  canArchive,
}: {
  companyId: string;
  templates: Template[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    startTransition(async () => {
      try {
        await createTemplate(fd);
        setName("");
        setDescription("");
        setShowCreate(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create template");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Estimate Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Reusable templates for project estimates</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            + New Template
          </button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <h3 className="font-medium" style={{ color: "#e6edf3" }}>New Template</h3>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#8b949e" }}>Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Addition, Remodel, New Construction"
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#8b949e" }}>Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
          {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#C9A84C", color: "#0d1117", opacity: isPending ? 0.5 : 1 }}>
              {isPending ? "Creating..." : "Create Template"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#8b949e" }}>No templates yet. Create one above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-xl p-4 transition-colors" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
              <a href={`/${companyId}/estimates/${tpl.id}`} className="block">
                <h3 className="font-semibold" style={{ color: "#e6edf3" }}>{tpl.name}</h3>
                {tpl.description && (
                  <p className="text-sm mt-1" style={{ color: "#8b949e" }}>{tpl.description}</p>
                )}
                <div className="flex gap-3 mt-3 text-xs" style={{ color: "#8b949e" }}>
                  <span>{tpl.divisionCount} divisions</span>
                  <span>{tpl.itemCount} items</span>
                </div>
              </a>
              {canArchive && (
                <button
                  onClick={() => {
                    if (!confirm("Archive this template?")) return;
                    startTransition(async () => { await archiveTemplate(tpl.id); });
                  }}
                  disabled={isPending}
                  className="mt-2 text-xs"
                  style={{ color: "#ef4444" }}
                >
                  Archive
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
