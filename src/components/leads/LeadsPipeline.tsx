"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { type PipelineStage, loadStages, saveStages, STAGE_COLORS } from "@/lib/pipelineStages";
import NotesPanel from "@/components/notes/NotesPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type TriageLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  receivedAt: string;
  status: string;
};

type StagedCard = {
  id: string;
  displayName: string;
  stage: string;
  source: string | null;
  estimateValue: number | null;
  notes: string | null;
  leadId: string | null;
  phone: string | null;
  sortOrder: number;
  stageChangedAt: string | null;
  createdAt: string;
};

type Props = {
  companyId: string;
  triageLeads: TriageLead[];
  stagedCards: StagedCard[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_SOURCES = ["Evolute", "ADU Elite", "NSA", "FYRD UP"];

const AVATAR_COLORS = [
  "#3b82f6", "#a855f7", "#C9A84C", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#ef4444", "#8b5cf6", "#f59e0b",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Source Selector ──────────────────────────────────────────────────────────

function SourceSelector({
  value,
  onChange,
  stageColor,
  customSources,
  onAddCustomSource,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  stageColor: string;
  customSources: string[];
  onAddCustomSource: (s: string) => void;
}) {
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const all = [...PRESET_SOURCES, ...customSources];

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "__add__") { setAddingCustom(true); return; }
    onChange(v === "" ? null : v);
  }

  function handleAddCustom() {
    const v = customInput.trim();
    if (!v) return;
    onAddCustomSource(v);
    onChange(v);
    setAddingCustom(false);
    setCustomInput("");
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {addingCustom ? (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input
            autoFocus
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); if (e.key === "Escape") setAddingCustom(false); }}
            placeholder="Source name..."
            style={{
              flex: 1, background: "#0d1117", color: "#e6edf3",
              border: "1px solid #484f58", borderRadius: 4,
              padding: "3px 6px", fontSize: 11,
            }}
          />
          <button onClick={handleAddCustom} style={{ background: stageColor, color: "#0d1117", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
          <button onClick={() => setAddingCustom(false)} style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 4, padding: "3px 6px", fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <select
          value={value ?? ""}
          onChange={handleSelect}
          style={{
            width: "100%",
            background: "#0d1117",
            color: value ? stageColor : "#484f58",
            border: `1px solid ${value ? stageColor + "66" : "#30373f"}`,
            borderRadius: 4,
            padding: "3px 6px",
            fontSize: 11,
            marginTop: 4,
            cursor: "pointer",
          }}
        >
          <option value="">Source…</option>
          {all.map((s) => (
            <option key={s} value={s} style={{ color: "#e6edf3" }}>{s}</option>
          ))}
          <option value="__add__" style={{ color: "#C9A84C" }}>+ Add source…</option>
        </select>
      )}
    </div>
  );
}

// ─── Project Type Selector ────────────────────────────────────────────────────

const PRESET_PROJECT_TYPES = [
  "Roof Replacement",
  "Bathroom Remodeling",
  "Kitchen Remodeling",
  "Custom Home",
  "Additions",
];

function ProjectTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const all = [...PRESET_PROJECT_TYPES, ...customTypes];

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "__add__") { setAddingCustom(true); return; }
    onChange(v);
  }

  function handleAddCustom() {
    const v = customInput.trim();
    if (!v) return;
    setCustomTypes((prev) => [...prev, v]);
    onChange(v);
    setAddingCustom(false);
    setCustomInput("");
  }

  return (
    <div>
      {addingCustom ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input autoFocus value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); if (e.key === "Escape") setAddingCustom(false); }}
            placeholder="Project type..."
            style={{ flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #484f58", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" as const }} />
          <button onClick={handleAddCustom} style={{ background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓</button>
          <button onClick={() => setAddingCustom(false)} style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 6, padding: "7px 8px", fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <select value={value} onChange={handleSelect}
          style={{ width: "100%", background: "#0d1117", color: value ? "#e6edf3" : "#484f58", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" as const }}>
          <option value="">Select project type…</option>
          {all.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="__add__" style={{ color: "#C9A84C" }}>+ Add type…</option>
        </select>
      )}
    </div>
  );
}

const TRIAGE_COLOR = "#ef4444";

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

// ─── Triage Lead Card ─────────────────────────────────────────────────────────

function TriageCard({
  lead,
  stages,
  onDragStart,
  onEdit,
  onDelete,
  onNotes,
  onMoveToStage,
  customSources,
  onAddCustomSource,
}: {
  lead: TriageLead;
  stages: PipelineStage[];
  onDragStart: (e: React.DragEvent, payload: string) => void;
  onEdit: (leadId: string) => void;
  onDelete: (leadId: string) => void;
  onNotes: (leadId: string, name: string) => void;
  customSources: string[];
  onAddCustomSource: (s: string) => void;
  onMoveToStage: (leadId: string, stageId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  return (
    <div
      draggable
      onDragStart={(e) => { setDragging(true); onDragStart(e, JSON.stringify({ type: "triage", leadId: lead.id })); }}
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
      {/* Edit + Notes + Delete buttons */}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, opacity: hovered ? 1 : 0, transition: "opacity 0.1s" }}>
        <button onClick={(e) => { e.stopPropagation(); onEdit(lead.id); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "1px 3px" }} title="Edit">✎</button>
        <button onClick={(e) => { e.stopPropagation(); onNotes(lead.id, lead.name); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "1px 3px" }} title="Notes">📝</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: "0 2px" }} title="Delete">×</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: avatarColor(lead.name), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {initials(lead.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 32 }}>
          <div style={{ color: "#e6edf3", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lead.name}
          </div>
          {lead.projectType && (
            <div style={{ color: "#C9A84C", fontSize: 10, marginTop: 1 }}>{lead.projectType}</div>
          )}
        </div>
      </div>
      {lead.email && (
        <div style={{ color: "#8b949e", fontSize: 10, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>✉ {lead.email}</div>
      )}
      {lead.phone && (
        <div style={{ color: "#8b949e", fontSize: 10, marginTop: 2 }}>📞 {lead.phone}</div>
      )}
      <SourceSelector value={source} onChange={setSource} stageColor={TRIAGE_COLOR} customSources={customSources} onAddCustomSource={onAddCustomSource} />
      <div style={{ marginTop: 5 }} onClick={(e) => e.stopPropagation()}>
        <select
          value=""
          onChange={(e) => { if (e.target.value) { onMoveToStage(lead.id, e.target.value); e.currentTarget.value = ""; } }}
          style={{ width: "100%", background: "#0d1117", color: "#8b949e", border: "1px solid #30373f", borderRadius: 4, padding: "3px 6px", fontSize: 11, cursor: "pointer" }}
        >
          <option value="">Move to stage…</option>
          {stages.map((s) => <option key={s.id} value={s.id} style={{ color: "#e6edf3" }}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ color: "#484f58", fontSize: 10, marginTop: 4 }}>{relTime(lead.receivedAt)}</div>
    </div>
  );
}

// ─── Staged Card ──────────────────────────────────────────────────────────────

function StageCard({
  card,
  stageColor,
  stages,
  onDragStart,
  onDelete,
  onSourceChange,
  onStageChange,
  onEdit,
  onNotes,
  customSources,
  onAddCustomSource,
}: {
  card: StagedCard;
  stageColor: string;
  stages: PipelineStage[];
  onDragStart: (e: React.DragEvent, payload: string) => void;
  onDelete: (id: string) => void;
  onSourceChange: (id: string, source: string | null) => void;
  onStageChange: (id: string, stageId: string) => void;
  onEdit: (leadId: string) => void;
  onNotes: (leadId: string, name: string) => void;
  customSources: string[];
  onAddCustomSource: (s: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => { setDragging(true); onDragStart(e, JSON.stringify({ type: "staged", cardId: card.id })); }}
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
      {/* Action buttons — always visible for mobile access */}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2 }}>
        {card.leadId && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(card.leadId!); }}
            style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "1px 3px" }}
            title="Edit lead"
          >✎</button>
        )}
        {card.leadId && (
          <button
            onClick={(e) => { e.stopPropagation(); onNotes(card.leadId!, card.displayName); }}
            style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "1px 3px" }}
            title="Notes"
          >📝</button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
          title="Remove from pipeline"
        >×</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: avatarColor(card.displayName), flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>
          {initials(card.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 52 }}>
          <div style={{ color: "#e6edf3", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.displayName}
          </div>
          {card.estimateValue != null && (
            <div style={{ color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>
              ${card.estimateValue.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {card.phone && (
        <a
          href={`tel:${card.phone}`}
          onClick={(e) => e.stopPropagation()}
          style={{ color: "#60a5fa", fontSize: 11, marginTop: 4, display: "block" }}
        >
          📞 {card.phone}
        </a>
      )}

      {/* Source dropdown */}
      <SourceSelector
        value={card.source}
        stageColor={stageColor}
        onChange={(v) => onSourceChange(card.id, v)}
        customSources={customSources}
        onAddCustomSource={onAddCustomSource}
      />

      {/* Stage dropdown */}
      <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
        <select
          value={card.stage}
          onChange={(e) => onStageChange(card.id, e.target.value)}
          style={{ width: "100%", background: "#0d1117", color: stageColor, border: `1px solid ${stageColor}44`, borderRadius: 4, padding: "3px 6px", fontSize: 11, cursor: "pointer" }}
        >
          {stages.map((s) => <option key={s.id} value={s.id} style={{ color: "#e6edf3" }}>{s.label}</option>)}
        </select>
      </div>

      {card.notes && (
        <div style={{ color: "#8b949e", fontSize: 10, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {card.notes}
        </div>
      )}
      <div style={{ color: "#484f58", fontSize: 10, marginTop: 5 }}>
        {card.stageChangedAt
          ? `In stage ${relTime(card.stageChangedAt)}`
          : `Added ${relTime(card.createdAt)}`}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPipeline({ companyId, triageLeads, stagedCards }: Props) {
  const [triage, setTriage] = useState<TriageLead[]>(triageLeads);
  const [cards, setCards] = useState<StagedCard[]>(stagedCards);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [customSources, setCustomSources] = useState<string[]>(() => {
    const existing = stagedCards.map(c => c.source).filter(Boolean) as string[];
    return Array.from(new Set(existing.filter(s => !PRESET_SOURCES.includes(s))));
  });
  const handleAddCustomSource = useCallback((s: string) => {
    setCustomSources(prev => prev.includes(s) ? prev : [...prev, s]);
  }, []);
  const [dragOver, setDragOver] = useState<string | null>(null); // stageId or "triage"
  const dragPayload = useRef<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Notes panel ──────────────────────────────────────────────────────────
  const [notesLeadId, setNotesLeadId] = useState<string | null>(null);
  const [notesTitle, setNotesTitle] = useState("");

  // ── Edit lead modal ──────────────────────────────────────────────────────
  type EditForm = { name: string; email: string; phone: string; address: string; city: string; state: string; projectType: string; message: string };
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", phone: "", address: "", city: "", state: "FL", projectType: "", message: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);

  async function openEdit(leadId: string) {
    setEditLeadId(leadId);
    setEditForm({ name: "", email: "", phone: "", address: "", city: "", state: "", projectType: "", message: "" });
    try {
      const res = await fetch(`/api/${companyId}/leads/${leadId}`);
      if (res.ok) {
        const d = await res.json();
        setEditForm({ name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "", address: d.address ?? "", city: d.city ?? "", state: d.state ?? "FL", projectType: d.projectType ?? "", message: d.message ?? "" });
      }
    } catch { /* ignore */ }
  }

  async function saveEdit() {
    if (!editLeadId) return;
    setEditSaving(true);
    try {
      await fetch(`/api/${companyId}/leads/${editLeadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      // Update local state
      const name = editForm.name || "Unknown";
      setTriage((prev) => prev.map((l) => l.id === editLeadId ? { ...l, name, email: editForm.email || null, phone: editForm.phone || null, projectType: editForm.projectType || null } : l));
      setCards((prev) => prev.map((c) => c.leadId === editLeadId ? { ...c, displayName: name } : c));
      setEditLeadId(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteLead(leadId: string) {
    setEditDeleting(true);
    try {
      await fetch(`/api/${companyId}/leads/${leadId}`, { method: "DELETE" });
      setTriage((prev) => prev.filter((l) => l.id !== leadId));
      setCards((prev) => prev.filter((c) => c.leadId !== leadId));
      setEditLeadId(null);
    } finally {
      setEditDeleting(false);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [insertAfterStageId, setInsertAfterStageId] = useState<string | null>(null); // null=hidden, stageId=after that, "END"=append
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[0]);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [colorPickerStageId, setColorPickerStageId] = useState<string | null>(null);
  const draggingColId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [colSort, setColSort] = useState<Record<string, "asc" | "desc">>({});

  useEffect(() => { setStages(loadStages()); }, []);

  function handleColDragStart(e: React.DragEvent, stageId: string) {
    draggingColId.current = stageId;
    e.dataTransfer.setData("colId", stageId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleColDragOver(e: React.DragEvent, stageId: string) {
    if (!draggingColId.current || draggingColId.current === stageId) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(stageId);
  }

  function handleColDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    const srcId = draggingColId.current;
    if (!srcId || srcId === targetId) return;
    draggingColId.current = null;
    setStages((prev) => {
      const next = [...prev];
      const from = next.findIndex((s) => s.id === srcId);
      const to   = next.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveStages(next);
      return next;
    });
  }

  function recolorStage(stageId: string, color: string) {
    setStages((prev) => {
      const next = prev.map((s) => s.id === stageId ? { ...s, color } : s);
      saveStages(next);
      return next;
    });
    setColorPickerStageId(null);
  }

  function renameStage(stageId: string) {
    const name = editingStageName.trim();
    if (!name) { setEditingStageId(null); return; }
    setStages((prev) => {
      const next = prev.map((s) => s.id === stageId ? { ...s, label: name } : s);
      saveStages(next);
      return next;
    });
    setEditingStageId(null);
  }

  function deleteStage(stageId: string) {
    const stageCards = cards.filter((c) => c.stage === stageId);
    if (stageCards.length > 0) {
      alert(`Move all ${stageCards.length} lead(s) out of this stage before deleting it.`);
      return;
    }
    if (!confirm("Delete this stage?")) return;
    setStages((prev) => {
      const next = prev.filter((s) => s.id !== stageId);
      saveStages(next);
      return next;
    });
  }

  function handleAddStage() {
    const name = newStageName.trim();
    if (!name) return;
    const id = "CUSTOM_" + name.toUpperCase().replace(/\s+/g, "_") + "_" + Date.now();
    const stage: PipelineStage = { id, label: name, color: newStageColor, custom: true };
    setStages((prev) => {
      let next: PipelineStage[];
      if (insertAfterStageId === "END" || !insertAfterStageId) {
        next = [...prev, stage];
      } else {
        const idx = prev.findIndex((s) => s.id === insertAfterStageId);
        next = idx >= 0 ? [...prev.slice(0, idx + 1), stage, ...prev.slice(idx + 1)] : [...prev, stage];
      }
      saveStages(next);
      return next;
    });
    setNewStageName("");
    setNewStageColor(STAGE_COLORS[0]);
    setInsertAfterStageId(null);
  }

  const filteredTriage = search
    ? triage.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : triage;

  const filteredCards = search
    ? cards.filter((c) => c.displayName.toLowerCase().includes(search.toLowerCase()))
    : cards;

  const handleDragStart = useCallback((e: React.DragEvent, payload: string) => {
    dragPayload.current = payload;
    e.dataTransfer.setData("payload", payload);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(zone);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: string | "triage") => {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("payload") || dragPayload.current;
    if (!raw) return;

    let payload: { type: string; leadId?: string; cardId?: string };
    try { payload = JSON.parse(raw); } catch { return; }

    // Dropping a triage lead onto a stage column → create pipeline card
    if (payload.type === "triage" && payload.leadId && targetStage !== "triage") {
      const lead = triage.find((l) => l.id === payload.leadId);
      if (!lead) return;

      // Optimistic: remove from triage, add to staged
      const tempCard: StagedCard = {
        id: `temp-${Date.now()}`,
        displayName: lead.name,
        stage: targetStage,
        source: null,
        estimateValue: null,
        notes: null,
        leadId: lead.id,
        phone: lead.phone,
        sortOrder: 0,
        stageChangedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setTriage((prev) => prev.filter((l) => l.id !== payload.leadId));
      setCards((prev) => [...prev, tempCard]);

      try {
        const res = await fetch(`/api/${companyId}/pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: lead.name,
            leadId: lead.id,
            stage: targetStage,
          }),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setCards((prev) => prev.map((c) => c.id === tempCard.id ? {
          id: created.id,
          displayName: created.displayName,
          stage: created.stage,
          source: created.source,
          estimateValue: created.estimateValue != null ? Number(created.estimateValue) : null,
          notes: created.notes,
          leadId: created.leadId,
          phone: created.lead?.phone ?? lead.phone,
          sortOrder: created.sortOrder,
          stageChangedAt: created.stageChangedAt ?? new Date().toISOString(),
          createdAt: created.createdAt,
        } : c));
      } catch {
        // Revert
        setCards((prev) => prev.filter((c) => c.id !== tempCard.id));
        setTriage((prev) => [...prev, lead]);
      }
    }

    // Dropping a staged card back to triage → delete pipeline card
    if (payload.type === "staged" && payload.cardId && targetStage === "triage") {
      const card = cards.find((c) => c.id === payload.cardId);
      if (!card) return;
      const lead = triageLeads.find((l) => l.id === card.leadId) ?? triage.find((l) => l.id === card.leadId);

      setCards((prev) => prev.filter((c) => c.id !== payload.cardId));
      if (card.leadId) {
        // Find the original lead data from triageLeads prop or reconstruct
        const origLead = triageLeads.find((l) => l.id === card.leadId);
        if (origLead) setTriage((prev) => [origLead, ...prev]);
      }

      try {
        await fetch(`/api/${companyId}/pipeline/${payload.cardId}`, { method: "DELETE" });
      } catch {
        // Revert
        setCards((prev) => [...prev, card]);
        if (lead && card.leadId) setTriage((prev) => prev.filter((l) => l.id !== card.leadId));
      }
    }

    // Moving staged card between stage columns
    if (payload.type === "staged" && payload.cardId && targetStage !== "triage") {
      const card = cards.find((c) => c.id === payload.cardId);
      if (!card || card.stage === targetStage) return;

      const now = new Date().toISOString();
      setCards((prev) => prev.map((c) => c.id === payload.cardId ? { ...c, stage: targetStage, stageChangedAt: now } : c));
      try {
        await fetch(`/api/${companyId}/pipeline/${payload.cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: targetStage }),
        });
      } catch {
        setCards((prev) => prev.map((c) => c.id === payload.cardId ? { ...c, stage: card.stage, stageChangedAt: card.stageChangedAt } : c));
      }
    }
  }, [triage, cards, companyId, triageLeads]);

  const handleDeleteTriageLead = useCallback(async (leadId: string) => {
    setTriage((prev) => prev.filter((l) => l.id !== leadId));
    try { await fetch(`/api/${companyId}/leads/${leadId}`, { method: "DELETE" }); } catch { /* */ }
  }, [companyId]);

  const handleDelete = useCallback(async (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (card.leadId) {
      const origLead = triageLeads.find((l) => l.id === card.leadId);
      if (origLead) setTriage((prev) => [origLead, ...prev]);
    }
    try {
      await fetch(`/api/${companyId}/pipeline/${cardId}`, { method: "DELETE" });
    } catch {
      setCards((prev) => [...prev, card]);
      if (card.leadId) setTriage((prev) => prev.filter((l) => l.id !== card.leadId));
    }
  }, [cards, companyId, triageLeads]);

  const handleSourceChange = useCallback(async (cardId: string, source: string | null) => {
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, source } : c));
    try {
      await fetch(`/api/${companyId}/pipeline/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
    } catch { /* non-fatal */ }
  }, [companyId]);

  const handleStageChange = useCallback(async (cardId: string, newStage: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stage === newStage) return;
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, stage: newStage } : c));
    try {
      await fetch(`/api/${companyId}/pipeline/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch {
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, stage: card.stage } : c));
    }
  }, [cards, companyId]);

  const handleTriageMoveToStage = useCallback(async (leadId: string, targetStage: string) => {
    const lead = triage.find((l) => l.id === leadId);
    if (!lead) return;
    const tempCard: StagedCard = {
      id: `temp-${Date.now()}`, displayName: lead.name, stage: targetStage,
      source: null, estimateValue: null, notes: null, leadId: lead.id, sortOrder: 0, createdAt: new Date().toISOString(),
      phone: lead.phone ?? null, stageChangedAt: new Date().toISOString(),
    };
    setTriage((prev) => prev.filter((l) => l.id !== leadId));
    setCards((prev) => [...prev, tempCard]);
    try {
      const res = await fetch(`/api/${companyId}/pipeline`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: lead.name, leadId: lead.id, stage: targetStage }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setCards((prev) => prev.map((c) => c.id === tempCard.id ? {
        id: created.id, displayName: created.displayName, stage: created.stage,
        source: created.source, estimateValue: created.estimateValue != null ? Number(created.estimateValue) : null,
        notes: created.notes, leadId: created.leadId, sortOrder: created.sortOrder, createdAt: created.createdAt,
        phone: created.lead?.phone ?? null, stageChangedAt: created.stageChangedAt ?? null,
      } : c));
    } catch {
      setCards((prev) => prev.filter((c) => c.id !== tempCard.id));
      setTriage((prev) => [...prev, lead]);
    }
  }, [triage, companyId]);

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#161b22", color: "#e6edf3",
            border: "1px solid #30373f", borderRadius: 8,
            padding: "7px 14px", fontSize: 13, width: 240, outline: "none",
          }}
        />
      </div>

      {/* Board — triage + stage columns */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>

        {/* Triage column */}
        <div
          onDragOver={(e) => handleDragOver(e, "triage")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "triage")}
          style={{
            minWidth: 260, width: 260, flexShrink: 0,
            background: dragOver === "triage" ? "#1e1215" : "#161b22",
            borderRadius: 12, overflow: "hidden",
            border: dragOver === "triage" ? `2px solid ${TRIAGE_COLOR}` : "2px solid transparent",
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          <div style={{ padding: "14px 14px 10px", background: "#1e2736", borderTop: `3px solid ${TRIAGE_COLOR}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Needs Triaging
              </span>
              <span style={{
                background: TRIAGE_COLOR + "33", color: TRIAGE_COLOR,
                fontSize: 11, fontWeight: 700, borderRadius: 20,
                padding: "1px 8px", border: `1px solid ${TRIAGE_COLOR}55`,
              }}>
                {filteredTriage.length}
              </span>
            </div>
            <div style={{ color: "#8b949e", fontSize: 10, marginTop: 3 }}>Drag to a stage →</div>
          </div>
          <div style={{ minHeight: 80, paddingTop: 8 }}>
            {filteredTriage.length === 0 ? (
              <div style={{ color: "#484f58", fontSize: 12, textAlign: "center", padding: "20px 12px", fontStyle: "italic" }}>
                All leads triaged ✓
              </div>
            ) : (
              filteredTriage.map((lead) => (
                <TriageCard key={lead.id} lead={lead} stages={stages} onDragStart={handleDragStart} onEdit={openEdit} onDelete={handleDeleteTriageLead} onNotes={(id, name) => { setNotesLeadId(id); setNotesTitle(name); }} onMoveToStage={handleTriageMoveToStage} customSources={customSources} onAddCustomSource={handleAddCustomSource} />
              ))
            )}
          </div>
        </div>

        {/* Stage columns */}
        {stages.map((stage) => {
          const rawStageCards = filteredCards.filter((c) => c.stage === stage.id);
          const sortDir = colSort[stage.id] ?? null;
          const stageCards = sortDir
            ? [...rawStageCards].sort((a, b) => {
                const aT = new Date(a.stageChangedAt ?? a.createdAt).getTime();
                const bT = new Date(b.stageChangedAt ?? b.createdAt).getTime();
                return sortDir === "desc" ? bT - aT : aT - bT;
              })
            : rawStageCards;
          const isOver = dragOver === stage.id;
          const isColOver = dragOverCol === stage.id;

          return (
            <React.Fragment key={stage.id}>
            <div
              onDragOver={(e) => { handleDragOver(e, stage.id); handleColDragOver(e, stage.id); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOver(null); setDragOverCol(null); } }}
              onDrop={(e) => { handleDrop(e, stage.id); handleColDrop(e, stage.id); }}
              onDragEnd={() => { draggingColId.current = null; setDragOverCol(null); }}
              style={{
                minWidth: 260, width: 260, flexShrink: 0,
                background: isOver ? "#1a2030" : "#161b22",
                borderRadius: 12, overflow: "hidden",
                border: isColOver ? `2px dashed ${stage.color}` : isOver ? `2px solid ${stage.color}` : "2px solid transparent",
                transition: "background 0.15s, border-color 0.15s",
                opacity: draggingColId.current === stage.id ? 0.4 : 1,
              }}
            >
              <div
                draggable
                onDragStart={(e) => handleColDragStart(e, stage.id)}
                style={{ padding: "14px 14px 10px", background: "#1e2736", borderTop: `3px solid ${stage.color}`, cursor: "grab" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#484f58", fontSize: 10, flexShrink: 0 }} title="Drag to reorder">⠿</span>
                    {/* Color swatch — click to open picker */}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ background: stage.color + "33", color: stage.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px", border: `1px solid ${stage.color}55` }}>
                      {stageCards.length}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setColSort(prev => ({ ...prev, [stage.id]: "desc" })); }}
                      title="Newest first"
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "0 1px", color: colSort[stage.id] === "desc" ? "#C9A84C" : "#484f58" }}
                    >↓</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setColSort(prev => ({ ...prev, [stage.id]: "asc" })); }}
                      title="Oldest first"
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "0 1px", color: colSort[stage.id] === "asc" ? "#C9A84C" : "#484f58" }}
                    >↑</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteStage(stage.id); }}
                      title="Delete stage"
                      style={{ background: "transparent", border: "none", color: "#484f58", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
                    >✕</button>
                  </div>
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
                  <StageCard
                    key={card.id}
                    card={card}
                    stageColor={stage.color}
                    stages={stages}
                    onDragStart={handleDragStart}
                    onDelete={handleDelete}
                    onSourceChange={handleSourceChange}
                    onStageChange={handleStageChange}
                    onEdit={openEdit}
                    onNotes={(leadId, name) => { setNotesLeadId(leadId); setNotesTitle(name); }}
                    customSources={customSources}
                    onAddCustomSource={handleAddCustomSource}
                  />
                ))}
                {stageCards.length === 0 && (
                  <div style={{ color: "#30373f", fontSize: 11, textAlign: "center", padding: "16px 12px", fontStyle: "italic" }}>
                    Drop leads here
                  </div>
                )}
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
            </React.Fragment>
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
            <button
              onClick={() => setInsertAfterStageId("END")}
              style={{
                width: "100%", background: "transparent", color: "#8b949e",
                border: "2px dashed #30373f", borderRadius: 12,
                padding: "24px 0", fontSize: 22, cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C66"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8b949e"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#30373f"; }}
              title="Add a new pipeline stage"
            >+</button>
          )}
        </div>
      </div>

      {/* ── Edit Lead Modal ─────────────────────────────────────────────── */}
      {editLeadId && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setEditLeadId(null)}
        >
          <div
            style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: "#e6edf3", fontSize: 15, fontWeight: 700, margin: 0 }}>Edit Lead</h2>
              <button onClick={() => setEditLeadId(null)} style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["name", "email", "phone", "address", "city", "state"] as const).map((field) => (
                <div key={field}>
                  <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, textTransform: "capitalize" }}>{field}</label>
                  <input
                    type="text"
                    value={editForm[field]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                    style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Project Type</label>
                <ProjectTypeSelector value={editForm.projectType} onChange={(v) => setEditForm((f) => ({ ...f, projectType: v }))} />
              </div>
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Message</label>
                <textarea
                  rows={3}
                  value={editForm.message}
                  onChange={(e) => setEditForm((f) => ({ ...f, message: e.target.value }))}
                  style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{ flex: 1, background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => deleteLead(editLeadId)}
                disabled={editDeleting}
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: editDeleting ? 0.6 : 1 }}
              >
                {editDeleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setEditLeadId(null)}
                style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notes Panel ─────────────────────────────────────────────────── */}
      {notesLeadId && (
        <NotesPanel
          companyId={companyId}
          leadId={notesLeadId}
          title={notesTitle}
          onClose={() => setNotesLeadId(null)}
        />
      )}
    </div>
  );
}
