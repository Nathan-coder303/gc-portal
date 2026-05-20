"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, createStandardTemplate, archiveTemplate, renameTemplate, duplicateTemplate, reorderTemplates } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon, CopyIcon } from "@/components/ui/icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  const [hovered, setHovered] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tpl.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function saveName() {
    if (!nameVal.trim() || nameVal.trim() === tpl.name) { setEditingName(false); return; }
    startTransition(async () => {
      await renameTemplate(tpl.id, nameVal.trim());
      setEditingName(false);
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div
        className="rounded-xl cursor-pointer transition-all flex flex-col flex-1"
        style={{
          background: "#1e2736",
          border: `1px solid ${hovered ? "#C9A84C" : "#C9A84C55"}`,
          minHeight: 140,
        }}
        onClick={() => router.push(`/${companyId}/estimates/${tpl.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Drag handle — top strip */}
        <div
          {...attributes}
          {...listeners}
          className="w-full flex justify-center items-center py-1.5 rounded-t-xl"
          style={{ cursor: "grab", background: "transparent", borderBottom: "1px solid #C9A84C22" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ color: "#C9A84C66", fontSize: 12, letterSpacing: 4 }}>⠿⠿⠿</span>
        </div>

        <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col flex-1">
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(tpl.name); } }}
              onBlur={saveName}
              className="rounded-lg px-3 py-2 text-base font-bold w-full mb-2"
              style={{ background: "#0d1117", border: "1px solid #C9A84C", color: "#C9A84C" }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="text-base sm:text-xl font-bold mb-1 leading-snug" style={{ color: "#C9A84C" }}>{tpl.name}</div>
          )}
          <div className="text-sm mb-4" style={{ color: "#8b949e" }}>
            {tpl.divisionCount} divisions · {tpl.itemCount} items
          </div>

          {(canEdit || canArchive) && (
            <div className="flex flex-wrap gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setDuplicating(true);
                    try {
                      const result = await duplicateTemplate(tpl.id);
                      router.push(`/${companyId}/estimates/${result.id}`);
                    } finally {
                      setDuplicating(false);
                    }
                  }}
                  disabled={duplicating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#58a6ff22", color: "#58a6ff", border: "1px solid #58a6ff44" }}
                  title="Duplicate"
                >
                  {duplicating ? <span style={{ fontSize: 11 }}>…</span> : <CopyIcon size={13} />}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingName(true); setNameVal(tpl.name); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                  title="Rename"
                >
                  <PencilIcon size={13} />
                </button>
              )}
              {canArchive && (
                <button
                  onClick={(e) => { e.stopPropagation(); startTransition(async () => { await archiveTemplate(tpl.id); }); }}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Archive"
                >
                  <TrashIcon size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplateList({
  companyId,
  templates: initialTemplates,
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
  const [templates, setTemplates] = useState(initialTemplates);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "standard" | "bathroom" | "kitchen">("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = templates.findIndex(t => t.id === active.id);
    const newIdx = templates.findIndex(t => t.id === over.id);
    const reordered = arrayMove(templates, oldIdx, newIdx);
    setTemplates(reordered);
    startTransition(async () => {
      await reorderTemplates(reordered.map(t => t.id));
    });
  }

  function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    startTransition(async () => {
      try {
        if (createMode === "standard" || createMode === "bathroom" || createMode === "kitchen") {
          const result = await createStandardTemplate(name, description, createMode);
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
        <div className="flex gap-2 items-center">
          <a
            href={`/${companyId}/estimates/terms-library`}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: "1px solid #30373f", color: "#8b949e" }}
          >
            T&C Library
          </a>
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
      </div>

      {showCreate && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <h3 className="font-medium" style={{ color: "#e6edf3" }}>New Template</h3>
          <div className="flex gap-2">
            <button onClick={() => setCreateMode("blank")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "blank" ? "#C9A84C" : "transparent", color: createMode === "blank" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Blank</button>
            <button onClick={() => setCreateMode("standard")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "standard" ? "#C9A84C" : "transparent", color: createMode === "standard" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Standard (CSI Addition)</button>
            <button onClick={() => setCreateMode("bathroom")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "bathroom" ? "#C9A84C" : "transparent", color: createMode === "bathroom" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Bathroom Remodel</button>
            <button onClick={() => setCreateMode("kitchen")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: createMode === "kitchen" ? "#C9A84C" : "transparent", color: createMode === "kitchen" ? "#0d1117" : "#8b949e", border: "1px solid #30373f" }}>Kitchen Remodel</button>
          </div>
          {createMode === "standard" && <p className="text-xs" style={{ color: "#8b949e" }}>Pre-populates 16 CSI divisions with 83 standard line items — delete what you don&apos;t need.</p>}
          {createMode === "bathroom" && <p className="text-xs" style={{ color: "#8b949e" }}>Pre-populates 11 CSI divisions with 40 bathroom remodeling line items — delete what you don&apos;t need.</p>}
          {createMode === "kitchen" && <p className="text-xs" style={{ color: "#8b949e" }}>Pre-populates 10 CSI divisions with 44 kitchen remodeling line items — delete what you don&apos;t need.</p>}
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
              {isPending ? "Creating..." : createMode === "standard" ? "Create Standard Template" : createMode === "bathroom" ? "Create Bathroom Template" : createMode === "kitchen" ? "Create Kitchen Template" : "Create Template"}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={templates.map(t => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} companyId={companyId} canEdit={canEdit} canArchive={canArchive} isPending={isPending} startTransition={startTransition} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
