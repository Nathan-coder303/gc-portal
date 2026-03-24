"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, createStandardTemplate, archiveTemplate, renameTemplate, duplicateTemplate } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import CollapsibleCard from "@/components/ui/CollapsibleCard";

type Template = {
  id: string;
  name: string;
  description: string | null;
  divisionCount: number;
  itemCount: number;
  createdAt: Date;
};

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

function TemplateCard({
  tpl, companyId, canEdit, canArchive, isPending, startTransition,
}: {
  tpl: Template; companyId: string; canEdit: boolean; canArchive: boolean;
  isPending: boolean; startTransition: (fn: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(tpl.name);
  const [duplicating, setDuplicating] = useState(false);

  function saveName() {
    if (!nameVal.trim() || nameVal.trim() === tpl.name) { setEditingName(false); return; }
    startTransition(async () => {
      await renameTemplate(tpl.id, nameVal.trim());
      setEditingName(false);
    });
  }

  const summary = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base" style={{ color: "#C9A84C" }}>{tpl.name}</div>
        <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
          {tpl.divisionCount} divisions · {tpl.itemCount} items
        </div>
      </div>
    </div>
  );

  return (
    <CollapsibleCard summary={summary} accent>
      <div className="pt-3 space-y-3">
        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(tpl.name); } }}
            onBlur={saveName}
            className="rounded-lg px-3 py-2 text-sm font-bold w-full"
            style={{ background: "#0d1117", border: "1px solid #C9A84C", color: "#C9A84C" }}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push(`/${companyId}/estimates/${tpl.id}`)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-center"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            Open →
          </button>
          {canEdit && (
            <button
              onClick={async () => {
                setDuplicating(true);
                try {
                  const result = await duplicateTemplate(tpl.id);
                  router.push(`/${companyId}/estimates/${result.id}`);
                } finally {
                  setDuplicating(false);
                }
              }}
              disabled={duplicating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
            >
              {duplicating ? "…" : "⧉ Duplicate"}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => { setEditingName(true); setNameVal(tpl.name); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
              title="Rename"
            >
              <PencilIcon size={13} />
            </button>
          )}
          {canArchive && (
            <button
              onClick={() => { if (!confirm("Archive this template?")) return; startTransition(async () => { await archiveTemplate(tpl.id); }); }}
              disabled={isPending}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
              title="Archive"
            >
              <TrashIcon size={13} />
            </button>
          )}
        </div>
      </div>
    </CollapsibleCard>
  );
}

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "standard">("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    startTransition(async () => {
      try {
        if (createMode === "standard") {
          const result = await createStandardTemplate(name, description);
          router.push(`/${companyId}/estimates/${result.id}`);
        } else {
          const fd = new FormData();
          fd.set("name", name);
          fd.set("description", description);
          await createTemplate(fd);
          setName("");
          setDescription("");
          setShowCreate(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create template");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Create Estimate</h1>
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
          <div className="flex gap-2">
            <button onClick={() => setCreateMode("blank")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "blank" ? "#C9A84C" : "transparent", color: createMode === "blank" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Blank</button>
            <button onClick={() => setCreateMode("standard")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "standard" ? "#C9A84C" : "transparent", color: createMode === "standard" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Standard (CSI Addition)</button>
          </div>
          {createMode === "standard" && <p className="text-xs" style={{ color: "#8b949e" }}>Pre-populates 16 CSI divisions with 83 standard line items — delete what you don&apos;t need.</p>}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#8b949e" }}>Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Addition, Remodel, New Construction" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#8b949e" }}>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#C9A84C", color: "#0d1117", opacity: isPending ? 0.5 : 1 }}>
              {isPending ? "Creating..." : createMode === "standard" ? "Create Standard Template" : "Create Template"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#8b949e" }}>No templates yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} companyId={companyId} canEdit={canEdit} canArchive={canArchive} isPending={isPending} startTransition={startTransition} />
          ))}
        </div>
      )}
    </div>
  );
}
