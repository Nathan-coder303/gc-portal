"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { upsertTermsTemplate, deleteTermsTemplate } from "@/app/[companyId]/estimates/actions";

const GOLD = "#C9A84C";

type TermsTemplate = { id: string; name: string; content: string };

export default function TermsLibraryManager({
  companyId,
  initialTemplates,
  canEdit,
}: {
  companyId: string;
  initialTemplates: TermsTemplate[];
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState<TermsTemplate[]>(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = templates.find(t => t.id === selectedId) ?? null;

  const saveNow = useCallback(async (id: string, name: string, content: string) => {
    setSaveState("saving");
    try {
      await upsertTermsTemplate({ id, name, content });
      setSaveState("saved");
    } catch {
      setSaveState("unsaved");
    }
  }, []);

  function handleContentChange(content: string) {
    if (!selected) return;
    setTemplates(prev => prev.map(t => t.id === selected.id ? { ...t, content } : t));
    setSaveState("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNow(selected.id, selected.name, content), 1200);
  }

  function handleNameChange(name: string) {
    if (!selected) return;
    setTemplates(prev => prev.map(t => t.id === selected.id ? { ...t, name } : t));
    setSaveState("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNow(selected.id, name, selected.content), 1200);
  }

  function handleCreateNew() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await upsertTermsTemplate({ name: newName.trim(), content: "" });
      const created: TermsTemplate = { id: result.id, name: newName.trim(), content: "" };
      setTemplates(prev => [...prev, created]);
      setSelectedId(created.id);
      setAddingNew(false);
      setNewName("");
      setSaveState("saved");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTermsTemplate(id);
      const remaining = templates.filter(t => t.id !== id);
      setTemplates(remaining);
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>T&C Library</h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>Manage your Terms & Conditions templates. Changes auto-save.</p>
        </div>
        <a href={`/${companyId}/estimates`} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
          ← Back to Estimates
        </a>
      </div>

      <div className="flex gap-4" style={{ minHeight: 520 }}>
        {/* Left panel — template list */}
        <div className="w-56 shrink-0 flex flex-col gap-1">
          {templates.map(t => (
            <div key={t.id} className="group relative">
              <button
                onClick={() => { setSelectedId(t.id); setSaveState("saved"); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm truncate"
                style={{
                  background: selectedId === t.id ? "#1e2736" : "transparent",
                  border: `1px solid ${selectedId === t.id ? GOLD + "55" : "#30373f"}`,
                  color: selectedId === t.id ? "#e6edf3" : "#8b949e",
                }}
              >
                {t.name}
              </button>
              {canEdit && confirmDeleteId === t.id ? (
                <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1 pr-1 z-10" style={{ background: "#161b22" }}>
                  <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                  <button onClick={() => handleDelete(t.id)} disabled={isPending} className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
                </div>
              ) : canEdit ? (
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-xs px-1 rounded"
                  style={{ color: "#f85149" }}
                  title="Delete"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}

          {canEdit && (
            addingNew ? (
              <div className="mt-1 space-y-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateNew(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
                  placeholder="Template name"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                />
                <div className="flex gap-1">
                  <button onClick={handleCreateNew} disabled={!newName.trim() || isPending} className="flex-1 py-1 rounded text-xs font-semibold disabled:opacity-40" style={{ background: GOLD, color: "#0d1117" }}>
                    Create
                  </button>
                  <button onClick={() => { setAddingNew(false); setNewName(""); }} className="px-2 py-1 rounded text-xs" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-sm text-left"
                style={{ border: `1px dashed #30373f`, color: "#8b949e" }}
              >
                + New T&C
              </button>
            )
          )}
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 flex flex-col gap-3 rounded-xl p-5" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3">
                {canEdit ? (
                  <input
                    value={selected.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className="text-base font-bold rounded-lg px-3 py-1.5 flex-1"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="Template name"
                  />
                ) : (
                  <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>{selected.name}</h2>
                )}
                <span className="text-xs shrink-0" style={{ color: saveState === "saving" ? GOLD : saveState === "saved" ? "#3fb950" : "#8b949e" }}>
                  {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Unsaved"}
                </span>
              </div>

              {canEdit ? (
                <textarea
                  value={selected.content}
                  onChange={e => handleContentChange(e.target.value)}
                  className="flex-1 rounded-lg px-4 py-3 text-sm resize-none leading-relaxed"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", minHeight: 400 }}
                  placeholder="Enter your Terms & Conditions text here…"
                  spellCheck={false}
                />
              ) : (
                <div className="flex-1 rounded-lg px-4 py-3 text-sm overflow-y-auto whitespace-pre-wrap leading-relaxed"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e", minHeight: 400 }}>
                  {selected.content || <span style={{ color: "#484f58" }}>No content.</span>}
                </div>
              )}

              <p className="text-xs" style={{ color: "#484f58" }}>
                Changes auto-save after 1.2 seconds. This template will appear in the T&C dropdown on all estimates.
              </p>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: "#484f58" }}>
                {templates.length === 0 ? "No templates yet — create one to get started." : "Select a template to edit."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
