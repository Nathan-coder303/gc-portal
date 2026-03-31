"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { type PipelineStage, loadProjectStages, saveProjectStages, STAGE_COLORS } from "@/lib/pipelineStages";
import NotesPanel from "@/components/notes/NotesPanel";

type ProjectCard = {
  id: string;
  displayName: string;
  stage: string;
  source: string | null;
  estimateValue: number | null;
  notes: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  sortOrder: number;
  createdAt: string;
};

type ActiveClient = { id: string; name: string; email: string | null };

type Props = {
  companyId: string;
  initialCards: ProjectCard[];
  activeClients?: ActiveClient[];
};


const AVATAR_COLORS = [
  "#3b82f6", "#a855f7", "#C9A84C", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#ef4444", "#8b5cf6", "#f59e0b",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

// ─── Add Stage Form ────────────────────────────────────────────────────────────

function AddStageForm({ stageName, setNewStageName, stageColor, setNewStageColor, onAdd, onCancel }: {
  stageName: string; setNewStageName: (v: string) => void;
  stageColor: string; setNewStageColor: (v: string) => void;
  onAdd: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 12, padding: 14, minWidth: 180 }}>
      <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 12, marginBottom: 8, marginTop: 0 }}>New Stage</p>
      <input
        autoFocus type="text" placeholder="Stage name..." value={stageName}
        onChange={(e) => setNewStageName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onAdd(); if (e.key === "Escape") onCancel(); }}
        style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #484f58", borderRadius: 6, padding: "6px 8px", fontSize: 12, marginBottom: 8, boxSizing: "border-box" as const }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {STAGE_COLORS.map((c) => (
          <button key={c} onClick={() => setNewStageColor(c)} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: stageColor === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer", padding: 0, outline: "none", boxSizing: "border-box" as const }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onAdd} disabled={!stageName.trim()} style={{ flex: 1, background: stageColor, color: "#0d1117", border: "none", borderRadius: 6, padding: "5px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: stageName.trim() ? 1 : 0.5 }}>Add</button>
        <button onClick={onCancel} style={{ flex: 1, background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 6, padding: "5px 0", fontSize: 12, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Add Card Modal ────────────────────────────────────────────────────────────

function AddCardModal({
  companyId,
  defaultStage,
  activeClients = [],
  onAdd,
  onClose,
}: {
  companyId: string;
  defaultStage: string;
  activeClients?: ActiveClient[];
  onAdd: (card: ProjectCard) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedClient, setSelectedClient] = useState<ActiveClient | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name.trim(),
          clientId: selectedClient?.id ?? null,
          stage: defaultStage,
          pipelineType: "project",
        }),
      });
      if (!res.ok) return;
      const d = await res.json();
      onAdd({
        id: d.id,
        displayName: d.displayName,
        stage: d.stage,
        source: d.source,
        estimateValue: d.estimateValue != null ? Number(d.estimateValue) : null,
        notes: d.notes,
        clientId: d.clientId,
        clientName: d.client?.name ?? null,
        clientEmail: d.client?.email ?? null,
        sortOrder: d.sortOrder,
        createdAt: d.createdAt,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700, margin: 0 }}>Add Project</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Project Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Active Client (optional — needed for email notifications)</label>
            {activeClients.length === 0 ? (
              <p style={{ color: "#484f58", fontSize: 12 }}>No active clients — mark clients as Active in the Clients tab first.</p>
            ) : (
              <select
                value={selectedClient?.id ?? ""}
                onChange={(e) => {
                  const c = activeClients.find(c => c.id === e.target.value) ?? null;
                  setSelectedClient(c);
                }}
                style={{ width: "100%", background: "#0d1117", color: selectedClient ? "#e6edf3" : "#6b7280", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" as const }}
              >
                <option value="">— None —</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ""}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={handleAdd} disabled={saving || !name.trim()}
            style={{ flex: 1, background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving || !name.trim() ? 0.5 : 1 }}>
            {saving ? "Adding…" : "Add Project"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────────────────────────

function ProjectCardComponent({
  card,
  stageColor,
  stageLabel,
  companyId,
  onDragStart,
  onDelete,
  onUpdate,
  onNotes,
}: {
  card: ProjectCard;
  stageColor: string;
  stageLabel: string;
  companyId: string;
  onDragStart: (e: React.DragEvent, payload: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ProjectCard>) => void;
  onNotes: (id: string, name: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [noteResult, setNoteResult] = useState<string | null>(null);

  async function submitNote() {
    if (!noteInput.trim()) return;
    setSendingNote(true);
    setNoteResult(null);
    try {
      const res = await fetch(`/api/${companyId}/pipeline/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteInput.trim(), stageLabel }),
      });
      if (res.ok) {
        onUpdate(card.id, { notes: noteInput.trim() });
        setNoteResult(card.clientEmail ? "✓ Saved & emailed client" : "✓ Saved (no client email)");
        setNoteInput("");
        setTimeout(() => { setAddingNote(false); setNoteResult(null); }, 2000);
      }
    } finally {
      setSendingNote(false);
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => { setDragging(true); onDragStart(e, JSON.stringify({ type: "project", cardId: card.id })); }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !dragging ? "#12181f" : "#0d1117",
        border: "1px solid #30373f",
        borderRadius: 8,
        padding: "10px 12px",
        margin: "0 8px 8px",
        cursor: dragging ? "grabbing" : "grab",
        opacity: dragging ? 0.4 : 1,
        transform: hovered && !dragging ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.12s, background 0.12s",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Notes + Delete buttons */}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, opacity: hovered ? 1 : 0, transition: "opacity 0.1s" }}>
        <button onClick={(e) => { e.stopPropagation(); onNotes(card.id, card.displayName); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "1px 3px" }}
          title="Notes">📝</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
          title="Remove">×</button>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 16 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: avatarColor(card.displayName), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {initials(card.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#e6edf3", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.displayName}
          </div>
          {card.clientName && card.clientName !== card.displayName && (
            <div style={{ color: "#8b949e", fontSize: 10, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              👤 {card.clientName}
            </div>
          )}
          {card.estimateValue != null && (
            <div style={{ color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>${card.estimateValue.toLocaleString()}</div>
          )}
        </div>
      </div>

      {/* Current note */}
      {card.notes && !addingNote && (
        <div style={{ color: "#8b949e", fontSize: 10, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderTop: "1px solid #21262d", paddingTop: 5 }}>
          {card.notes}
        </div>
      )}

      {/* Add note */}
      {addingNote ? (
        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            rows={2}
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="What happened today..."
            style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: `1px solid ${stageColor}66`, borderRadius: 4, padding: "5px 7px", fontSize: 11, resize: "none", boxSizing: "border-box" }}
          />
          {noteResult && <div style={{ color: "#22c55e", fontSize: 10, marginTop: 2 }}>{noteResult}</div>}
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <button onClick={submitNote} disabled={sendingNote || !noteInput.trim()}
              style={{ flex: 1, background: stageColor, color: "#0d1117", border: "none", borderRadius: 4, padding: "4px 0", fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: sendingNote || !noteInput.trim() ? 0.6 : 1 }}>
              {sendingNote ? "Sending…" : card.clientEmail ? "Save + Email" : "Save"}
            </button>
            <button onClick={() => { setAddingNote(false); setNoteInput(""); setNoteResult(null); }}
              style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 4, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); setAddingNote(true); }}
          style={{ marginTop: 8, width: "100%", background: "transparent", color: stageColor, border: `1px dashed ${stageColor}66`, borderRadius: 4, padding: "3px 0", fontSize: 10, cursor: "pointer", opacity: hovered ? 1 : 0.5, transition: "opacity 0.1s" }}>
          + Add note {card.clientEmail ? "& notify client" : ""}
        </button>
      )}

      <div style={{ color: "#484f58", fontSize: 10, marginTop: 5 }}>{relTime(card.createdAt)}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectPipeline({ companyId, initialCards, activeClients = [] }: Props) {
  const [cards, setCards] = useState<ProjectCard[]>(initialCards);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [notesClientId, setNotesClientId] = useState<string | null>(null);
  const [notesTitle, setNotesTitle] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragPayload = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [insertAfterStageId, setInsertAfterStageId] = useState<string | null>(null); // null=hidden, stageId=after that, "END"=append
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[0]);
  const draggingColId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [addCardStage, setAddCardStage] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [colorPickerStageId, setColorPickerStageId] = useState<string | null>(null);

  useEffect(() => { setStages(loadProjectStages()); }, []);

  const filteredCards = search
    ? cards.filter((c) => c.displayName.toLowerCase().includes(search.toLowerCase()) || (c.clientName ?? "").toLowerCase().includes(search.toLowerCase()))
    : cards;

  function handleColDragStart(e: React.DragEvent, stageId: string) {
    draggingColId.current = stageId;
    e.dataTransfer.setData("colId", stageId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleColDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault(); e.stopPropagation();
    setDragOverCol(null);
    const srcId = draggingColId.current;
    if (!srcId || srcId === targetId) return;
    draggingColId.current = null;
    setStages((prev) => {
      const next = [...prev];
      const from = next.findIndex((s) => s.id === srcId);
      const to = next.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveProjectStages(next);
      return next;
    });
  }

  function recolorStage(stageId: string, color: string) {
    setStages((prev) => {
      const next = prev.map((s) => s.id === stageId ? { ...s, color } : s);
      saveProjectStages(next);
      return next;
    });
    setColorPickerStageId(null);
  }

  function renameStage(stageId: string) {
    const name = editingStageName.trim();
    if (!name) { setEditingStageId(null); return; }
    setStages((prev) => {
      const next = prev.map((s) => s.id === stageId ? { ...s, label: name } : s);
      saveProjectStages(next);
      return next;
    });
    setEditingStageId(null);
  }

  function handleAddStage() {
    const name = newStageName.trim();
    if (!name) return;
    const id = "PROJ_CUSTOM_" + name.toUpperCase().replace(/\s+/g, "_") + "_" + Date.now();
    const stage: PipelineStage = { id, label: name, color: newStageColor, custom: true };
    setStages((prev) => {
      let next: PipelineStage[];
      if (insertAfterStageId === "END" || !insertAfterStageId) {
        next = [...prev, stage];
      } else {
        const idx = prev.findIndex((s) => s.id === insertAfterStageId);
        next = idx >= 0 ? [...prev.slice(0, idx + 1), stage, ...prev.slice(idx + 1)] : [...prev, stage];
      }
      saveProjectStages(next);
      return next;
    });
    setNewStageName(""); setNewStageColor(STAGE_COLORS[0]); setInsertAfterStageId(null);
  }

  const handleDragStart = useCallback((e: React.DragEvent, payload: string) => {
    dragPayload.current = payload;
    e.dataTransfer.setData("payload", payload);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault(); setDragOver(null);
    const raw = e.dataTransfer.getData("payload") || dragPayload.current;
    if (!raw) return;
    let payload: { type: string; cardId?: string };
    try { payload = JSON.parse(raw); } catch { return; }
    if (payload.type !== "project" || !payload.cardId) return;
    const card = cards.find((c) => c.id === payload.cardId);
    if (!card || card.stage === targetStage) return;
    setCards((prev) => prev.map((c) => c.id === payload.cardId ? { ...c, stage: targetStage } : c));
    try {
      await fetch(`/api/${companyId}/pipeline/${payload.cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStage }),
      });
    } catch {
      setCards((prev) => prev.map((c) => c.id === payload.cardId ? { ...c, stage: card.stage } : c));
    }
  }, [cards, companyId]);

  const handleDelete = useCallback(async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    try { await fetch(`/api/${companyId}/pipeline/${cardId}`, { method: "DELETE" }); } catch { /* */ }
  }, [companyId]);

  const handleUpdate = useCallback((cardId: string, patch: Partial<ProjectCard>) => {
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, ...patch } : c));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ background: "#161b22", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 8, padding: "7px 14px", fontSize: 13, width: 240, outline: "none" }} />
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
        {stages.map((stage) => {
          const stageCards = filteredCards.filter((c) => c.stage === stage.id);
          const isOver = dragOver === stage.id;
          const isColOver = dragOverCol === stage.id;

          return (
            <div key={stage.id}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(stage.id); if (draggingColId.current && draggingColId.current !== stage.id) setDragOverCol(stage.id); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOver(null); setDragOverCol(null); } }}
              onDrop={(e) => { handleDrop(e, stage.id); handleColDrop(e, stage.id); }}
              onDragEnd={() => { draggingColId.current = null; setDragOverCol(null); }}
              style={{ minWidth: 260, width: 260, flexShrink: 0, background: isOver ? "#1a2030" : "#161b22", borderRadius: 12, overflow: "hidden", border: isColOver ? `2px dashed ${stage.color}` : isOver ? `2px solid ${stage.color}` : "2px solid transparent", transition: "background 0.15s, border-color 0.15s", opacity: draggingColId.current === stage.id ? 0.4 : 1 }}
            >
              <div draggable onDragStart={(e) => handleColDragStart(e, stage.id)}
                style={{ padding: "14px 14px 10px", background: "#1e2736", borderTop: `3px solid ${stage.color}`, cursor: "grab" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#484f58", fontSize: 10, flexShrink: 0 }}>⠿</span>
                    <button onClick={(e) => { e.stopPropagation(); setColorPickerStageId(colorPickerStageId === stage.id ? null : stage.id); }}
                      style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, border: "none", cursor: "pointer", flexShrink: 0, padding: 0 }}
                      title="Change color" />
                    {editingStageId === stage.id ? (
                      <input autoFocus value={editingStageName} onChange={(e) => setEditingStageName(e.target.value)}
                        onBlur={() => renameStage(stage.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameStage(stage.id); if (e.key === "Escape") setEditingStageId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: "transparent", color: "#e6edf3", border: "none", borderBottom: `1px solid ${stage.color}`, outline: "none", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", width: "100%", padding: 0 }} />
                    ) : (
                      <span onDoubleClick={(e) => { e.stopPropagation(); setEditingStageId(stage.id); setEditingStageName(stage.label); }}
                        style={{ color: "#e6edf3", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}
                        title="Double-click to rename">
                        {stage.label}
                      </span>
                    )}
                  </div>
                  <span style={{ background: stage.color + "33", color: stage.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px", border: `1px solid ${stage.color}55`, flexShrink: 0 }}>{stageCards.length}</span>
                </div>
                {colorPickerStageId === stage.id && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                    {STAGE_COLORS.map((c) => (
                      <button key={c} onClick={() => recolorStage(stage.id, c)}
                        style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: stage.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer", padding: 0, outline: "none", boxSizing: "border-box" }} />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ minHeight: 80, paddingTop: 8 }}>
                {stageCards.map((card) => (
                  <ProjectCardComponent key={card.id} card={card} stageColor={stage.color} stageLabel={stage.label} companyId={companyId}
                    onDragStart={handleDragStart} onDelete={handleDelete} onUpdate={handleUpdate}
                    onNotes={(_, name) => { setNotesClientId(card.clientId); setNotesTitle(name); }} />
                ))}
                {stageCards.length === 0 && (
                  <div style={{ color: "#30373f", fontSize: 11, textAlign: "center", padding: "16px 12px", fontStyle: "italic" }}>Drop projects here</div>
                )}
                <button onClick={() => setAddCardStage(stage.id)}
                  style={{ width: "calc(100% - 16px)", margin: "0 8px 8px", background: "transparent", color: "#484f58", border: "1px dashed #30373f", borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = stage.color; (e.currentTarget as HTMLButtonElement).style.borderColor = stage.color + "66"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#484f58"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#30373f"; }}>
                  + Add project
                </button>
              </div>
            </div>

            {/* Insert after this stage */}
            <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 8 }}>
              {insertAfterStageId === stage.id ? (
                <AddStageForm
                  stageName={newStageName} setNewStageName={setNewStageName}
                  stageColor={newStageColor} setNewStageColor={setNewStageColor}
                  onAdd={handleAddStage} onCancel={() => { setInsertAfterStageId(null); setNewStageName(""); }}
                />
              ) : (
                <button
                  onClick={() => setInsertAfterStageId(stage.id)}
                  title="Insert stage here"
                  style={{ background: "transparent", border: "none", color: "#30373f", fontSize: 20, cursor: "pointer", padding: "4px 6px", borderRadius: 6, transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#30373f")}
                >+</button>
              )}
            </div>
          );
        })}

        {/* Add Stage at END button */}
        <div style={{ minWidth: 200, flexShrink: 0, alignSelf: "flex-start" }}>
          {insertAfterStageId === "END" ? (
            <AddStageForm
              stageName={newStageName} setNewStageName={setNewStageName}
              stageColor={newStageColor} setNewStageColor={setNewStageColor}
              onAdd={handleAddStage} onCancel={() => { setInsertAfterStageId(null); setNewStageName(""); }}
            />
          ) : (
            <button onClick={() => setInsertAfterStageId("END")}
              style={{ width: "100%", background: "transparent", color: "#8b949e", border: "2px dashed #30373f", borderRadius: 12, padding: "24px 0", fontSize: 22, cursor: "pointer", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C66"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8b949e"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#30373f"; }}
              title="Add a new stage">+</button>
          )}
        </div>
      </div>

      {addCardStage && (
        <AddCardModal companyId={companyId} defaultStage={addCardStage} activeClients={activeClients}
          onAdd={(card) => setCards((prev) => [...prev, card])}
          onClose={() => setAddCardStage(null)} />
      )}

      {notesClientId && (
        <NotesPanel
          companyId={companyId}
          clientId={notesClientId}
          title={notesTitle}
          onClose={() => setNotesClientId(null)}
        />
      )}
    </div>
  );
}
