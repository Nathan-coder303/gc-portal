"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { FormulaInput } from "@/components/FormulaInput";
import { STANDARD_TEMPLATE_DIVISIONS, BATHROOM_TEMPLATE_DIVISIONS, KITCHEN_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

// Flat lookup from all templates
const _ALL_DIVS = [...STANDARD_TEMPLATE_DIVISIONS, ...BATHROOM_TEMPLATE_DIVISIONS, ...KITCHEN_TEMPLATE_DIVISIONS];

// "26" → "Electrical"
const CSI_DIVISION_LOOKUP: Record<string, string> = {};
for (const d of _ALL_DIVS) {
  const p = d.csiCode.replace(/\s/g, "").substring(0, 2);
  if (!CSI_DIVISION_LOOKUP[p]) CSI_DIVISION_LOOKUP[p] = d.name;
}

// "262726" → "Wiring Devices"
const CSI_ITEM_LOOKUP: Record<string, string> = {};
for (const d of _ALL_DIVS) {
  for (const item of d.items) {
    const k = item.csiCode.replace(/\s/g, "");
    if (!CSI_ITEM_LOOKUP[k]) CSI_ITEM_LOOKUP[k] = item.name;
  }
}

function formatCSI(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.match(/.{1,2}/g)?.join(" ") ?? "";
}
import SendChangeOrderEmailButton from "@/components/clients/SendChangeOrderEmailButton";

const CSI_PREFIXES = ["02","03","04","05","06","07","08","09","10","11","12","13","14","21","22","23","26","27","28","31","32","33"];

const GOLD = "#C9A84C";
const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

type COItem = {
  id?: string;
  csiCode: string;
  divisionName: string;
  name: string;
  description: string;
  qty: string;
  unit: string;
  unitCost: string;
  markupPct: string;
};

type ChangeOrder = {
  id: string;
  title: string;
  orderNumber: string | null;
  status: string;
  notes: string | null;
  signatureData: string | null;
  signedAt: string | null;
  signedByName: string | null;
  createdAt: string;
  items: {
    id: string;
    csiCode: string | null;
    divisionName: string;
    name: string;
    description: string | null;
    qty: string | null;
    unit: string | null;
    unitCost: string | null;
    markupPct: string | null;
    sortOrder: number;
  }[];
  payments?: { id: string; amount: number; method: string; paidDate: string; notes: string | null }[];
  attachments?: string | null; // JSON array
  timeDelay?: boolean;
  daysDelayed?: number | null;
  billingStatus?: string | null;
  approverIp?: string | null;
};

type COAttachment = { id: string; name: string; url: string; size: number; mimeType: string };

function parseCOAttachments(raw: string | null | undefined): COAttachment[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as COAttachment[]; } catch { return []; }
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function calcTotal(items: COItem[]): number {
  return items.reduce((sum, it) => {
    const qty = parseFloat(it.qty) || 0;
    const cost = parseFloat(it.unitCost) || 0;
    const markup = parseFloat(it.markupPct) || 0;
    return sum + qty * cost * (1 + markup / 100);
  }, 0);
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: "#1e2736", color: "#8b949e" },
  SENT:     { bg: "#1e3a5f", color: "#60a5fa" },
  APPROVED: { bg: "#0d2318", color: "#22c55e" },
  REJECTED: { bg: "#2d1212", color: "#f85149" },
};

// ── Division picker ─────────────────────────────────────────────────────────

function DivisionPicker({ onAdd }: { onAdd: (items: COItem[]) => void }) {
  const [selectedDiv, setSelectedDiv] = useState("");

  function handleAdd() {
    const div = STANDARD_TEMPLATE_DIVISIONS.find(d => d.csiCode === selectedDiv);
    if (!div) return;
    const newItems: COItem[] = div.items.map(it => ({
      csiCode: it.csiCode,
      divisionName: div.name,
      name: it.name,
      description: "",
      qty: "",
      unit: "LS",
      unitCost: "",
      markupPct: "15",
    }));
    onAdd(newItems);
    setSelectedDiv("");
  }

  return (
    <div className="flex gap-2 items-end flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Add division</label>
        <select
          value={selectedDiv}
          onChange={e => setSelectedDiv(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={inputStyle}
        >
          <option value="">— pick a CSI division —</option>
          {STANDARD_TEMPLATE_DIVISIONS.map(d => (
            <option key={d.csiCode} value={d.csiCode}>
              {d.csiCode} · {d.name}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleAdd}
        disabled={!selectedDiv}
        className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
        style={{ background: GOLD, color: "#0d1117" }}
      >
        Pre-fill items
      </button>
    </div>
  );
}

// ── Item row editor ─────────────────────────────────────────────────────────

function ItemRow({
  item,
  index,
  coId,
  onChange,
  onDelete,
}: {
  item: COItem;
  index: number;
  coId?: string;
  onChange: (idx: number, field: keyof COItem, value: string) => void;
  onDelete: (idx: number) => void;
}) {
  const descRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.description]);

  const qty = parseFloat(item.qty) || 0;
  const cost = parseFloat(item.unitCost) || 0;
  const markup = parseFloat(item.markupPct) || 0;
  const lineTotal = qty * cost * (1 + markup / 100);

  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ background: index % 2 === 0 ? "#0d1117" : "#10161e", border: "1px solid #21262d" }}
    >
      <div className="grid grid-cols-[1fr_120px] gap-2 mb-2">
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Division</label>
          <select
            value={STANDARD_TEMPLATE_DIVISIONS.find(d => d.name === item.divisionName)?.csiCode ?? ""}
            onChange={e => {
              const div = STANDARD_TEMPLATE_DIVISIONS.find(d => d.csiCode === e.target.value);
              if (div) {
                onChange(index, "divisionName", div.name);
                if (!item.csiCode) onChange(index, "csiCode", div.csiCode);
              } else {
                onChange(index, "divisionName", "Custom");
                onChange(index, "csiCode", "");
              }
            }}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
          >
            <option value="">Custom</option>
            {STANDARD_TEMPLATE_DIVISIONS.map(d => (
              <option key={d.csiCode} value={d.csiCode}>{d.csiCode} · {d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>CSI Code</label>
          <input
            value={item.csiCode}
            onChange={e => onChange(index, "csiCode", e.target.value)}
            className="w-full rounded px-2 py-1 text-xs"
            style={inputStyle}
            placeholder="e.g. 07 51 00"
          />
        </div>
      </div>
      <div className="flex items-start gap-2 mb-2">
        <input
          value={item.name}
          onChange={e => onChange(index, "name", e.target.value)}
          className="flex-1 rounded px-2 py-1 text-sm"
          style={inputStyle}
          placeholder="Item name"
        />
        <button
          onClick={() => onDelete(index)}
          className="w-7 h-7 rounded flex items-center justify-center shrink-0"
          style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
        >
          ×
        </button>
      </div>
      <textarea
        ref={descRef}
        value={item.description}
        onChange={e => onChange(index, "description", e.target.value)}
        rows={1}
        className="w-full rounded px-2 py-1 text-xs mb-2"
        style={{ ...inputStyle, color: "#8b949e", resize: "none", overflow: "hidden", lineHeight: "1.5" }}
        placeholder="Description (optional)"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Qty</label>
          <FormulaInput
            storageKey={item.id ? `co:${item.id}:qty` : coId ? `co:${coId}:item:${index}:qty` : undefined}
            value={item.qty}
            onChange={v => onChange(index, "qty", String(v))}
            className="w-full rounded px-2 py-1 text-sm"
            style={inputStyle}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Unit</label>
          <input
            value={item.unit}
            onChange={e => onChange(index, "unit", e.target.value)}
            className="w-full rounded px-2 py-1 text-sm"
            style={inputStyle}
            placeholder="LS"
          />
        </div>
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Unit Cost ($)</label>
          <FormulaInput
            storageKey={item.id ? `co:${item.id}:unitCost` : coId ? `co:${coId}:item:${index}:unitCost` : undefined}
            value={item.unitCost}
            onChange={v => onChange(index, "unitCost", String(v))}
            className="w-full rounded px-2 py-1 text-sm"
            style={inputStyle}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Markup %</label>
          <div className="flex items-center gap-2">
            <FormulaInput
              storageKey={item.id ? `co:${item.id}:markup` : coId ? `co:${coId}:item:${index}:markup` : undefined}
              value={item.markupPct}
              onChange={v => onChange(index, "markupPct", String(v))}
              className="w-full rounded px-2 py-1 text-sm"
              style={inputStyle}
              placeholder="15"
            />
            {lineTotal > 0 && (
              <span className="text-xs shrink-0 font-semibold" style={{ color: GOLD }}>${fmt(lineTotal)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Change Order editor modal ────────────────────────────────────────────────

// ── Reusable attachments zone for change orders ─────────────────────────────
function COAttachmentsZone({
  companyId, clientId, changeOrderId, initial, onChange,
}: {
  companyId: string;
  clientId: string;
  changeOrderId: string;
  initial: COAttachment[];
  onChange?: (next: COAttachment[]) => void;
}) {
  const [attachments, setAttachments] = useState<COAttachment[]>(initial);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function notify(next: COAttachment[]) {
    setAttachments(next);
    onChange?.(next);
  }

  async function uploadOne(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${changeOrderId}/attachments`, {
        method: "POST", body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const a = await res.json() as COAttachment;
      notify([...attachments, a]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      await uploadOne(f);
    }
  }

  async function removeOne(id: string) {
    if (!confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${changeOrderId}/attachments?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) notify(attachments.filter(a => a.id !== id));
  }

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    const res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${changeOrderId}/attachments?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      notify(attachments.map(a => a.id === id ? { ...a, name } : a));
    }
    setRenamingId(null);
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(a => {
            const isImg = a.mimeType.startsWith("image/");
            const proxyHref = `/api/co-attachment/${changeOrderId}/${a.id}`;
            const isRenaming = renamingId === a.id;
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                <span className="text-base shrink-0">{isImg ? "🖼" : "📎"}</span>
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(a.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); saveRename(a.id); }
                      else if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="flex-1 text-xs rounded px-2 py-1 outline-none"
                    style={{ background: "#1e2736", border: `1px solid ${GOLD}66`, color: "#e6edf3" }}
                  />
                ) : (
                  <a href={proxyHref} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: GOLD }}>{a.name}</p>
                    <p className="text-[10px]" style={{ color: "#8b949e" }}>{fmtFileSize(a.size)}</p>
                  </a>
                )}
                {!isRenaming && (
                  <button onClick={() => { setRenamingId(a.id); setRenameValue(a.name); }} className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: GOLD, background: `${GOLD}11` }} title="Rename">
                    ✎
                  </button>
                )}
                <button onClick={() => removeOne(a.id)} className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: "#f87171", background: "#2d1010" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl px-3 py-3 text-center cursor-pointer transition-colors"
        style={{
          background: dragOver ? `${GOLD}11` : "#0d1117",
          border: `1px dashed ${dragOver ? GOLD : "#30373f"}`,
        }}
      >
        <p className="text-xs font-semibold" style={{ color: dragOver ? GOLD : "#8b949e" }}>
          {uploading ? "Uploading…" : dragOver ? "Drop to attach" : "+ Attach PDF / photo / file (or drag & drop)"}
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          accept="application/pdf,image/*,.doc,.docx,.txt,.heic"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {err && <p className="text-[11px]" style={{ color: "#f87171" }}>{err}</p>}
    </div>
  );
}

// ── Pending attachments zone (used by the editor when no CO id exists yet) ──
function PendingAttachmentsZone({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    setFiles([...files, ...Array.from(list)]);
  }
  function removeAt(idx: number) {
    setFiles(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
              <span className="text-base shrink-0">{f.type.startsWith("image/") ? "🖼" : "📎"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: GOLD }}>{f.name}</p>
                <p className="text-[10px]" style={{ color: "#8b949e" }}>
                  {fmtFileSize(f.size)} · uploads on save
                </p>
              </div>
              <button onClick={() => removeAt(i)} className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: "#f87171", background: "#2d1010" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl px-3 py-3 text-center cursor-pointer transition-colors"
        style={{
          background: dragOver ? `${GOLD}11` : "#0d1117",
          border: `1px dashed ${dragOver ? GOLD : "#30373f"}`,
        }}
      >
        <p className="text-xs font-semibold" style={{ color: dragOver ? GOLD : "#8b949e" }}>
          {dragOver ? "Drop to queue" : "+ Attach PDF / photo / file (or drag & drop)"}
        </p>
        <p className="text-[10px] mt-1" style={{ color: "#484f58" }}>Files upload when you save the change order.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="application/pdf,image/*,.doc,.docx,.txt,.heic"
          onChange={e => { add(e.target.files); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}

function ChangeOrderEditor({
  companyId,
  clientId,
  initial,
  defaultOrderNumber,
  onSave,
  onClose,
}: {
  companyId: string;
  clientId: string;
  initial: ChangeOrder | null;
  defaultOrderNumber?: string;
  onSave: (order: ChangeOrder) => void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? defaultOrderNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [timeDelay, setTimeDelay] = useState<boolean>(initial?.timeDelay ?? false);
  const [daysDelayed, setDaysDelayed] = useState<string>(initial?.daysDelayed != null ? String(initial.daysDelayed) : "");
  const [billingStatus, setBillingStatus] = useState<string>(initial?.billingStatus ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const [items, setItems] = useState<COItem[]>(
    initial?.items.map(it => ({
      id: it.id,
      csiCode: it.csiCode ?? "",
      divisionName: it.divisionName,
      name: it.name,
      description: it.description ?? "",
      qty: it.qty != null ? String(it.qty) : "",
      unit: it.unit ?? "LS",
      unitCost: it.unitCost != null ? String(it.unitCost) : "",
      markupPct: it.markupPct != null ? String(it.markupPct) : "15",
    })) ?? []
  );

  function handleAddDivisionItems(newItems: COItem[]) {
    setItems(prev => [...prev, ...newItems]);
  }

  function handleAddBlankItem() {
    setItems(prev => [...prev, {
      csiCode: "",
      divisionName: "Custom",
      name: "",
      description: "",
      qty: "",
      unit: "LS",
      unitCost: "",
      markupPct: "15",
    }]);
  }

  function handleChange(idx: number, field: keyof COItem, value: string) {
    if (field === "csiCode") {
      const formatted = formatCSI(value);
      const digits = formatted.replace(/\s/g, "");
      const divPrefix = digits.substring(0, 2);
      setItems(prev => prev.map((it, i) => {
        if (i !== idx) return it;
        const newDiv = divPrefix && CSI_DIVISION_LOOKUP[divPrefix] ? CSI_DIVISION_LOOKUP[divPrefix] : it.divisionName;
        const lookedUp = digits.length >= 4 ? CSI_ITEM_LOOKUP[digits] : undefined;
        const newName = lookedUp && !it.name ? lookedUp : it.name;
        return { ...it, csiCode: formatted, divisionName: newDiv, name: newName };
      }));
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function handleDelete(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setError("");
    startTransition(async () => {
      const payload = {
        title: title.trim(),
        orderNumber: orderNumber || null,
        notes: notes || null,
        timeDelay,
        daysDelayed: daysDelayed.trim() ? Number(daysDelayed) : null,
        billingStatus: billingStatus.trim() || null,
        items: items.map((it, idx) => ({
          csiCode: it.csiCode || null,
          divisionName: it.divisionName,
          name: it.name,
          description: it.description || null,
          qty: it.qty ? parseFloat(it.qty) : null,
          unit: it.unit || null,
          unitCost: it.unitCost ? parseFloat(it.unitCost) : null,
          markupPct: it.markupPct ? parseFloat(it.markupPct) : null,
          sortOrder: idx,
        })),
      };

      let res: Response;
      async function flushPendingAttachments(coId: string) {
        if (pendingFiles.length === 0) return;
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("file", file);
          try {
            await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${coId}/attachments`, {
              method: "POST", body: fd,
            });
          } catch { /* swallow individual file failures so the CO still saves */ }
        }
        setPendingFiles([]);
      }

      if (initial) {
        res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${initial.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) { setError("Failed to save"); return; }
      const saved = await res.json();
      await flushPendingAttachments(saved.id);
      onSave(saved);
    });
  }

  const total = calcTotal(items);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl p-6 mt-8 mb-8"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>
            {initial ? "Edit Change Order" : "New Change Order"}
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: "#8b949e" }}>✕</button>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              placeholder="e.g. Kitchen scope change"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>CO # (optional)</label>
            <input
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              placeholder="CO-001"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ ...inputStyle, resize: "none", overflow: "hidden" }}
              placeholder="Reason for change order…"
            />
          </div>

          {/* Time delay + days */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Time Delay</label>
            <div className="flex gap-2">
              {([
                { v: false, l: "No" },
                { v: true, l: "Yes" },
              ] as { v: boolean; l: string }[]).map(opt => (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => setTimeDelay(opt.v)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={timeDelay === opt.v
                    ? { background: GOLD, color: "#0d1117" }
                    : { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Days Delayed</label>
            <input
              type="number"
              min={0}
              value={daysDelayed}
              onChange={e => setDaysDelayed(e.target.value)}
              disabled={!timeDelay}
              className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              style={inputStyle}
              placeholder={timeDelay ? "e.g. 10" : "—"}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Billing Status</label>
            <div className="flex gap-2 flex-wrap">
              {["Unbilled", "Unbilled/Approved", "Billed", "Paid"].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBillingStatus(prev => prev === s ? "" : s)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={billingStatus === s
                    ? { background: GOLD, color: "#0d1117" }
                    : { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Attachments — works on new CO too: files are queued in pendingFiles
            and uploaded after the CO is created on first save. */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Attachments</label>
          {initial ? (
            <COAttachmentsZone
              companyId={companyId}
              clientId={clientId}
              changeOrderId={initial.id}
              initial={parseCOAttachments(initial.attachments)}
            />
          ) : (
            <PendingAttachmentsZone files={pendingFiles} setFiles={setPendingFiles} />
          )}
        </div>

        {/* Division picker */}
        <div className="rounded-xl p-3 mb-4" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <DivisionPicker onAdd={handleAddDivisionItems} />
        </div>

        {/* Items */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
              Line Items ({items.length})
            </span>
            {total > 0 && (
              <span className="text-sm font-bold" style={{ color: GOLD }}>Total: ${fmt(total)}</span>
            )}
          </div>

          {items.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: "#484f58" }}>
              Pick a division above or add a custom item
            </p>
          )}

          {items.map((item, idx) => (
            <ItemRow key={idx} item={item} index={idx} coId={initial?.id} onChange={handleChange} onDelete={handleDelete} />
          ))}

          <button
            onClick={handleAddBlankItem}
            className="w-full mt-1 py-2 rounded-lg text-sm"
            style={{ border: "1px dashed #30373f", color: "#8b949e" }}
          >
            + Add custom item
          </button>
        </div>

        {error && <p className="text-sm mb-3" style={{ color: "#f85149" }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            {isPending ? "Saving…" : initial ? "Save Changes" : "Create Change Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF options modal ────────────────────────────────────────────────────────

function ChangeOrderPdfModal({
  companyId,
  clientId,
  changeOrderId,
  orderNumber,
  orderTitle,
  clientName,
  onClose,
}: {
  companyId: string;
  clientId: string;
  changeOrderId: string;
  orderNumber: string | null;
  orderTitle: string;
  clientName: string;
  onClose: () => void;
}) {
  function loadOpts() {
    try {
      const raw = localStorage.getItem(`co-pdf-opts-${clientId}`);
      if (raw) return JSON.parse(raw) as { divSummary: boolean; breaks: string[] };
    } catch { /* ignore */ }
    return null;
  }

  const [includeDivisionSummary, setIncludeDivisionSummary] = useState<boolean>(() => loadOpts()?.divSummary ?? false);
  const [forcedBreakCsiPrefixes, setForcedBreakCsiPrefixes] = useState<string[]>(() => loadOpts()?.breaks ?? []);

  useEffect(() => {
    localStorage.setItem(`co-pdf-opts-${clientId}`, JSON.stringify({ divSummary: includeDivisionSummary, breaks: forcedBreakCsiPrefixes }));
  }, [clientId, includeDivisionSummary, forcedBreakCsiPrefixes]);

  function buildUrl(preview: boolean) {
    const p = new URLSearchParams();
    if (includeDivisionSummary) p.set("divSummary", "1");
    if (forcedBreakCsiPrefixes.length) p.set("forcedBreakCsi", forcedBreakCsiPrefixes.join(","));
    if (preview) p.set("preview", "1");
    const qs = p.toString();
    return `/api/${companyId}/clients/${clientId}/change-orders/${changeOrderId}/pdf${qs ? `?${qs}` : ""}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 mt-16 mb-8 space-y-5"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>PDF Options</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
              {orderNumber ? `${orderNumber} — ` : ""}{orderTitle} · {clientName}
            </p>
          </div>
          <button onClick={onClose} className="text-xl" style={{ color: "#8b949e" }}>✕</button>
        </div>

        {/* Division summary */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Include Division Summary Page?</p>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: true, icon: "📊", label: "Yes", desc: "Add a summary with division totals" }, { v: false, icon: "⊘", label: "No", desc: "Skip summary page" }].map(o => (
              <button key={String(o.v)} onClick={() => setIncludeDivisionSummary(o.v)}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `2px solid ${includeDivisionSummary === o.v ? GOLD : "#30373f"}`, background: includeDivisionSummary === o.v ? "#1e2a12" : "#1e2736", outline: "none" }}>
                <div className="text-2xl mb-1">{o.icon}</div>
                <div className="text-xs font-semibold" style={{ color: includeDivisionSummary === o.v ? GOLD : "#e6edf3" }}>{o.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Force page breaks */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Force New Page Before</p>
          <div className="flex flex-wrap gap-2">
            {CSI_PREFIXES.map(prefix => {
              const on = forcedBreakCsiPrefixes.includes(prefix);
              return (
                <button key={prefix}
                  onClick={() => setForcedBreakCsiPrefixes(prev => on ? prev.filter(p => p !== prefix) : [...prev, prefix])}
                  className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                  style={{ background: on ? GOLD : "#1e2736", color: on ? "#0d1117" : "#8b949e", border: `1px solid ${on ? GOLD : "#30373f"}` }}>
                  Div {prefix}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <a
            href={buildUrl(true)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
          >
            Preview
          </a>
          <a
            href={buildUrl(false)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl text-sm font-bold"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            ↓ Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Mobile CO Detail View ────────────────────────────────────────────────────

function CODetailModal({
  order,
  companyId,
  clientId,
  clientName,
  canEdit,
  onClose,
  onEdit,
  onSignatureSaved,
}: {
  order: ChangeOrder;
  companyId: string;
  clientId: string;
  clientName: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSignatureSaved: (updated: ChangeOrder) => void;
}) {
  const [tab, setTab] = useState<"details" | "preview">("details");
  const [collectingSig, setCollectingSig] = useState(false);
  const [sigHasDrawn, setSigHasDrawn] = useState(false);
  const [sigSubmitting, setSigSubmitting] = useState(false);
  const [sigName, setSigName] = useState("");
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const sigLastPos = useRef<{ x: number; y: number } | null>(null);

  const total = order.items.reduce((s, it) => {
    const q = parseFloat(it.qty ?? "0") || 0;
    const c = parseFloat(it.unitCost ?? "0") || 0;
    const m = parseFloat(it.markupPct ?? "0") || 0;
    return s + q * c * (1 + m / 100);
  }, 0);

  const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.DRAFT;

  function getSigPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
    }
    return { x: ((e as MouseEvent).clientX - r.left) * sx, y: ((e as MouseEvent).clientY - r.top) * sy };
  }
  function sigStart(e: React.MouseEvent | React.TouchEvent) {
    const c = sigCanvasRef.current; if (!c) return;
    sigDrawing.current = true;
    sigLastPos.current = getSigPos(e.nativeEvent as MouseEvent | TouchEvent, c);
    e.preventDefault();
  }
  function sigMove(e: React.MouseEvent | React.TouchEvent) {
    if (!sigDrawing.current) return;
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const pos = getSigPos(e.nativeEvent as MouseEvent | TouchEvent, c);
    if (sigLastPos.current) {
      ctx.beginPath(); ctx.moveTo(sigLastPos.current.x, sigLastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke();
    }
    sigLastPos.current = pos; setSigHasDrawn(true); e.preventDefault();
  }
  function sigStop() { sigDrawing.current = false; sigLastPos.current = null; }
  function clearSig() {
    sigCanvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 160);
    setSigHasDrawn(false);
  }

  async function saveSig() {
    const c = sigCanvasRef.current;
    if (!c || !sigHasDrawn) return;
    setSigSubmitting(true);
    const data = c.toDataURL("image/png");
    const res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureData: data, signedByName: sigName.trim() || null }),
    });
    setSigSubmitting(false);
    if (!res.ok) return;
    const updated = await res.json();
    onSignatureSaved({
      ...order,
      signatureData: updated.signatureData,
      signedAt: updated.signedAt,
      signedByName: updated.signedByName,
    });
    setCollectingSig(false);
  }

  const detailRows: [string, string][] = [
    ["Change Order #", order.orderNumber ?? "—"],
    ["Date", new Date(order.createdAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })],
    ["Subject", order.title],
    ["Customer", clientName],
    ["Time Delay", order.timeDelay ? "Yes" : "No"],
    ...(order.timeDelay && order.daysDelayed != null ? [["Days Delayed", String(order.daysDelayed)] as [string, string]] : []),
    ["Billing Status", order.billingStatus ?? (order.status === "APPROVED" ? "Unbilled/Approved" : "—")],
    ...(order.signedByName ? [["Approved By", order.signedByName] as [string, string]] : []),
    ...(order.signedAt
      ? [["Online Approval", `Accepted: ${new Date(order.signedAt).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}${order.approverIp ? `\n${order.approverIp}` : ""}`] as [string, string]]
      : []),
    ["Status", order.status],
  ];

  const coAttachments = parseCOAttachments(order.attachments);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0d1117" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "#1e2736", color: "#8b949e" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="flex-1 text-center font-semibold text-sm" style={{ color: "#e6edf3" }}>
          {order.orderNumber ?? "Change Order"}
        </span>
        {canEdit && (
          <button onClick={onEdit} className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "#1e2736", color: GOLD }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
        <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: sc.bg, color: sc.color }}>{order.status}</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#0d1117" }}>

        {tab === "details" && (
          <div className="pb-6">
            {/* Details card */}
            <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={{ background: "#161b22", border: "1px solid #21262d" }}>
              <div className="px-4 py-2.5" style={{ background: "#1a2030", borderBottom: "1px solid #21262d" }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8b949e" }}>Details</span>
              </div>
              {detailRows.map(([label, value], i) => (
                <div key={label} className="flex items-start justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: i < detailRows.length - 1 ? "1px solid #21262d" : "none" }}>
                  <span className="text-xs shrink-0" style={{ color: "#6e7681", minWidth: 110 }}>{label}</span>
                  <span className="text-xs font-medium text-right flex-1" style={{ color: "#e6edf3", whiteSpace: "pre-line" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            {order.notes && (
              <div className="mx-4 mt-4">
                <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: "#8b949e" }}>Description</p>
                <div className="rounded-2xl px-4 py-3" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                  <p className="text-sm" style={{ color: "#e6edf3", lineHeight: 1.6 }}>{order.notes}</p>
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="mx-4 mt-4">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: "#8b949e" }}>Signature</p>
              {order.signatureData ? (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #21262d" }}>
                  <div className="p-4" style={{ background: "#ffffff" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={order.signatureData} alt="Signature" className="max-w-full" style={{ height: 80, objectFit: "contain" }} />
                  </div>
                  {order.signedAt && (
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#161b22", borderTop: "1px solid #21262d" }}>
                      <span className="text-xs" style={{ color: "#6e7681" }}>
                        {order.signedByName && <><span style={{ color: "#e6edf3" }}>{order.signedByName}</span> · </>}
                        {new Date(order.signedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e33" }}>✓ Signed</span>
                    </div>
                  )}
                </div>
              ) : collectingSig ? (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#161b22", border: "1px solid #C9A84C44" }}>
                  <input
                    value={sigName}
                    onChange={e => setSigName(e.target.value)}
                    placeholder="Signer name (optional)"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                  <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #30373f", background: "#ffffff", touchAction: "none" }}>
                    <canvas ref={sigCanvasRef} width={600} height={160} className="w-full" style={{ cursor: "crosshair", display: "block" }}
                      onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigStop} onMouseLeave={sigStop}
                      onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigStop} />
                  </div>
                  {!sigHasDrawn && <p className="text-xs text-center" style={{ color: "#484f58" }}>Draw signature above</p>}
                  <div className="flex gap-2">
                    <button onClick={saveSig} disabled={!sigHasDrawn || sigSubmitting}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                      style={{ background: GOLD, color: "#0d1117" }}>
                      {sigSubmitting ? "Saving…" : "Save Signature"}
                    </button>
                    <button onClick={() => { setCollectingSig(false); clearSig(); }}
                      className="px-4 rounded-xl text-sm"
                      style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                      Cancel
                    </button>
                    <button onClick={clearSig} className="px-3 rounded-xl text-xs" style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>Clear</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                  <span className="text-xs" style={{ color: "#484f58" }}>No signature collected</span>
                  {canEdit && (
                    <button onClick={() => { setCollectingSig(true); setTimeout(() => clearSig(), 50); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "#C9A84C22", color: GOLD, border: "1px solid #C9A84C44" }}>
                      + Collect Signature
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Files */}
            <div className="mx-4 mt-4">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: "#8b949e" }}>Files</p>
              <div className="rounded-2xl p-3" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                {coAttachments.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: "#484f58" }}>No files attached</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {coAttachments.map(a => {
                      const isImg = a.mimeType.startsWith("image/");
                      const isPdf = a.mimeType.includes("pdf");
                      const label = isPdf ? "PDF" : isImg ? "IMG" : (a.name.split(".").pop() ?? "FILE").slice(0, 4).toUpperCase();
                      const color = isPdf ? "#dc2626" : isImg ? "#0ea5e9" : "#6366f1";
                      const href = `/api/co-attachment/${order.id}/${a.id}`;
                      return (
                        <a key={a.id} href={href} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center"
                          style={{ width: 80 }}
                        >
                          <div className="w-16 h-20 rounded-md flex items-center justify-center mb-1"
                            style={{ background: color, color: "#fff", fontWeight: 700, fontSize: 12 }}>
                            {label}
                          </div>
                          <span className="text-[10px] text-center truncate w-full" style={{ color: "#8b949e" }} title={a.name}>{a.name}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Created footer */}
            <p className="text-xs text-center italic mt-6 px-4" style={{ color: "#484f58" }}>
              Created: {new Date(order.createdAt).toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
            </p>
          </div>
        )}

        {tab === "preview" && (
          <div className="flex-1 flex flex-col" style={{ background: "#1e1e1e", minHeight: 600 }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
              <span className="text-xs font-semibold" style={{ color: "#8b949e" }}>
                Total: <span style={{ color: GOLD }}>${fmt(total)}</span>
              </span>
              <a
                href={`/api/${companyId}/clients/${clientId}/change-orders/${order.id}/pdf`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full font-semibold"
                style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}
              >
                ↓ Download PDF
              </a>
            </div>
            <iframe
              src={`/api/${companyId}/clients/${clientId}/change-orders/${order.id}/pdf?preview=1&t=${encodeURIComponent(order.signedAt ?? order.createdAt)}#toolbar=0&navpanes=0`}
              title="Change Order PDF Preview"
              className="flex-1 w-full"
              style={{ border: "none", minHeight: 600 }}
            />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="flex shrink-0" style={{ background: "#161b22", borderTop: "1px solid #21262d" }}>
        {(["details", "preview"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-3 text-sm font-semibold capitalize transition-colors"
            style={{ color: tab === t ? GOLD : "#6e7681", borderTop: tab === t ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            {t === "details" ? "Details" : "Preview"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main tab component ───────────────────────────────────────────────────────

type ExecutedContract = {
  id: string;
  name: string;
  estimateNumber: string | null;
  counterSignedAt: string;
  executedPdfUrl: string;
  executedEmailSentAt?: string | null;
  type?: "estimate" | "doc" | "change_order";
};

type ClientDoc = {
  id: string;
  name: string;
  clientSignedAt: string | null;
  clientSignedByName: string | null;
  clientAlreadySigned: boolean;
  counterSignedAt: string | null;
  countersignedFileUrl: string | null;
  originalFileUrl: string;
};

export default function ChangeOrdersTab({
  companyId,
  clientId,
  clientName,
  clientEmail,
  isCommercial,
  clientCoverPhotoType,
  initialOrders,
  contracts,
  initialClientDocs,
  canEdit,
  hideExecutedSection = false,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  isCommercial?: boolean;
  clientCoverPhotoType?: string | null;
  initialOrders: ChangeOrder[];
  contracts?: ExecutedContract[];
  initialClientDocs?: ClientDoc[];
  canEdit: boolean;
  hideExecutedSection?: boolean;
}) {
  const [orders, setOrders] = useState<ChangeOrder[]>(initialOrders);
  const [editing, setEditing] = useState<ChangeOrder | null | "new">(null);

  function nextCoNumber(): string {
    const nums = orders
      .map(o => o.orderNumber)
      .filter(Boolean)
      .map(n => parseInt(n!.replace(/\D/g, ""), 10))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `CO-${String(max + 1).padStart(3, "0")}`;
  }
  const [pdfOrder, setPdfOrder] = useState<ChangeOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ChangeOrder | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Client-signed doc upload ──
  const [clientDocs, setClientDocs] = useState<ClientDoc[]>(initialClientDocs ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Countersign modal ──
  const [countersigning, setCountersigning] = useState<string | null>(null); // docId
  const [csSubmitting, setCsSubmitting] = useState(false);
  const [csError, setCsError] = useState("");
  const [csHasDrawn, setCsHasDrawn] = useState(false);
  const [csDone, setCsDone] = useState<{ downloadUrl: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  async function handleUploadDoc() {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadName.trim()) { setUploadError("Name and file are required."); return; }
    setUploadError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", uploadName.trim());
      fd.append("clientAlreadySigned", "true");
      const res = await fetch(`/api/${companyId}/clients/${clientId}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setClientDocs(prev => [{
        id: data.id,
        name: data.name,
        clientSignedAt: data.clientSignedAt,
        clientSignedByName: data.clientSignedByName,
        clientAlreadySigned: true,
        counterSignedAt: null,
        countersignedFileUrl: null,
        originalFileUrl: `/api/${companyId}/clients/${clientId}/documents/${data.id}/file`,
      }, ...prev]);
      setUploadName(""); setShowUpload(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch { setUploadError("Network error"); }
    finally { setUploading(false); }
  }

  // Signature pad helpers
  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    e.preventDefault();
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    if (lastPos.current) {
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos; setCsHasDrawn(true); e.preventDefault();
  }
  function stopDraw() { drawing.current = false; lastPos.current = null; }
  function clearCanvas() {
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 160);
    setCsHasDrawn(false);
  }

  function openCountersign(docId: string) {
    setCountersigning(docId); setCsError(""); setCsHasDrawn(false); setCsDone(null);
    setTimeout(() => clearCanvas(), 50);
  }

  async function submitCountersign() {
    const canvas = canvasRef.current;
    if (!canvas || !csHasDrawn || !countersigning) return;
    const signatureData = canvas.toDataURL("image/png");
    setCsSubmitting(true); setCsError("");
    try {
      const res = await fetch(
        `/api/${companyId}/clients/${clientId}/documents/${countersigning}/countersign`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureData }) }
      );
      const data = await res.json();
      if (!res.ok) { setCsError(data.error ?? "Failed"); return; }
      setCsDone({ downloadUrl: data.downloadUrl });
      const now = new Date().toISOString();
      setClientDocs(prev => prev.map(d =>
        d.id === countersigning ? { ...d, counterSignedAt: now, countersignedFileUrl: data.downloadUrl } : d
      ));
    } catch { setCsError("Network error"); }
    finally { setCsSubmitting(false); }
  }

  const pendingDocs = clientDocs.filter(d => !d.counterSignedAt);
  const executedDocs = clientDocs.filter(d => !!d.counterSignedAt);
  const approvedCos = orders.filter(o => o.status === "APPROVED" && o.signedAt);
  const allExecuted = [
    ...(contracts ?? []).map(c => ({ ...c, type: "estimate" as const })),
    ...executedDocs.map(d => ({
      id: d.id,
      name: d.name,
      estimateNumber: null as string | null,
      counterSignedAt: d.counterSignedAt!,
      executedPdfUrl: d.countersignedFileUrl!,
      executedEmailSentAt: null as string | null,
      type: "doc" as const,
    })),
    ...approvedCos.map(o => ({
      id: o.id,
      name: o.title,
      estimateNumber: o.orderNumber,
      counterSignedAt: o.signedAt!,
      executedPdfUrl: `/api/${companyId}/clients/${clientId}/change-orders/${o.id}/pdf`,
      executedEmailSentAt: null as string | null,
      type: "change_order" as const,
    })),
  ].sort((a, b) => new Date(b.counterSignedAt).getTime() - new Date(a.counterSignedAt).getTime());

  const signingDoc = countersigning ? clientDocs.find(d => d.id === countersigning) : null;

  function handleSaved(order: ChangeOrder) {
    setOrders(prev => {
      const idx = prev.findIndex(o => o.id === order.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = order;
        return next;
      }
      return [order, ...prev];
    });
    setViewingOrder(prev => prev?.id === order.id ? order : prev);
    setEditing(null);
    window.dispatchEvent(new CustomEvent("mibh:client-financials-changed"));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this change order?")) return;
    startTransition(async () => {
      await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${id}`, { method: "DELETE" });
      setOrders(prev => prev.filter(o => o.id !== id));
      window.dispatchEvent(new CustomEvent("mibh:client-financials-changed"));
    });
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === id ? updated : o));
        window.dispatchEvent(new CustomEvent("mibh:client-financials-changed"));
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* ── Pending countersign section ── */}
      {pendingDocs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3" style={{ color: "#e6edf3" }}>Awaiting Your Signature</h3>
          <div className="space-y-2">
            {pendingDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "#1e2736", border: "1px solid #C9A84C44" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{d.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                    Client signed externally
                    {d.clientSignedAt && <> · {new Date(d.clientSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={d.originalFileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    View
                  </a>
                  <button onClick={() => openCountersign(d.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}>
                    ✍️ Countersign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload client-signed PDF ── */}
      <div>
        {!showUpload ? (
          <button onClick={() => setShowUpload(true)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold border-dashed"
            style={{ background: "transparent", border: "1.5px dashed #30373f", color: "#8b949e" }}>
            + Upload client-signed contract
          </button>
        ) : (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "#1e2736", border: "1px solid #C9A84C44" }}>
            <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Upload client-signed contract</p>
            <input value={uploadName} onChange={e => setUploadName(e.target.value)}
              placeholder="Document name (e.g. Service Agreement)" className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }} />
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="w-full text-sm" style={{ color: "#8b949e" }} />
            {uploadError && <p className="text-xs" style={{ color: "#ef4444" }}>{uploadError}</p>}
            <div className="flex gap-2">
              <button onClick={handleUploadDoc} disabled={uploading}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#fff" }}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button onClick={() => { setShowUpload(false); setUploadError(""); setUploadName(""); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Executed Contracts section ── */}
      {!hideExecutedSection && (
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: "#e6edf3" }}>Executed Contracts & Change Orders</h3>
        {allExecuted.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <p className="text-sm" style={{ color: "#8b949e" }}>No executed contracts yet — fully signed estimates, approved change orders, and uploaded contracts will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allExecuted.map(c => {
              const label = c.type === "change_order"
                ? `${c.estimateNumber ? `${c.estimateNumber} — ` : ""}${c.name}`
                : `${c.estimateNumber ? `Estimate #${c.estimateNumber} — ` : ""}${c.name}`;
              const dateLabel = c.type === "change_order" ? "Client approved" : "Executed";
              return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "#1e2736", border: "1px solid #30373f" }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {c.type === "change_order" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#1e2a3a", color: "#58a6ff", border: "1px solid #1f6feb44" }}>CO</span>
                    )}
                    <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{label}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                    {dateLabel} {new Date(c.counterSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {c.type !== "change_order" && (c.executedEmailSentAt ? (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#22c55e" }}>
                      ✓ Emailed to client {new Date(c.executedEmailSentAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#f59e0b" }}>
                      ⚠ Email not confirmed sent
                    </p>
                  ))}
                </div>
                <a href={c.executedPdfUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
                  ⬇ Download
                </a>
              </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Countersign modal ── */}
      {countersigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => !csSubmitting && !csDone && setCountersigning(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5"
            style={{ background: "#161b22", border: "1px solid #C9A84C55" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C9A84C88" }}>Countersignature</p>
                <p className="text-base font-bold" style={{ color: "#e6edf3" }}>{signingDoc?.name}</p>
              </div>
              {!csSubmitting && !csDone && (
                <button onClick={() => setCountersigning(null)} className="text-xl leading-none" style={{ color: "#8b949e" }}>×</button>
              )}
            </div>
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #22c55e44", color: "#22c55e" }}>
              ✓ Client signed externally (scan on file)
            </div>
            {csDone ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">✅</div>
                <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Fully executed! PDF emailed to both parties.</p>
                <div className="flex gap-3 justify-center">
                  <a href={csDone.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-bold px-4 py-2 rounded-lg"
                    style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
                    ⬇ Download Executed PDF
                  </a>
                  <button onClick={() => setCountersigning(null)}
                    className="text-sm px-4 py-2 rounded-lg"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Your Signature</label>
                    <button onClick={clearCanvas} className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>Clear</button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #30373f", background: "#ffffff", touchAction: "none" }}>
                    <canvas ref={canvasRef} width={600} height={160} className="w-full"
                      style={{ cursor: "crosshair", display: "block" }}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                  </div>
                  {!csHasDrawn && <p className="text-xs mt-1.5 text-center" style={{ color: "#484f58" }}>Draw your signature above</p>}
                </div>
                {csError && <p className="text-sm" style={{ color: "#ef4444" }}>{csError}</p>}
                <div className="flex gap-3">
                  <button onClick={submitCountersign} disabled={csSubmitting || !csHasDrawn}
                    className="flex-1 rounded-xl py-3 text-sm font-bold disabled:opacity-40"
                    style={{ background: "#C9A84C", color: "#fff" }}>
                    {csSubmitting ? "Processing…" : "Countersign & Email"}
                  </button>
                  <button onClick={() => setCountersigning(null)}
                    className="px-4 rounded-xl text-sm"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Change Orders section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "#8b949e" }}>
          {orders.length} change order{orders.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <button
            onClick={() => setEditing("new")}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            + New Change Order
          </button>
        )}
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm" style={{ color: "#8b949e" }}>No change orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const total = order.items.reduce((sum, it) => {
              const qty = parseFloat(String(it.qty ?? "0")) || 0;
              const cost = parseFloat(String(it.unitCost ?? "0")) || 0;
              const markup = parseFloat(String(it.markupPct ?? "0")) || 0;
              return sum + qty * cost * (1 + markup / 100);
            }, 0);
            const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.DRAFT;

            return (
              <div
                key={order.id}
                className="rounded-xl p-4"
                style={{ background: "#1e2736", border: "1px solid #30373f" }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.orderNumber && (
                        <span className="text-xs font-mono" style={{ color: "#8b949e" }}>{order.orderNumber}</span>
                      )}
                      <span className="font-semibold" style={{ color: "#e6edf3" }}>{order.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: "#8b949e" }}>
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </span>
                      {total > 0 && (
                        <span className="text-xs font-bold" style={{ color: GOLD }}>${fmt(total)}</span>
                      )}
                      <span className="text-xs" style={{ color: "#484f58" }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {order.notes && (
                      <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{order.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* View detail */}
                    <button
                      onClick={() => setViewingOrder(order)}
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "#1a2436", border: "1px solid #C9A84C44", color: GOLD }}
                    >
                      View
                    </button>
                    {/* PDF options */}
                    <button
                      onClick={() => setPdfOrder(order)}
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "#1a2436", border: "1px solid #30373f", color: "#8b949e" }}
                    >
                      ↓ PDF
                    </button>
                    {/* Email send */}
                    <SendChangeOrderEmailButton
                      changeOrderId={order.id}
                      clientId={clientId}
                      companyId={companyId}
                      orderTitle={order.title}
                      orderNumber={order.orderNumber}
                      clientName={clientName}
                      clientEmail={clientEmail}
                      isCommercial={isCommercial}
                      clientCoverPhotoType={clientCoverPhotoType}
                    />
                    {canEdit && (
                      <>
                        <select
                          value={order.status}
                          onChange={e => handleStatusChange(order.id, e.target.value)}
                          disabled={isPending}
                          className="rounded px-2 py-1 text-xs"
                          style={inputStyle}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                        <button
                          onClick={() => setEditing(order)}
                          className="px-3 py-1 rounded text-xs font-medium"
                          style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: GOLD }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Item preview */}
                {order.items.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid #21262d" }}>
                    {order.items.slice(0, 4).map(it => (
                      <div key={it.id} className="flex items-center justify-between text-xs py-0.5">
                        <span style={{ color: "#8b949e" }}>
                          {it.csiCode && <span className="mr-1 font-mono" style={{ color: "#484f58" }}>{it.csiCode}</span>}
                          {it.name}
                        </span>
                        {it.qty && it.unitCost && (
                          <span style={{ color: GOLD }}>
                            ${fmt(
                              (parseFloat(String(it.qty)) || 0) *
                              (parseFloat(String(it.unitCost)) || 0) *
                              (1 + (parseFloat(String(it.markupPct ?? "0")) || 0) / 100)
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <p className="text-xs mt-1" style={{ color: "#484f58" }}>
                        +{order.items.length - 4} more items
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      </div>{/* end change orders section */}

      {/* Editor modal */}
      {editing !== null && (
        <ChangeOrderEditor
          companyId={companyId}
          clientId={clientId}
          initial={editing === "new" ? null : editing}
          defaultOrderNumber={editing === "new" ? nextCoNumber() : undefined}
          onSave={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}

      {/* PDF options modal */}
      {pdfOrder && (
        <ChangeOrderPdfModal
          companyId={companyId}
          clientId={clientId}
          changeOrderId={pdfOrder.id}
          orderNumber={pdfOrder.orderNumber}
          orderTitle={pdfOrder.title}
          clientName={clientName}
          onClose={() => setPdfOrder(null)}
        />
      )}

      {/* Mobile CO detail view */}
      {viewingOrder && (
        <CODetailModal
          order={viewingOrder}
          companyId={companyId}
          clientId={clientId}
          clientName={clientName}
          canEdit={canEdit}
          onClose={() => setViewingOrder(null)}
          onEdit={() => { setEditing(viewingOrder); setViewingOrder(null); }}
          onSignatureSaved={updated => {
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
            setViewingOrder(updated);
            window.dispatchEvent(new CustomEvent("mibh:client-financials-changed"));
          }}
        />
      )}
    </div>
  );
}
