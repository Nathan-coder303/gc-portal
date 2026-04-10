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
  notes: string | null;
  createdAt: string;
};

const ALL_DIVISIONS = STANDARD_TEMPLATE_DIVISIONS.map(d => ({ code: d.csiCode, name: d.name }));

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

function formatPhone(p: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

export default function SubsDatabase({ companyId, initialSubs }: { companyId: string; initialSubs: Sub[] }) {
  const [subs, setSubs] = useState<Sub[]>(initialSubs);
  const [filterDiv, setFilterDiv] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: "", email: "", phone: "", divisionCode: ALL_DIVISIONS[0].code, divisionName: ALL_DIVISIONS[0].name, notes: "" });

  function resetForm() {
    setForm({ name: "", email: "", phone: "", divisionCode: ALL_DIVISIONS[0].code, divisionName: ALL_DIVISIONS[0].name, notes: "" });
  }

  function openAdd() {
    resetForm();
    setEditId(null);
    setShowAdd(true);
  }

  function openEdit(sub: Sub) {
    setForm({ name: sub.name, email: sub.email ?? "", phone: sub.phone ?? "", divisionCode: sub.divisionCode, divisionName: sub.divisionName, notes: sub.notes ?? "" });
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
    try {
      if (editId) {
        const res = await fetch(`/api/${companyId}/subs/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const updated = await res.json();
        setSubs(prev => prev.map(s => s.id === editId ? { ...updated, email: updated.email ?? null, phone: updated.phone ?? null, notes: updated.notes ?? null } : s));
      } else {
        const res = await fetch(`/api/${companyId}/subs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const created = await res.json();
        setSubs(prev => [...prev, { ...created, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null }]);
      }
      setShowAdd(false);
      resetForm();
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sub?")) return;
    await fetch(`/api/${companyId}/subs/${id}`, { method: "DELETE" });
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  function copyEmails(divCode: string) {
    const emails = subs
      .filter(s => s.divisionCode === divCode && s.email)
      .map(s => s.email!)
      .join(", ");
    if (!emails) return;
    navigator.clipboard.writeText(emails);
  }

  const filtered = filterDiv === "ALL" ? subs : subs.filter(s => s.divisionCode === filterDiv);

  // Group by division
  const grouped = new Map<string, { code: string; name: string; subs: Sub[] }>();
  for (const sub of filtered) {
    if (!grouped.has(sub.divisionCode)) {
      grouped.set(sub.divisionCode, { code: sub.divisionCode, name: sub.divisionName, subs: [] });
    }
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
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "#C9A84C", color: "#0d1117" }}
        >
          + Add Sub
        </button>
      </div>

      {/* Division filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setFilterDiv("ALL")}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={filterDiv === "ALL" ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}
        >
          All ({subs.length})
        </button>
        {ALL_DIVISIONS.filter(d => usedDivCodes.has(d.code)).map(d => {
          const count = subs.filter(s => s.divisionCode === d.code).length;
          return (
            <button
              key={d.code}
              onClick={() => setFilterDiv(d.code)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={filterDiv === d.code ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}
            >
              {d.code.slice(0, 2)} – {d.name} ({count})
            </button>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-16" style={{ color: "#8b949e" }}>
          <p className="text-lg mb-2">No subs yet</p>
          <p className="text-sm">Add your first subcontractor to build your database.</p>
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
                <button
                  onClick={() => copyEmails(group.code)}
                  className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}
                  title="Copy all emails for this division"
                >
                  Copy {groupEmails} Email{groupEmails !== 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div>
              {group.subs.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#1a2030]"
                  style={idx < group.subs.length - 1 ? { borderBottom: "1px solid #21262d" } : undefined}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {sub.email && (
                        <a href={`mailto:${sub.email}`} className="text-xs hover:underline" style={{ color: "#58a6ff" }}>{sub.email}</a>
                      )}
                      {sub.phone && (
                        <span className="text-xs" style={{ color: "#8b949e" }}>{formatPhone(sub.phone)}</span>
                      )}
                      {sub.notes && (
                        <span className="text-xs italic" style={{ color: "#484f58" }}>{sub.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(sub)}
                      className="px-2 py-1 rounded text-xs transition-all hover:scale-105"
                      style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="px-2 py-1 rounded text-xs transition-all hover:scale-105"
                      style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444" }}
                    >
                      ×
                    </button>
                  </div>
                </div>
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
                <select
                  className="w-full rounded px-2 py-1.5 text-sm"
                  style={inputStyle}
                  value={form.divisionCode}
                  onChange={e => handleDivisionChange(e.target.value)}
                >
                  {ALL_DIVISIONS.map(d => (
                    <option key={d.code} value={d.code}>{d.code.slice(0, 2)} – {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Company / Contractor Name *</label>
                <input
                  type="text"
                  className="w-full rounded px-2 py-1.5 text-sm"
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ABC Roofing Inc."
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
                <input
                  type="email"
                  className="w-full rounded px-2 py-1.5 text-sm"
                  style={inputStyle}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="contact@abc.com"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Phone</label>
                <input
                  type="tel"
                  className="w-full rounded px-2 py-1.5 text-sm"
                  style={inputStyle}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Notes</label>
                <input
                  type="text"
                  className="w-full rounded px-2 py-1.5 text-sm"
                  style={inputStyle}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAdd(false); resetForm(); setEditId(null); }}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {saving ? "Saving…" : editId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
