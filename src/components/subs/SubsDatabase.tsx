"use client";

import { useState } from "react";
import { STANDARD_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

type Sub = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  divisionCode: string;
  divisionName: string;
  notes: string | null; // stored as JSON array of tag strings
  createdAt: string;
};

const ALL_DIVISIONS = STANDARD_TEMPLATE_DIVISIONS.map(d => ({ code: d.csiCode, name: d.name }));

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

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

// ─── SubCard: individual row with inline phone + tags ────────────────────────
function SubCard({ sub, idx, total, companyId, onEdit, onDelete, onPhoneUpdate }: {
  sub: Sub; idx: number; total: number; companyId: string;
  onEdit: () => void; onDelete: () => void; onPhoneUpdate: (phone: string | null) => void;
}) {
  const [phoneInput, setPhoneInput] = useState(sub.phone ?? "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const tags = parseTags(sub.notes);

  async function savePhone() {
    const val = phoneInput.trim() || null;
    if (val === sub.phone) return;
    setPhoneSaving(true);
    await fetch(`/api/${companyId}/subs/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sub.name, email: sub.email, phone: val, divisionCode: sub.divisionCode, divisionName: sub.divisionName, notes: sub.notes }),
    });
    onPhoneUpdate(val);
    setPhoneSaving(false);
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1a2030]"
      style={idx < total - 1 ? { borderBottom: "1px solid #21262d" } : undefined}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{sub.name}</span>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {sub.email && (
            <a href={`mailto:${sub.email}`} className="text-xs hover:underline" style={{ color: "#58a6ff" }}>{sub.email}</a>
          )}
          <div className="flex items-center gap-1">
            <input
              type="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              onBlur={savePhone}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder={formatPhone(sub.phone) || "Add phone…"}
              className="text-xs rounded px-1.5 py-0.5"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: phoneInput ? "#e6edf3" : "#484f58", width: 118 }}
            />
            {phoneSaving && <span className="text-[10px]" style={{ color: "#8b949e" }}>…</span>}
          </div>
          {tags.map(tag => {
            const c = tagColor(tag);
            return (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>{tag}</span>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} className="px-2 py-1 rounded text-xs" style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}>Edit</button>
        <button onClick={onDelete} className="px-2 py-1 rounded text-xs" style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444" }}>×</button>
      </div>
    </div>
  );
}

// ─── TagInput: chip-style tag editor ─────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
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
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? "Add tags (e.g. millwork, cabinets)…" : ""}
        className="text-xs outline-none flex-1 min-w-[120px] bg-transparent"
        style={{ color: "#e6edf3" }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SubsDatabase({ companyId, initialSubs }: { companyId: string; initialSubs: Sub[] }) {
  const [subs, setSubs] = useState<Sub[]>(initialSubs);
  const [filterDiv, setFilterDiv] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  type FormState = { name: string; email: string; phone: string; divisionCode: string; divisionName: string; tags: string[] };
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", divisionCode: ALL_DIVISIONS[0].code, divisionName: ALL_DIVISIONS[0].name, tags: [] });

  function resetForm() {
    setForm({ name: "", email: "", phone: "", divisionCode: ALL_DIVISIONS[0].code, divisionName: ALL_DIVISIONS[0].name, tags: [] });
  }

  function openAdd() { resetForm(); setEditId(null); setShowAdd(true); }

  function openEdit(sub: Sub) {
    setForm({ name: sub.name, email: sub.email ?? "", phone: sub.phone ?? "", divisionCode: sub.divisionCode, divisionName: sub.divisionName, tags: parseTags(sub.notes) });
    setEditId(sub.id);
    setShowAdd(true);
  }

  function handleDivisionChange(code: string) {
    const div = ALL_DIVISIONS.find(d => d.code === code);
    if (div) setForm(f => ({ ...f, divisionCode: div.code, divisionName: div.name }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const notes = form.tags.length > 0 ? JSON.stringify(form.tags) : null;
    const body = { name: form.name, email: form.email || null, phone: form.phone || null, divisionCode: form.divisionCode, divisionName: form.divisionName, notes };
    try {
      if (editId) {
        const res = await fetch(`/api/${companyId}/subs/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const updated = await res.json();
        setSubs(prev => prev.map(s => s.id === editId ? { ...s, ...updated, email: updated.email ?? null, phone: updated.phone ?? null, notes: updated.notes ?? null } : s));
      } else {
        const res = await fetch(`/api/${companyId}/subs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const created = await res.json();
        setSubs(prev => [...prev, { ...created, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null }]);
      }
      setShowAdd(false); resetForm(); setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sub?")) return;
    await fetch(`/api/${companyId}/subs/${id}`, { method: "DELETE" });
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  async function handleImport(refresh = false) {
    setImporting(true);
    try {
      const url = `/api/${companyId}/subs/import-from-bids${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url, { method: "POST" });
      const { imported, refreshed } = await res.json();
      const fresh = await fetch(`/api/${companyId}/subs`);
      const data: Sub[] = await fresh.json();
      setSubs(data.map(s => ({ ...s, email: s.email ?? null, phone: s.phone ?? null, notes: s.notes ?? null })));
      const parts = [];
      if (imported > 0) parts.push(`${imported} new sub${imported !== 1 ? "s" : ""} imported`);
      if (refreshed > 0) parts.push(`${refreshed} email${refreshed !== 1 ? "s" : ""} updated`);
      alert(parts.length > 0 ? parts.join(", ") + "." : "Nothing new to import.");
    } finally {
      setImporting(false);
    }
  }

  function copyEmails(divCode: string) {
    const emails = subs.filter(s => s.divisionCode === divCode && s.email).map(s => s.email!).join(", ");
    if (emails) navigator.clipboard.writeText(emails);
  }

  const filtered = filterDiv === "ALL" ? subs : subs.filter(s => s.divisionCode === filterDiv);
  const grouped = new Map<string, { code: string; name: string; subs: Sub[] }>();
  for (const sub of filtered) {
    if (!grouped.has(sub.divisionCode)) grouped.set(sub.divisionCode, { code: sub.divisionCode, name: sub.divisionName, subs: [] });
    grouped.get(sub.divisionCode)!.subs.push(sub);
  }
  const groups = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
  const usedDivCodes = new Set(subs.map(s => s.divisionCode));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Sub Database</h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>{subs.length} contractors across {usedDivCodes.size} divisions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleImport(true)}
            disabled={importing}
            className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "#1e2736", border: "1px solid #22c55e44", color: "#22c55e" }}
          >
            {importing ? "…" : "🔄 Refresh Emails"}
          </button>
          <button
            onClick={() => handleImport(false)}
            disabled={importing}
            className="px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}
          >
            {importing ? "Importing…" : "⬇ Import from Bids"}
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            + Add Sub
          </button>
        </div>
      </div>

      {/* Division filter pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setFilterDiv("ALL")}
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={filterDiv === "ALL" ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}
        >
          All ({subs.length})
        </button>
        {ALL_DIVISIONS.filter(d => usedDivCodes.has(d.code)).map(d => {
          const count = subs.filter(s => s.divisionCode === d.code).length;
          return (
            <button key={d.code} onClick={() => setFilterDiv(d.code)} className="px-3 py-1 rounded-full text-xs font-medium"
              style={filterDiv === d.code ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}>
              {d.code.slice(0, 2)} – {d.name} ({count})
            </button>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16" style={{ color: "#8b949e" }}>
          <p className="text-lg mb-2">No subs yet</p>
          <p className="text-sm">Click "Import from Bids" to pull your existing contractors, or add one manually.</p>
        </div>
      )}

      {groups.map(group => {
        const groupEmails = group.subs.filter(s => s.email).length;
        return (
          <div key={group.code} className="mb-6 rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <div>
                <span className="text-xs font-mono font-semibold mr-2" style={{ color: "#C9A84C" }}>{group.code}</span>
                <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{group.name}</span>
                <span className="text-xs ml-2" style={{ color: "#8b949e" }}>{group.subs.length} subs</span>
              </div>
              {groupEmails > 0 && (
                <button onClick={() => copyEmails(group.code)}
                  className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}>
                  Copy {groupEmails} Email{groupEmails !== 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div>
              {group.subs.map((sub, idx) => (
                <SubCard
                  key={sub.id}
                  sub={sub}
                  idx={idx}
                  total={group.subs.length}
                  companyId={companyId}
                  onEdit={() => openEdit(sub)}
                  onDelete={() => handleDelete(sub.id)}
                  onPhoneUpdate={(phone) => setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, phone } : s))}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <h2 className="text-lg font-bold mb-5" style={{ color: "#e6edf3" }}>{editId ? "Edit Sub" : "Add Sub"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Division</label>
                <select className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.divisionCode} onChange={e => handleDivisionChange(e.target.value)}>
                  {ALL_DIVISIONS.map(d => <option key={d.code} value={d.code}>{d.code.slice(0, 2)} – {d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Company / Contractor Name *</label>
                <input type="text" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ABC Roofing Inc." />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
                <input type="email" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@abc.com" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Phone</label>
                <input type="tel" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Tags <span style={{ color: "#484f58" }}>(press Enter or comma to add)</span></label>
                <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAdd(false); resetForm(); setEditId(null); }} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>
                {saving ? "Saving…" : editId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
