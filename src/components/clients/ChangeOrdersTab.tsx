"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
};

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
  onChange,
  onDelete,
}: {
  item: COItem;
  index: number;
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
          <input
            type="number"
            value={item.qty}
            onChange={e => onChange(index, "qty", e.target.value)}
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
          <input
            type="number"
            value={item.unitCost}
            onChange={e => onChange(index, "unitCost", e.target.value)}
            className="w-full rounded px-2 py-1 text-sm"
            style={inputStyle}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Markup %</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={item.markupPct}
              onChange={e => onChange(index, "markupPct", e.target.value)}
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

function ChangeOrderEditor({
  companyId,
  clientId,
  initial,
  onSave,
  onClose,
}: {
  companyId: string;
  clientId: string;
  initial: ChangeOrder | null;
  onSave: (order: ChangeOrder) => void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
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
            <ItemRow key={idx} item={item} index={idx} onChange={handleChange} onDelete={handleDelete} />
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
  const [includeDivisionSummary, setIncludeDivisionSummary] = useState(false);
  const [forcedBreakCsiPrefixes, setForcedBreakCsiPrefixes] = useState<string[]>([]);
  const initialized = useRef(false);

  // Read from localStorage after mount (client-only, avoids SSR/closure issues)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`co-pdf-opts-${clientId}`);
      if (raw) {
        const saved = JSON.parse(raw) as { divSummary: boolean; breaks: string[] };
        setIncludeDivisionSummary(saved.divSummary ?? false);
        setForcedBreakCsiPrefixes(saved.breaks ?? []);
      }
    } catch { /* ignore */ }
    initialized.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write on change, but only after the read effect has run
  useEffect(() => {
    if (!initialized.current) return;
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
              {orderNumber ? `CO ${orderNumber} — ` : ""}{orderTitle} · {clientName}
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

// ── Main tab component ───────────────────────────────────────────────────────

type ExecutedContract = {
  id: string;
  name: string;
  estimateNumber: string | null;
  counterSignedAt: string;
  executedPdfUrl: string;
  executedEmailSentAt?: string | null;
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
}) {
  const [orders, setOrders] = useState<ChangeOrder[]>(initialOrders);
  const [editing, setEditing] = useState<ChangeOrder | null | "new">(null);
  const [pdfOrder, setPdfOrder] = useState<ChangeOrder | null>(null);
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
  const allExecuted = [
    ...(contracts ?? []),
    ...executedDocs.map(d => ({
      id: d.id,
      name: d.name,
      estimateNumber: null as string | null,
      counterSignedAt: d.counterSignedAt!,
      executedPdfUrl: d.countersignedFileUrl!,
      executedEmailSentAt: null as string | null,
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
    setEditing(null);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this change order?")) return;
    startTransition(async () => {
      await fetch(`/api/${companyId}/clients/${clientId}/change-orders/${id}`, { method: "DELETE" });
      setOrders(prev => prev.filter(o => o.id !== id));
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
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: "#e6edf3" }}>Executed Contracts</h3>
        {allExecuted.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <p className="text-sm" style={{ color: "#8b949e" }}>No executed contracts yet — fully signed estimates and uploaded contracts will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allExecuted.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "#1e2736", border: "1px solid #30373f" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>
                    {c.estimateNumber ? `Estimate #${c.estimateNumber} — ` : ""}{c.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                    Executed {new Date(c.counterSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {c.executedEmailSentAt ? (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#22c55e" }}>
                      ✓ Emailed to client {new Date(c.executedEmailSentAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#f59e0b" }}>
                      ⚠ Email not confirmed sent
                    </p>
                  )}
                </div>
                <a href={c.executedPdfUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
                  ⬇ Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
