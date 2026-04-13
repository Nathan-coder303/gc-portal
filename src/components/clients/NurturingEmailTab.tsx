"use client";

import { useState, useEffect, useCallback } from "react";
import { NURTURING_TEMPLATES, FULL_SIGNATURE } from "@/lib/nurturing/templates";

// ─── Types ────────────────────────────────────────────────────────────────────
type NTemplate = {
  id: string;
  type: string;
  step: number;
  name: string;
  subject: string;
  body: string;
};

type NSection = {
  type: string;
  label: string;
  emoji: string;
};

const STORAGE_KEY = "nurturing_templates_v2";
const SECTIONS_KEY = "nurturing_sections_v2";

const DEFAULT_SECTIONS: NSection[] = [
  { type: "roof", label: "Roofing", emoji: "🏠" },
  { type: "addition", label: "Home Addition", emoji: "🏗" },
];

const GOLD = "#C9A84C";
const INPUT_STYLE: React.CSSProperties = {
  background: "#1e2736",
  border: "1px solid #30373f",
  color: "#e6edf3",
  WebkitTextFillColor: "#e6edf3",
  colorScheme: "dark",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

// ─── Seed from static templates ───────────────────────────────────────────────
function seedTemplates(): NTemplate[] {
  return NURTURING_TEMPLATES.map(t => ({
    id: t.id,
    type: t.type,
    step: t.step,
    name: t.name,
    subject: t.subject,
    body: t.body,
  }));
}

function loadTemplates(): NTemplate[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return seedTemplates();
}

function saveTemplates(tpls: NTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tpls));
}

function loadSections(): NSection[] {
  try {
    const s = localStorage.getItem(SECTIONS_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return DEFAULT_SECTIONS;
}

function saveSections(secs: NSection[]) {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(secs));
}

function fillBody(body: string, clientName: string) {
  return body.replace(/\[Client Name\]/g, clientName);
}

function newId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NurturingEmailTab({
  companyId, clientId, clientName, clientEmail,
}: {
  companyId: string; clientId: string; clientName: string; clientEmail: string | null;
}) {
  const [templates, setTemplates] = useState<NTemplate[]>([]);
  const [sections, setSections] = useState<NSection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [toEmail, setToEmail] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"" | "sent" | "error">("");
  const [sendError, setSendError] = useState("");
  const [managing, setManaging] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [saveAsName, setSaveAsName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionEmoji, setNewSectionEmoji] = useState("📋");
  const [showAddSection, setShowAddSection] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingVal, setRenamingVal] = useState("");

  useEffect(() => {
    setTemplates(loadTemplates());
    setSections(loadSections());
  }, []);

  const persist = useCallback((tpls: NTemplate[]) => {
    setTemplates(tpls);
    saveTemplates(tpls);
  }, []);

  const persistSections = useCallback((secs: NSection[]) => {
    setSections(secs);
    saveSections(secs);
  }, []);

  // ── Select a template ────────────────────────────────────────────────────────
  function handleSelect(id: string) {
    setSelectedId(id);
    setSendStatus("");
    setSaveAsName("");
    setShowSaveAs(false);
    if (!id) { setSubject(""); setBody(""); return; }
    const t = templates.find(t => t.id === id);
    if (!t) return;
    setSubject(fillBody(t.subject, clientName));
    setBody(fillBody(t.body, clientName));
  }

  // ── Save changes to selected template ───────────────────────────────────────
  function handleSave() {
    if (!selectedId) return;
    const updated = templates.map(t =>
      t.id === selectedId
        ? { ...t, subject: subject.replace(new RegExp(clientName, "g"), "[Client Name]"), body: body.replace(new RegExp(clientName, "g"), "[Client Name]") }
        : t
    );
    persist(updated);
    setSavedMsg("Saved!");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  // ── Save as new ──────────────────────────────────────────────────────────────
  function handleSaveAsNew() {
    if (!saveAsName.trim()) return;
    const base = templates.find(t => t.id === selectedId);
    if (!base) return;
    const sectionTemplates = templates.filter(t => t.type === base.type);
    const newStep = Math.max(...sectionTemplates.map(t => t.step), 0) + 1;
    const newTpl: NTemplate = {
      id: newId(),
      type: base.type,
      step: newStep,
      name: saveAsName.trim(),
      subject: subject.replace(new RegExp(clientName, "g"), "[Client Name]"),
      body: body.replace(new RegExp(clientName, "g"), "[Client Name]"),
    };
    const updated = [...templates, newTpl];
    persist(updated);
    setSelectedId(newTpl.id);
    setSaveAsName("");
    setShowSaveAs(false);
    setSavedMsg("Saved as new!");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  // ── Duplicate ────────────────────────────────────────────────────────────────
  function handleDuplicate(id: string) {
    const base = templates.find(t => t.id === id);
    if (!base) return;
    const sectionTemplates = templates.filter(t => t.type === base.type);
    const newStep = Math.max(...sectionTemplates.map(t => t.step), 0) + 1;
    const copy: NTemplate = { ...base, id: newId(), step: newStep, name: base.name + " (copy)" };
    persist([...templates, copy]);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    if (!confirm("Delete this email template?")) return;
    const updated = templates.filter(t => t.id !== id);
    persist(updated);
    if (selectedId === id) { setSelectedId(""); setSubject(""); setBody(""); }
  }

  // ── Rename ───────────────────────────────────────────────────────────────────
  function commitRename() {
    if (!renamingId || !renamingVal.trim()) { setRenamingId(null); return; }
    persist(templates.map(t => t.id === renamingId ? { ...t, name: renamingVal.trim() } : t));
    setRenamingId(null);
    if (selectedId === renamingId) { /* subject/body unchanged */ }
  }

  // ── Add section ──────────────────────────────────────────────────────────────
  function handleAddSection() {
    if (!newSectionName.trim()) return;
    const type = newSectionName.trim().toLowerCase().replace(/\s+/g, "-");
    if (sections.find(s => s.type === type)) { alert("Section already exists"); return; }
    persistSections([...sections, { type, label: newSectionName.trim(), emoji: newSectionEmoji }]);
    setNewSectionName("");
    setNewSectionEmoji("📋");
    setShowAddSection(false);
  }

  // ── Delete section ───────────────────────────────────────────────────────────
  function handleDeleteSection(type: string) {
    const count = templates.filter(t => t.type === type).length;
    if (!confirm(`Delete "${type}" section and all ${count} emails?`)) return;
    persistSections(sections.filter(s => s.type !== type));
    persist(templates.filter(t => t.type !== type));
    if (templates.find(t => t.id === selectedId)?.type === type) {
      setSelectedId(""); setSubject(""); setBody("");
    }
  }

  // ── Add email to section ──────────────────────────────────────────────────────
  function handleAddEmail(type: string) {
    const sectionTpls = templates.filter(t => t.type === type);
    const step = Math.max(...sectionTpls.map(t => t.step), 0) + 1;
    const newTpl: NTemplate = {
      id: newId(),
      type,
      step,
      name: `New Email ${step}`,
      subject: `Update from MIBH Construction`,
      body: `Hi [Client Name],\n\nWe wanted to update you on your project.\n\n${FULL_SIGNATURE}`,
    };
    persist([...templates, newTpl]);
    // Auto-select and open for editing
    setSelectedId(newTpl.id);
    setSubject(fillBody(newTpl.subject, clientName));
    setBody(fillBody(newTpl.body, clientName));
    setManaging(false);
    setSendStatus("");
    // Start renaming right away
    setRenamingId(newTpl.id);
    setRenamingVal(newTpl.name);
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!subject || !body || !toEmail) return;
    setSending(true);
    setSendStatus("");
    setSendError("");
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/send-nurturing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, toEmail }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      setSendStatus("sent");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
      setSendStatus("error");
    } finally { setSending(false); }
  }

  // ── Reset templates to defaults ───────────────────────────────────────────────
  function handleReset() {
    if (!confirm("Reset ALL templates to defaults? This removes any custom edits and sections.")) return;
    const defaults = seedTemplates();
    persist(defaults);
    persistSections(DEFAULT_SECTIONS);
    setSelectedId(""); setSubject(""); setBody("");
  }

  const selected = templates.find(t => t.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Nurturing Emails</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Select, edit & send milestone emails to {clientName}.</p>
        </div>
        <button
          onClick={() => setManaging(v => !v)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: managing ? "#C9A84C22" : "#1e2736", border: `1px solid ${managing ? GOLD : "#30373f"}`, color: managing ? GOLD : "#8b949e" }}
        >
          {managing ? "✕ Close" : "⚙ Manage"}
        </button>
      </div>

      {/* ── Management Panel ── */}
      {managing && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          {sections.map(sec => {
            const secTpls = templates.filter(t => t.type === sec.type).sort((a, b) => a.step - b.step);
            const isDefault = DEFAULT_SECTIONS.some(d => d.type === sec.type);
            return (
              <div key={sec.type} style={{ borderBottom: "1px solid #30373f" }}>
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#161b22" }}>
                  <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{sec.emoji} {sec.label}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAddEmail(sec.type)} className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{ background: "#C9A84C22", color: GOLD, border: "1px solid #C9A84C44" }}>+ Email</button>
                    {!isDefault && (
                      <button onClick={() => handleDeleteSection(sec.type)} className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{ background: "#2d1a1a", color: "#ef4444", border: "1px solid #ef444433" }}>Delete</button>
                    )}
                  </div>
                </div>
                {/* Template rows */}
                {secTpls.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#0d1117", borderTop: "1px solid #1e2736" }}>
                    <span className="text-[11px] w-5 shrink-0 text-center" style={{ color: "#484f58" }}>{t.step}</span>
                    {renamingId === t.id ? (
                      <input
                        value={renamingVal}
                        onChange={e => setRenamingVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={commitRename}
                        autoFocus
                        className="flex-1 text-xs rounded px-2 py-1 outline-none"
                        style={{ background: "#1e2736", border: "1px solid #C9A84C", color: "#e6edf3" }}
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs cursor-pointer hover:text-white"
                        style={{ color: selectedId === t.id ? GOLD : "#e6edf3" }}
                        onClick={() => { handleSelect(t.id); setManaging(false); }}
                      >
                        {t.name}
                      </span>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button title="Rename" onClick={() => { setRenamingId(t.id); setRenamingVal(t.name); }} className="text-[11px] px-1.5 py-0.5 rounded hover:opacity-80" style={{ background: "#1e2736", color: "#8b949e" }}>✏</button>
                      <button title="Duplicate" onClick={() => handleDuplicate(t.id)} className="text-[11px] px-1.5 py-0.5 rounded hover:opacity-80" style={{ background: "#1e2736", color: GOLD }}>⧉</button>
                      <button title="Delete" onClick={() => handleDelete(t.id)} className="text-[11px] px-1.5 py-0.5 rounded hover:opacity-80" style={{ background: "#2d1a1a", color: "#ef4444" }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add Section */}
          <div className="p-4 space-y-2" style={{ background: "#0d1117" }}>
            {!showAddSection ? (
              <div className="flex justify-between items-center">
                <button onClick={() => setShowAddSection(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}>
                  + Add Section
                </button>
                <button onClick={handleReset} className="text-[10px] px-2 py-1 rounded" style={{ color: "#484f58" }}>Reset to defaults</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={newSectionEmoji}
                  onChange={e => setNewSectionEmoji(e.target.value)}
                  className="w-10 text-center rounded px-1 py-1 outline-none text-sm"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  maxLength={2}
                />
                <input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") setShowAddSection(false); }}
                  placeholder="Section name (e.g. Kitchen, Commercial)"
                  autoFocus
                  className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
                  style={{ background: "#1e2736", border: "1px solid #58a6ff", color: "#e6edf3" }}
                />
                <button onClick={handleAddSection} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: "#58a6ff", color: "#0d1117" }}>Add</button>
                <button onClick={() => setShowAddSection(false)} className="px-2 py-1 rounded text-xs" style={{ background: "#1e2736", color: "#8b949e" }}>✕</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Template Selector ── */}
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: "#8b949e" }}>Select Template</label>
        <select
          value={selectedId}
          onChange={e => handleSelect(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", colorScheme: "dark" }}
        >
          <option value="">— Choose a nurturing email —</option>
          {sections.map(sec => {
            const secTpls = templates.filter(t => t.type === sec.type).sort((a, b) => a.step - b.step);
            if (secTpls.length === 0) return null;
            return (
              <optgroup key={sec.type} label={`${sec.emoji} ${sec.label}`}>
                {secTpls.map(t => (
                  <option key={t.id} value={t.id}>{t.step}. {t.name}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* ── Compose Area ── */}
      {selected && (
        <>
          {/* Section badge + template name */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const sec = sections.find(s => s.type === selected.type);
              return (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
                  {sec?.emoji ?? "📋"} {sec?.label ?? selected.type} — Step {selected.step}
                </span>
              );
            })()}
            <span className="text-xs font-semibold" style={{ color: GOLD }}>{selected.name}</span>
          </div>

          {/* To */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>To</label>
            <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} style={INPUT_STYLE} placeholder="client@email.com" />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} style={INPUT_STYLE} />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none"
              style={{ ...INPUT_STYLE, resize: "vertical" }}
            />
          </div>

          {/* Status */}
          {sendStatus === "sent" && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #166534", color: "#4ade80" }}>
              ✓ Email sent to {toEmail}
            </div>
          )}
          {sendStatus === "error" && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#2d1b1b", border: "1px solid #6b2a2a", color: "#f87171" }}>
              {sendError || "Failed to send. Check Gmail OAuth."}
            </div>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={handleSend}
              disabled={sending || !toEmail || !subject || !body}
              className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              {sending ? "Sending…" : "✉ Send"}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "#1e2736", border: "1px solid #22c55e44", color: "#22c55e" }}
            >
              {savedMsg || "💾 Save"}
            </button>
            <button
              onClick={() => { setShowSaveAs(v => !v); setSaveAsName(selected.name + " (copy)"); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}
            >
              Save as New
            </button>
            <button
              onClick={() => handleDuplicate(selected.id)}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: GOLD }}
            >
              ⧉ Copy
            </button>
            <button
              onClick={() => handleDelete(selected.id)}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444" }}
            >
              🗑
            </button>
          </div>

          {/* Save as New inline input */}
          {showSaveAs && (
            <div className="flex gap-2">
              <input
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveAsNew(); if (e.key === "Escape") setShowSaveAs(false); }}
                placeholder="New template name…"
                autoFocus
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#1e2736", border: "1px solid #58a6ff", color: "#e6edf3", WebkitTextFillColor: "#e6edf3" }}
              />
              <button onClick={handleSaveAsNew} disabled={!saveAsName.trim()} className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: "#58a6ff", color: "#0d1117" }}>Save</button>
              <button onClick={() => setShowSaveAs(false)} className="px-3 py-2 rounded-xl text-sm" style={{ background: "#1e2736", color: "#8b949e" }}>✕</button>
            </div>
          )}

          {!clientEmail && (
            <p className="text-xs" style={{ color: "#f87171" }}>No email on file for this client — enter one above</p>
          )}
        </>
      )}
    </div>
  );
}
