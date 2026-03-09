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
          <h1 className="text-xl font-bold text-slate-900">Estimate Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Reusable templates for project estimates</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + New Template
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-slate-900">New Template</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Addition, Remodel, New Construction"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {isPending ? "Creating..." : "Create Template"}
            </button>
            <button onClick={() => setShowCreate(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
          No templates yet. Create one above.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
              <a href={`/${companyId}/estimates/${tpl.id}`} className="block">
                <h3 className="font-semibold text-slate-900 hover:text-blue-600">{tpl.name}</h3>
                {tpl.description && (
                  <p className="text-sm text-slate-500 mt-1">{tpl.description}</p>
                )}
                <div className="flex gap-3 mt-3 text-xs text-slate-400">
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
                  className="mt-2 text-xs text-red-400 hover:text-red-600"
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
