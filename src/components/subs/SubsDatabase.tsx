"use client";

import { useState, useRef } from "react";
import { DIVISIONS } from "@/lib/divisions";

type Sub = {
  id: string;
  name: string;
  contactName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  divisionCode: string;
  divisionName: string;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
};

const ALL_DIVISIONS = [...DIVISIONS];

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
  sub, isDragOver, isSelected,
  usedDivisions,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onEdit, onDelete, onDuplicate, onMoveToDiv, onToggleSelect, onToggleFavorite,
}: {
  sub: Sub; isDragOver: boolean; isSelected: boolean;
  usedDivisions: { code: string; name: string }[];
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void; onDragEnd: () => void;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onMoveToDiv: (code: string, name: string) => void;
  onToggleSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const tags = parseTags(sub.notes);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const otherDivisions = usedDivisions.filter(d => d.code !== sub.divisionCode);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-xl flex flex-col gap-2 p-3 select-none transition-all relative"
      style={{
        background: isSelected ? "#1a2a3a" : isDragOver ? "#1a2a3a" : "#1e2736",
        border: `1px solid ${isSelected ? "#58a6ff" : isDragOver ? "#C9A84C" : "#30373f"}`,
        cursor: "grab",
      }}
    >
      {/* Star favorite */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        className="absolute top-2 left-2 text-base leading-none transition-all hover:scale-125"
        title={sub.isFavorite ? "Remove from favorites" : "Add to favorites"}
        style={{ color: sub.isFavorite ? "#f59e0b" : "#30373f" }}
      >
        ★
      </button>

      {/* Select checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect(); }}
        className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center transition-all"
        style={{
          background: isSelected ? "#58a6ff" : "transparent",
          border: `1px solid ${isSelected ? "#58a6ff" : "#30373f"}`,
        }}
      >
        {isSelected && <span className="text-[10px] font-bold" style={{ color: "#0d1117" }}>✓</span>}
      </button>

      {/* Company name */}
      <div className="font-semibold text-sm leading-tight px-5 truncate" style={{ color: "#e6edf3" }}>{sub.name}</div>

      {/* Contact name */}
      {sub.contactName && (
        <div className="text-xs truncate" style={{ color: "#8b949e" }}>👤 {sub.contactName}</div>
      )}

      {/* Phone */}
      {sub.phone && (
        <div className="text-xs font-bold" style={{ color: "#94a3b8" }}>{formatPhone(sub.phone)}</div>
      )}

      {/* Email — shrink font for long addresses, truncate as fallback */}
      {sub.email && (
        <a
          href={`mailto:${sub.email}`}
          onClick={e => e.stopPropagation()}
          title={sub.email}
          className="block w-full min-w-0 truncate hover:underline"
          style={{
            color: "#58a6ff",
            fontSize: sub.email.length > 35 ? "9px" : sub.email.length > 25 ? "10px" : "11px",
          }}
        >
          {sub.email}
        </a>
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
        {/* Edit icon */}
        <button
          onClick={onEdit}
          title="Edit"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#8b949e", fontSize: 14 }}
        >
          ✏️
        </button>
        {/* Duplicate icon */}
        <button
          onClick={onDuplicate}
          title="Duplicate"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
          style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: "#C9A84C", fontSize: 14 }}
        >
          ⧉
        </button>
        {/* Delete icon */}
        <button
          onClick={onDelete}
          title="Delete"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
          style={{ background: "#1a0a0a", border: "1px solid #ef444444", color: "#ef4444", fontSize: 14 }}
        >
          🗑
        </button>

        {/* Move to — text label, dropdown */}
        {otherDivisions.length > 0 && (
          <div className="relative flex-1">
            <button
              onClick={() => setShowMoveMenu(v => !v)}
              className="w-full h-8 px-2 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
              style={{ background: "#0a1a0f", border: "1px solid #22c55e44", color: "#22c55e" }}
            >
              Move to ▾
            </button>
            {showMoveMenu && (
              <div
                className="absolute bottom-9 left-0 z-50 rounded-xl shadow-xl min-w-[160px] overflow-y-auto"
                style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: 280 }}
              >
                {otherDivisions.map(d => (
                  <button
                    key={d.code}
                    onClick={() => { setShowMoveMenu(false); onMoveToDiv(d.code, d.name); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#1e2736] transition-colors"
                    style={{ color: "#e6edf3" }}
                  >
                    <span className="font-mono" style={{ color: "#C9A84C" }}>{d.code.slice(0, 2)}</span>
                    {" – "}{d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function SubModal({
  title, initial, onSave, onClose,
}: {
  title: string;
  initial: { name: string; contactName: string; address: string; email: string; phone: string; divisionCode: string; divisionName: string; tags: string[] };
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
      <div className="rounded-2xl p-6 w-full max-w-md overflow-y-auto max-h-[90vh]" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={e => e.stopPropagation()}>
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
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Contact Name</label>
            <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} style={INPUT} className="outline-none" placeholder="John Smith" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Address <span style={{ color: "#484f58" }}>(FL default)</span></label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={INPUT} className="outline-none" placeholder="123 Main St, Miami, FL 33101" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={INPUT} className="outline-none" placeholder="contact@abc.com" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={INPUT} className="outline-none" placeholder="(305) 000-0000" />
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

// ─── Bid Email Compose Modal ───────────────────────────────────────────────────
const SIGNATURE = `Best regards,

Mike Baruh
Founder/CEO · MIBH Construction
CGC 1527069 | CCC 1336817
📱 305.746.7307  ·  📧 mike@mibhconstruction.com
📍 2950 N 28 Terr, Hollywood, FL 33020  ·  🌐 mibhconstruction.com`;

function buildDefaultBody(divName: string) {
  return `Good morning,

We are inviting you to submit a bid for the upcoming project outlined below.

Project:
Location:
Scope of Work (${divName}):
Bid Due Date:

Please review the attached plans and specifications. If you have any questions, feel free to reach out directly.

${SIGNATURE}`;
}

function BidEmailModal({
  emails, divName, companyId, onClose,
}: {
  emails: string[];
  divName: string;
  companyId: string;
  onClose: () => void;
}) {
  const [bcc, setBcc] = useState(emails.join(", "));
  const [subject, setSubject] = useState("Invitation to Bid (ITB) \u2013 Request for Proposal");
  const [body, setBody] = useState(() => buildDefaultBody(divName));
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    setAttachments(prev => [
      ...prev,
      ...arr.filter(f => !prev.some(p => p.name === f.name && p.size === f.size)),
    ]);
  }

  async function handleSend() {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("to", "mikebaruh@gmail.com");
      if (bcc.trim()) fd.append("bcc", bcc);
      fd.append("subject", subject);
      fd.append("bodyText", body);
      attachments.forEach(f => fd.append("files", f));

      const res = await fetch(`/api/${companyId}/subs/send-email`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { alert("Send failed: " + data.error); return; }
      setSent(true);
      setTimeout(onClose, 1800);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col relative"
        style={{
          background: "#1c1f26",
          border: dragOver ? "2px dashed #58a6ff" : "1px solid #30373f",
          maxHeight: "92vh",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "#30373f" }} />
        </div>

        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ background: "#252830", borderBottom: "1px solid #30373f" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>New Message</span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
            >
              {emails.length} recipient{emails.length !== 1 ? "s" : ""} · {divName}
            </span>
          </div>
          <button onClick={onClose} className="text-xl leading-none hover:opacity-70" style={{ color: "#8b949e" }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* From */}
          <div className="flex items-center px-5 py-2.5" style={{ borderBottom: "1px solid #21262d" }}>
            <span className="text-xs w-14 shrink-0 font-medium" style={{ color: "#8b949e" }}>From</span>
            <span className="text-sm font-medium" style={{ color: "#58a6ff" }}>mikebaruh@gmail.com</span>
          </div>

          {/* BCC */}
          <div className="flex items-start px-5 py-2.5" style={{ borderBottom: "1px solid #21262d" }}>
            <span className="text-xs w-14 shrink-0 font-medium pt-1" style={{ color: "#8b949e" }}>BCC</span>
            <textarea
              value={bcc}
              onChange={e => setBcc(e.target.value)}
              rows={Math.min(4, Math.ceil(emails.length / 2) + 1)}
              className="flex-1 text-xs outline-none resize-none bg-transparent leading-relaxed"
              style={{ color: "#e6edf3" }}
            />
          </div>

          {/* Subject */}
          <div className="flex items-center px-5 py-2.5" style={{ borderBottom: "1px solid #21262d" }}>
            <span className="text-xs w-14 shrink-0 font-medium" style={{ color: "#8b949e" }}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent font-medium"
              style={{ color: "#e6edf3" }}
            />
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={16}
              className="w-full text-sm outline-none resize-none bg-transparent"
              style={{ color: "#c9d1d9", lineHeight: 1.65 }}
            />
          </div>

          {/* Drag-over hint */}
          {dragOver && (
            <div className="mx-5 mb-4 py-6 rounded-xl flex items-center justify-center"
              style={{ border: "2px dashed #58a6ff", background: "#0d1829" }}>
              <span className="text-sm font-semibold" style={{ color: "#58a6ff" }}>📎 Drop files to attach</span>
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="px-5 pb-4 flex flex-wrap gap-2">
              {attachments.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: "#1e2736", border: "1px solid #30373f" }}>
                  <span>📎</span>
                  <span style={{ color: "#e6edf3" }}>{f.name}</span>
                  <span style={{ color: "#484f58" }}>({(f.size / 1024).toFixed(0)} KB)</span>
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="ml-0.5 hover:opacity-70"
                    style={{ color: "#ef4444" }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-wrap"
          style={{ borderTop: "1px solid #30373f", background: "#161b22" }}
        >
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-60 transition-all"
            style={{ background: sent ? "#22c55e" : "#1a73e8", color: "#fff", minWidth: 120 }}
          >
            {sent ? "✓ Sent!" : sending ? "Sending…" : `Send  (${emails.length})`}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
          >
            📎 Attach files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && addFiles(e.target.files)}
          />

          {attachments.length === 0 && (
            <span className="text-xs" style={{ color: "#484f58" }}>or drag & drop here</span>
          )}

          <div className="flex-1" />

          <button onClick={onClose} className="text-xs hover:opacity-70" style={{ color: "#8b949e" }}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SubsDatabase({
  companyId, initialSubs,
}: {
  companyId: string; initialSubs: Sub[];
}) {
  const normalizedInit = initialSubs.map(s => {
    const { code, name } = normalizeDivision(s.divisionCode, s.divisionName);
    return { ...s, divisionCode: code, divisionName: name, isFavorite: (s as { isFavorite?: boolean }).isFavorite ?? false };
  });

  const [subs, setSubs] = useState<Sub[]>(normalizedInit);
  const [filterDiv, setFilterDiv] = useState("ALL");
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; sub?: Sub; prefillDiv?: { code: string; name: string } } | null>(null);
  const [emailModal, setEmailModal] = useState<{ emails: string[]; divName: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingSheet, setImportingSheet] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverDiv, setDragOverDiv] = useState<string | null>(null);
  const [dragOverSubId, setDragOverSubId] = useState<string | null>(null);
  // Multi-select: keyed by divisionCode → Set of sub IDs
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());

  // ── Selection helpers ──────────────────────────────────────────────────────
  function toggleSelect(divCode: string, subId: string) {
    setSelected(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(divCode) ?? []);
      if (set.has(subId)) set.delete(subId); else set.add(subId);
      next.set(divCode, set);
      return next;
    });
  }

  function toggleSelectAll(divCode: string, subIds: string[]) {
    setSelected(prev => {
      const next = new Map(prev);
      const cur = next.get(divCode) ?? new Set<string>();
      const allSelected = subIds.every(id => cur.has(id));
      next.set(divCode, allSelected ? new Set() : new Set(subIds));
      return next;
    });
  }

  function clearSelection(divCode: string) {
    setSelected(prev => { const next = new Map(prev); next.set(divCode, new Set()); return next; });
  }

  async function moveSelectedToDivision(fromCode: string, targetCode: string, targetName: string) {
    const ids = Array.from(selected.get(fromCode) ?? []);
    if (!ids.length) return;
    setSubs(prev => prev.map(s =>
      ids.includes(s.id) ? { ...s, divisionCode: targetCode, divisionName: targetName } : s
    ));
    clearSelection(fromCode);
    await Promise.all(ids.map(id => {
      const sub = subs.find(s => s.id === id)!;
      return fetch(`/api/${companyId}/subs/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sub.name, email: sub.email, phone: sub.phone, divisionCode: targetCode, divisionName: targetName, notes: sub.notes }),
      });
    }));
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSave(
    form: { name: string; contactName: string; address: string; email: string; phone: string; divisionCode: string; divisionName: string; tags: string[] },
    editId?: string
  ) {
    const notes = form.tags.length > 0 ? JSON.stringify(form.tags) : null;
    const body = { name: form.name, contactName: form.contactName || null, address: form.address || null, email: form.email || null, phone: form.phone || null, divisionCode: form.divisionCode, divisionName: form.divisionName, notes };
    if (editId) {
      const res = await fetch(`/api/${companyId}/subs/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { alert(`Failed to save sub: ${res.status}`); return; }
      const updated = await res.json();
      const { code, name: divName } = normalizeDivision(updated.divisionCode, updated.divisionName);
      setSubs(prev => prev.map(s => s.id === editId ? { ...s, ...updated, divisionCode: code, divisionName: divName } : s));
    } else {
      const res = await fetch(`/api/${companyId}/subs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { alert(`Failed to save sub: ${res.status}`); return; }
      const created = await res.json();
      const { code, name: divName } = normalizeDivision(created.divisionCode, created.divisionName);
      setSubs(prev => [...prev, { ...created, divisionCode: code, divisionName: divName, contactName: created.contactName ?? null, address: created.address ?? null, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null, isFavorite: created.isFavorite ?? false }]);
    }
    setModal(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/${companyId}/subs/${id}`, { method: "DELETE" });
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  async function handleToggleFavorite(id: string) {
    const cur = subs.find(s => s.id === id);
    if (!cur) return;
    const next = !cur.isFavorite;
    setSubs(prev => prev.map(s => s.id === id ? { ...s, isFavorite: next } : s));
    await fetch(`/api/${companyId}/subs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: next }),
    });
  }

  async function handleDuplicate(sub: Sub) {
    const res = await fetch(`/api/${companyId}/subs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sub.name + " (copy)", email: sub.email, phone: sub.phone, divisionCode: sub.divisionCode, divisionName: sub.divisionName, notes: sub.notes }),
    });
    const created = await res.json();
    setSubs(prev => [...prev, { ...created, email: created.email ?? null, phone: created.phone ?? null, notes: created.notes ?? null }]);
  }

  // ── Drag between divisions ────────────────────────────────────────────────
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

  // ── Import ────────────────────────────────────────────────────────────────
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
      return { ...s, divisionCode: code, divisionName: name, contactName: s.contactName ?? null, address: s.address ?? null, email: s.email ?? null, phone: s.phone ?? null, notes: s.notes ?? null, isFavorite: s.isFavorite ?? false };
    }));
  }

  // ── Email helpers ─────────────────────────────────────────────────────────
  function copyEmails(code: string) {
    const emails = subs.filter(s => s.divisionCode === code && s.email).map(s => s.email!).join(", ");
    if (emails) navigator.clipboard.writeText(emails);
  }

  function openEmailModal(code: string, divName: string) {
    const emails = subs.filter(s => s.divisionCode === code && s.email).map(s => s.email!);
    if (!emails.length) return;
    setEmailModal({ emails, divName });
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const searched = q
    ? subs.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q)
      )
    : subs;
  const base = favOnly ? searched.filter(s => s.isFavorite) : searched;
  const filtered = filterDiv === "ALL" ? base : base.filter(s => s.divisionCode === filterDiv);
  const grouped = new Map<string, { code: string; name: string; subs: Sub[] }>();
  for (const sub of filtered) {
    if (!grouped.has(sub.divisionCode)) grouped.set(sub.divisionCode, { code: sub.divisionCode, name: sub.divisionName, subs: [] });
    grouped.get(sub.divisionCode)!.subs.push(sub);
  }
  const groups = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
  const usedCodes = new Set(subs.map(s => s.divisionCode));
  const usedDivisions = ALL_DIVISIONS.filter(d => usedCodes.has(d.code));

  const defaultDivision = ALL_DIVISIONS[0];
  const modalInitial = modal?.mode === "edit" && modal.sub
    ? { name: modal.sub.name, contactName: modal.sub.contactName ?? "", address: modal.sub.address ?? "", email: modal.sub.email ?? "", phone: modal.sub.phone ?? "", divisionCode: modal.sub.divisionCode, divisionName: modal.sub.divisionName, tags: parseTags(modal.sub.notes) }
    : { name: "", contactName: "", address: "", email: "", phone: "", divisionCode: modal?.prefillDiv?.code ?? defaultDivision.code, divisionName: modal?.prefillDiv?.name ?? defaultDivision.name, tags: [] };

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

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, contact, email, or phone…"
          className="w-full text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none"
          style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "#484f58" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => { setFilterDiv("ALL"); setFavOnly(false); }} className="px-3 py-1 rounded-full text-xs font-medium"
          style={filterDiv === "ALL" && !favOnly ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}>
          All ({subs.length})
        </button>
        <button onClick={() => { setFavOnly(v => !v); setFilterDiv("ALL"); }} className="px-3 py-1 rounded-full text-xs font-medium"
          style={favOnly ? { background: "#f59e0b", color: "#0d1117" } : { background: "transparent", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
          ★ Favorites ({subs.filter(s => s.isFavorite).length})
        </button>
        {ALL_DIVISIONS.filter(d => usedCodes.has(d.code)).map(d => (
          <button key={d.code} onClick={() => { setFilterDiv(d.code); setFavOnly(false); }} className="px-3 py-1 rounded-full text-xs font-medium"
            style={filterDiv === d.code && !favOnly ? { background: "#C9A84C", color: "#0d1117" } : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }}>
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
        const groupSubIds = group.subs.map(s => s.id);
        const selSet = selected.get(group.code) ?? new Set<string>();
        const selCount = selSet.size;
        const allSelected = groupSubIds.length > 0 && groupSubIds.every(id => selSet.has(id));

        return (
          <div key={group.code} className="mb-8 rounded-xl transition-all"
            style={{ border: `1px solid ${isDivDragOver ? "#C9A84C" : "#30373f"}` }}
            onDragOver={e => { e.preventDefault(); setDragOverDiv(group.code); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDiv(null); }}
            onDrop={e => { e.preventDefault(); setDragOverDiv(null); handleDropOnDivision(group.code, group.name); }}>

            {/* Division header */}
            <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2 rounded-t-xl" style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <div className="flex items-center gap-2">
                {/* Select all checkbox */}
                <button
                  onClick={() => toggleSelectAll(group.code, groupSubIds)}
                  className="w-5 h-5 rounded flex items-center justify-center transition-all"
                  style={{ background: allSelected ? "#58a6ff" : "transparent", border: `1px solid ${allSelected ? "#58a6ff" : "#30373f"}` }}
                  title="Select all"
                >
                  {allSelected && <span className="text-[10px] font-bold" style={{ color: "#0d1117" }}>✓</span>}
                </button>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{group.code}</span>
                <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{group.name}</span>
                <span className="text-xs" style={{ color: "#8b949e" }}>{group.subs.length} sub{group.subs.length !== 1 ? "s" : ""}</span>
                {selCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#58a6ff", border: "1px solid #58a6ff44" }}>
                    {selCount} selected
                  </span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                {/* Add sub to this division */}
                <button
                  onClick={() => setModal({ mode: "add", prefillDiv: { code: group.code, name: group.name } })}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-base font-bold transition-all hover:scale-110"
                  style={{ background: "#C9A84C22", border: "1px solid #C9A84C66", color: "#C9A84C" }}
                  title={`Add sub to ${group.name}`}
                >
                  +
                </button>

                {/* Move selected */}
                {selCount > 0 && (
                  <MoveSelectedDropdown
                    label={`Move ${selCount} →`}
                    divisions={usedDivisions.filter(d => d.code !== group.code)}
                    onMove={(code, name) => moveSelectedToDivision(group.code, code, name)}
                  />
                )}

                {emailCount > 0 && (
                  <>
                    <button onClick={() => copyEmails(group.code)} className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}>
                      Copy {emailCount} Email{emailCount !== 1 ? "s" : ""}
                    </button>
                    <button onClick={() => openEmailModal(group.code, group.name)} className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: "#0a1a0f", border: "1px solid #22c55e44", color: "#22c55e" }}>
                      ✉ Send Email
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Card grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 rounded-b-xl" style={{ background: isDivDragOver ? "#0d1a0d" : "#0d1117" }}>
              {group.subs.map(sub => (
                <SubCard
                  key={sub.id}
                  sub={sub}
                  isDragOver={dragOverSubId === sub.id}
                  isSelected={selSet.has(sub.id)}
                  usedDivisions={usedDivisions}
                  onDragStart={() => { dragIdRef.current = sub.id; }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverSubId(sub.id); }}
                  onDrop={() => { setDragOverSubId(null); }}
                  onDragEnd={() => { dragIdRef.current = null; setDragOverSubId(null); setDragOverDiv(null); }}
                  onEdit={() => setModal({ mode: "edit", sub })}
                  onDelete={() => handleDelete(sub.id)}
                  onDuplicate={() => handleDuplicate(sub)}
                  onMoveToDiv={(code, name) => {
                    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, divisionCode: code, divisionName: name } : s));
                    fetch(`/api/${companyId}/subs/${sub.id}`, {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: sub.name, email: sub.email, phone: sub.phone, divisionCode: code, divisionName: name, notes: sub.notes }),
                    });
                  }}
                  onToggleSelect={() => toggleSelect(group.code, sub.id)}
                  onToggleFavorite={() => handleToggleFavorite(sub.id)}
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

      {/* Bid Email Compose Modal */}
      {emailModal && (
        <BidEmailModal
          emails={emailModal.emails}
          divName={emailModal.divName}
          companyId={companyId}
          onClose={() => setEmailModal(null)}
        />
      )}
    </div>
  );
}

// ─── Move Selected Dropdown ────────────────────────────────────────────────────
function MoveSelectedDropdown({
  label, divisions, onMove,
}: {
  label: string;
  divisions: { code: string; name: string }[];
  onMove: (code: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1 rounded text-xs font-semibold transition-all hover:scale-105"
        style={{ background: "#1e2736", border: "1px solid #58a6ff44", color: "#58a6ff" }}
      >
        {label} ▾
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-xl min-w-[170px]"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          {divisions.map(d => (
            <button
              key={d.code}
              onClick={() => { setOpen(false); onMove(d.code, d.name); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#1e2736] transition-colors"
              style={{ color: "#e6edf3" }}
            >
              <span className="font-mono" style={{ color: "#C9A84C" }}>{d.code.slice(0, 2)}</span>
              {" – "}{d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
