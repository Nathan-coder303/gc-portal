"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, createStandardTemplate, archiveTemplate, renameTemplate, duplicateTemplate } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";

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

  return (
    <div className="relative group">
      <a
        href={`/${companyId}/estimates/${tpl.id}`}
        className="flex flex-col items-center justify-center rounded-2xl py-10 px-10 text-center transition-all hover:border-[#C9A84C88]"
        style={{ background: "#0d1117", border: "1px solid #C9A84C44", minHeight: "220px" }}
      >
        {editingName ? (
          <div className="w-full" onClick={(e) => e.preventDefault()}>
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(tpl.name); } }}
              onBlur={saveName}
              className="rounded-lg px-3 py-2 text-xl font-bold text-center w-full"
              style={{ background: "#1e2736", border: "1px solid #C9A84C", color: "#C9A84C" }}
            />
          </div>
        ) : (
          <div className="font-bold text-5xl mb-4 leading-tight" style={{ color: "#C9A84C" }}>
            {tpl.name}
          </div>
        )}
        <div className="flex gap-3 text-sm" style={{ color: "#8b949e" }}>
          <span>{tpl.divisionCount} divisions</span>
          <span>·</span>
          <span>{tpl.itemCount} items</span>
        </div>
      </a>
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {canEdit && (
          <button
            onClick={async (e) => {
              e.preventDefault();
              setDuplicating(true);
              try {
                const result = await duplicateTemplate(tpl.id);
                router.push(`/${companyId}/estimates/${result.id}`);
              } finally {
                setDuplicating(false);
              }
            }}
            disabled={duplicating}
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: "#1e273688", color: "#8b949e", border: "1px solid #30373f" }}
            title="Duplicate"
          >
            {duplicating ? "…" : "⧉"}
          </button>
        )}
        {canEdit && (
          <button
            onClick={(e) => { e.preventDefault(); setEditingName(true); setNameVal(tpl.name); }}
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            title="Rename"
          >
            <PencilIcon size={13} />
          </button>
        )}
        {canArchive && (
          <button
            onClick={(e) => { e.preventDefault(); if (!confirm("Archive this template?")) return; startTransition(async () => { await archiveTemplate(tpl.id); }); }}
            disabled={isPending}
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
            title="Archive"
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
    </div>
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

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setCreateMode("blank")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: createMode === "blank" ? "#C9A84C" : "transparent", color: createMode === "blank" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}
            >
              Blank
            </button>
            <button
              onClick={() => setCreateMode("standard")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: createMode === "standard" ? "#C9A84C" : "transparent", color: createMode === "standard" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}
            >
              Standard (CSI Addition)
            </button>
          </div>
          {createMode === "standard" && (
            <p className="text-xs" style={{ color: "#8b949e" }}>Pre-populates 16 CSI divisions with 83 standard line items — delete what you don&apos;t need.</p>
          )}

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
              {isPending ? "Creating..." : createMode === "standard" ? "Create Standard Template" : "Create Template"}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {templates.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} companyId={companyId} canEdit={canEdit} canArchive={canArchive} isPending={isPending} startTransition={startTransition} />
          ))}
        </div>
      )}
    </div>
  );
}
