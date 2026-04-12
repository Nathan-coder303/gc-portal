"use client";

import { useState, useRef } from "react";

type Sub = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  divisionCode: string;
  divisionName: string;
  notes: string | null;
  createdAt: string;
};

// Full CSI division list (standard + extras from sheet)
const ALL_DIVISIONS = [
  { code: "01 00 00", name: "General Conditions" },
  { code: "02 00 00", name: "Existing Conditions" },
  { code: "03 00 00", name: "Concrete" },
  { code: "04 00 00", name: "Masonry" },
  { code: "05 00 00", name: "Structural Steel" },
  { code: "06 00 00", name: "Rough Carpentry" },
  { code: "07 00 00", name: "Roofing & Waterproofing" },
  { code: "08 00 00", name: "Doors & Windows" },
  { code: "09 00 00", name: "Finishes" },
  { code: "10 00 00", name: "Specialties" },
  { code: "12 00 00", name: "Furnishings" },
  { code: "13 00 00", name: "Special Construction" },
  { code: "14 00 00", name: "Conveying Equipment" },
  { code: "21 00 00", name: "Fire Suppression" },
  { code: "22 00 00", name: "Plumbing" },
  { code: "23 00 00", name: "HVAC / Mechanical" },
  { code: "26 00 00", name: "Electrical" },
  { code: "27 00 00", name: "Communications / Low Voltage" },
  { code: "31 00 00", name: "Earthwork" },
  { code: "32 00 00", name: "Site Work" },
  { code: "35 00 00", name: "Waterway Construction" },
];

/** Normalize divisionCode to canonical "XX 00 00" format */
function normalizeDivision(code: string, name: string): { code: string; name: string } {
  const exact = ALL_DIVISIONS.find(d => d.code === code);
  if (exact) return { code: exact.code, name: exact.name };
  const digits = code.replace(/\D/g, "");
  const prefix = digits.slice(0, 2).padStart(2, "0");
  const byPrefix = ALL_DIVISIONS.find(d => d.code.startsWith(prefix + " "));
  if (byPrefix) return { code: byPrefix.code, name: byPrefix.name };
  return { code, name };
}

const INPUT: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
  WebkitTextFillColor: "#e6edf3",
  colorScheme: "dark",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
};

const TAG_COLORS = [
  { bg: "#1e2736", border: "#58a6ff44", color: "#58a6ff" },
  { bg: "#1a1a2e", border: "#a78bfa44", color: "#a78bfa" },
  { bg: "#0a1a0f", border: "#22c55e44", color: "#22c55e" },
  { bg: "#2d1a0a", border: "#f97316aa", color: "#f97316" },
  { bg: "#1a0a1a", border: "#ec4899aa", color: "#ec4899" },
];
function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}
function parseTags(notes: string | null): string[] {
  if (!notes) return [];
  try { return JSON.parse(notes); } catch { return notes ? [notes] : []; }
}
function formatPhone(p: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

// ─── TagInput ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  }
  return (
    <div className="flex flex-wrap gap-1 p-1.5 rounded min-h-[36px]" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
      {tags.map(tag => {
        const c = tagColor(tag);
        return (
          <span key={tag} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="leading-none hover:opacity-70">×</button>
          </span>
        );
      })}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
          if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
        }}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Add tags…" : ""}
        className="text-xs outline-none flex-1 min-w-[100px] bg-transparent"
        style={{ color: "#e6edf3" }}
      />
    </div>
  );
}

// ─── Sub Card ─────────────────────────────────────────────────────────────────
function SubCard({
  sub, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onEdit, onDelete, onDuplicate,
}: {
  sub: Sub; isDragOver: boolean;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void; onDragEnd: () => void;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const tags = parseTags(sub.notes);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-xl flex flex-col gap-2 p-3 select-none transition-all"
      style={{
        background: isDragOver ? "#1a2a3a" : "#1e2736",
        border: `1px solid ${isDragOver ? "#C9A84C" : "#30373f"}`,
        cursor: "grab",
        opacity: 1,
      }}
    >
      {/* Name */}
      <div className="font-semibold text-sm leading-tight" style={{ color: "#e6edf3" }}>{sub.name}</div>

      {/* Phone */}
      {sub.phone && (
        <div className="text-xs font-bold" style={{ color: "#94a3b8" }}>{formatPhone(sub.phone)}</div>
      )}

      {/* Email */}
      {sub.email && (
        <a href={`mailto:${sub.email}`} onClick={e => e.stopPropagation()} className="text-xs hover:underline truncate" style={{ color: "#58a6ff" }}>{sub.email}</a>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => {
            const c = tagColor(tag);
            return <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>{tag}</span>;
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 mt-auto pt-1" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} className="flex-1 text-xs py-1 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e" }}>Edit</button>
        <button onClick={onDuplicate} className="flex-1 text-xs py-1 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: "#C9A84C" }}>Copy</button>
        <button onClick={onDelete} className="px-2 text-xs py-1 rounded-lg transition-all hover:opacity-80" style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444" }}>×</button>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function SubModal({
  title, initial, onSave, onClose,
}: {
  title: string;
  initial: { name: string; email: string; phone: string; divisionCode: string; divisionName: string; tags: string[] };
  onSave: (data: typeof initial) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function handleDivChange(code: string) {
    const div = ALL_DIVISIONS.find(d => d.code === code);
    if (div) setForm(f => ({ ...f, divisionCode: div.code, divisionName: div.name }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold mb-5" style={{ color: "#e6edf3" }}>{title}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Division</label>
            <select className="w-full rounded px-2 py-1.5 text-sm outline-none" style={{ ...INPUT, appearance: "none", cursor: "pointer" }}
              value={form.divisionCode} onChange={e => handleDivChange(e.target.value)}>
              {ALL_DIVISIONS.map(d => <option key={d.code} value={d.code}>{d.code.slice(0, 2)} – {d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Company / Contractor Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" placeholder="ABC Roofing Inc." autoFocus />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={INPUT} className="outline-none" placeholder="contact@abc.com" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={INPUT} className="outline-none" placeholder="(555) 000-0000" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Tags <span style={{ color: "#484f58" }}>(Enter or comma)</span></label>
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SubsDatabase({
  companyId, initialSubs, userEmail,
}: {
  companyId: string; initialSubs: Sub[]; userEmail?: string | null;
}) {
  const normalizedInit = initialSubs.map(s => {
    const { code, name } = normalizeDivision(s.divisionCode, s.divisionName);
    return { ...s, divisionCode: code, divisionName: name };
  });

  const [subs, setSubs] = useState<Sub[]>(normalizedInit);
  const [filterDiv, setFilterDiv] = useState("ALL");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; sub?: Sub } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingSheet, setImportingSheet] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverDiv, setDragOverDiv] = useState<string | null>(null);
  const [dragOverSubId, setDragOverSubId] = useState<string | null>(null);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSave(
    form: { name: string; email: string; phone: string; divisionCode: string; divisionName: string; tags: string[] },
    editId?: string
  ) {
    const notes = form.tags.length > 0 ? JSON.stringify(form.tags) : null;
    const body = { name: form.name, email: form.email || null, phone: form.phone || null, divisionCode: form.divisionCode, divisionName: form.divisionName, notes };
    if (editId) {
      const res = await fetch(`/api/${companyId}/subs/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = await res.json();
      setSubs(prev => prev.map(s => s.id === editId ? { ...s, ...updated } : s));
    } else {
      const res = await fetch(`/api/${companyId}/subs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const created = await res.json();
      setSubs(prev => [...prev, { ...created, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null }]);
    }
    setModal(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sub?")) return;
    await fetch(`/api/${companyId}/subs/${id}`, { method: "DELETE" });
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  async function handleDuplicate(sub: Sub) {
    const res = await fetch(`/api/${companyId}/subs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sub.name + " (copy)", email: sub.email, phone: sub.phone, divisionCode: sub.divisionCode, divisionName: sub.divisionName, notes: sub.notes }),
    });
    const created = await res.json();
    setSubs(prev => [...prev, { ...created, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null }]);
  }

  // ── Drag between divisions ──────────────────────────────────────────────────
  async function handleDropOnDivision(targetCode: string, targetName: string) {
    const id = dragIdRef.current;
    if (!id) return;
    const sub = subs.find(s => s.id === id);
    if (!sub || sub.divisionCode === targetCode) return;
    setSubs(prev => prev.map(s => s.id === id ? { ...s, divisionCode: targetCode, divisionName: targetName } : s));
    await fetch(`/api/${companyId}/subs/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sub.name, email: sub.email, phone: sub.phone, divisionCode: targetCode, divisionName: targetName, notes: sub.notes }),
    });
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImport(refresh = false) {
    setImporting(true);
    try {
      const res = await fetch(`/api/${companyId}/subs/import-from-bids${refresh ? "?refresh=1" : ""}`, { method: "POST" });
      const { imported, refreshed } = await res.json();
      await reloadSubs();
      const parts = [];
      if (imported > 0) parts.push(`${imported} new subs imported`);
      if (refreshed > 0) parts.push(`${refreshed} emails updated`);
      alert(parts.length > 0 ? parts.join(", ") + "." : "Nothing new to import.");
    } finally { setImporting(false); }
  }

  async function handleImportFromSheet() {
    setImportingSheet(true);
    try {
      const res = await fetch(`/api/${companyId}/subs/import-from-sheet`, { method: "POST" });
      const { imported, skipped } = await res.json();
      await reloadSubs();
      alert(imported > 0 ? `${imported} contractors imported from Google Sheet (${skipped} skipped/duplicates).` : `Nothing new to import (${skipped} already exist).`);
    } finally { setImportingSheet(false); }
  }

  async function handleClearAll() {
    if (!confirm(`Delete ALL ${subs.length} subs? This cannot be undone.\n\nAfter clearing, re-import from Sheet and Bids.`)) return;
    setClearing(true);
    try {
      await fetch(`/api/${companyId}/subs`, { method: "DELETE" });
      setSubs([]);
    } finally { setClearing(false); }
  }

  async function reloadSubs() {
    const fresh = await fetch(`/api/${companyId}/subs`);
    const data: Sub[] = await fresh.json();
    setSubs(data.map(s => {
      const { code, name } = normalizeDivision(s.divisionCode, s.divisionName);
      return { ...s, divisionCode: code, divisionName: name, email: s.email ?? null, phone: s.phone ?? null, notes: s.notes ?? null };
    }));
  }

  // ── Email helpers ───────────────────────────────────────────────────────────
  function copyEmails(code: string) {
    const emails = subs.filter(s => s.divisionCode === code && s.email).map(s => s.email!).join(", ");
    if (emails) navigator.clipboard.writeText(emails);
  }

  function sendEmail(code: string, divName: string) {
    const emails = subs.filter(s => s.divisionCode === code && s.email).map(s => s.email!);
    if (!emails.length) return;
    const to = userEmail ? encodeURIComponent(userEmail) : "";
    const bcc = encodeURIComponent(emails.join(","));
    const subject = encodeURIComponent(`Request for Quote – ${divName}`);
    window.open(`mailto:${to}?bcc=${bcc}&subject=${subject}`);
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const filtered = filterDiv === "ALL" ? subs : subs.filter(s => s.divisionCode === filterDiv);
  const grouped = new Map<string, { code: string; name: string; subs: Sub[] }>();
  for (const sub of filtered) {
    if (!grouped.has(sub.divisionCode)) grouped.set(sub.divisionCode, { code: sub.divisionCode, name: sub.divisionName, subs: [] });
    grouped.get(sub.divisionCode)!.subs.push(sub);
  }
  const groups = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
  const usedCodes = new Set(subs.map(s => s.divisionCode));

  const defaultDivision = ALL_DIVISIONS[0];
  const modalInitial = modal?.mode === "edit" && modal.sub
    ? { name: modal.sub.name, email: modal.sub.email ?? "", phone: modal.sub.phone ?? "", divisionCode: modal.sub.divisionCode, divisionName: modal.sub.divisionName, tags: parseTags(modal.sub.notes) }
    : { name: "", email: "", phone: "", divisionCode: defaultDivision.code, divisionName: defaultDivision.name, tags: [] };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Sub Database</h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>{subs.length} contractors · {usedCodes.size} divisions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => handleImport(true)} disabled={importing} className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "#1e2736", border: "1px solid #22c55e44", color: "#22c55e" }}>
            {importing ? "…" : "🔄 Refresh"}
          </button>
          <button onClick={() => handleImport(false)} disabled={importing} className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}>
            {importing ? "Importing…" : "⬇ From Bids"}
          </button>
          <button onClick={handleImportFromSheet} disabled={importingSheet} className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "#1e2736", border: "1px solid #a78bfa44", color: "#a78bfa" }}>
            {importingSheet ? "Importing…" : "📋 From Sheet"}
          </button>
          <button onClick={handleClearAll} disabled={clearing || subs.length === 0} className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-40"
            style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444" }}>
            {clearing ? "Clearing…" : "🗑 Clear All"}
          </button>
          <button onClick={() => setModal({ mode: "add" })} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "#C9A84C", color: "#0d1117" }}>
            + Add Sub
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilterDiv("ALL")} className="px-3 py-1 rounded-full text-xs font-medium"
          style={filterDiv === "ALL" ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}>
          All ({subs.length})
        </button>
        {ALL_DIVISIONS.filter(d => usedCodes.has(d.code)).map(d => (
          <button key={d.code} onClick={() => setFilterDiv(d.code)} className="px-3 py-1 rounded-full text-xs font-medium"
            style={filterDiv === d.code ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}>
            {d.code.slice(0, 2)} – {d.name} ({subs.filter(s => s.divisionCode === d.code).length})
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16" style={{ color: "#8b949e" }}>
          <p className="text-lg mb-2">No subs yet</p>
          <p className="text-sm">Import from Sheet or Bids, or add manually.</p>
        </div>
      )}

      {/* Division sections */}
      {groups.map(group => {
        const isDivDragOver = dragOverDiv === group.code;
        const emailCount = group.subs.filter(s => s.email).length;
        return (
          <div key={group.code} className="mb-8 rounded-xl overflow-hidden transition-all"
            style={{ border: `1px solid ${isDivDragOver ? "#C9A84C" : "#30373f"}` }}
            onDragOver={e => { e.preventDefault(); setDragOverDiv(group.code); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDiv(null); }}
            onDrop={e => { e.preventDefault(); setDragOverDiv(null); handleDropOnDivision(group.code, group.name); }}>

            {/* Division header */}
            <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{group.code}</span>
                <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{group.name}</span>
                <span className="text-xs" style={{ color: "#8b949e" }}>{group.subs.length} sub{group.subs.length !== 1 ? "s" : ""}</span>
              </div>
              {emailCount > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => copyEmails(group.code)} className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}>
                    Copy {emailCount} Email{emailCount !== 1 ? "s" : ""}
                  </button>
                  <button onClick={() => sendEmail(group.code, group.name)} className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "#0a1a0f", border: "1px solid #22c55e44", color: "#22c55e" }}>
                    ✉ Send Email
                  </button>
                </div>
              )}
            </div>

            {/* Card grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" style={{ background: isDivDragOver ? "#0d1a0d" : "#0d1117" }}>
              {group.subs.map(sub => (
                <SubCard
                  key={sub.id}
                  sub={sub}
                  isDragOver={dragOverSubId === sub.id}
                  onDragStart={() => { dragIdRef.current = sub.id; }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverSubId(sub.id); }}
                  onDrop={() => { setDragOverSubId(null); }}
                  onDragEnd={() => { dragIdRef.current = null; setDragOverSubId(null); setDragOverDiv(null); }}
                  onEdit={() => setModal({ mode: "edit", sub })}
                  onDelete={() => handleDelete(sub.id)}
                  onDuplicate={() => handleDuplicate(sub)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Add/Edit Modal */}
      {modal && (
        <SubModal
          title={modal.mode === "edit" ? "Edit Sub" : "Add Sub"}
          initial={modalInitial}
          onSave={form => handleSave(form, modal.sub?.id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
