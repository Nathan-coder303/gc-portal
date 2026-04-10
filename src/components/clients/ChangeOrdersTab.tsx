"use client";

import { useState, useTransition } from "react";
import { STANDARD_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

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
  const qty = parseFloat(item.qty) || 0;
  const cost = parseFloat(item.unitCost) || 0;
  const markup = parseFloat(item.markupPct) || 0;
  const lineTotal = qty * cost * (1 + markup / 100);

  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ background: index % 2 === 0 ? "#0d1117" : "#10161e", border: "1px solid #21262d" }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs mb-0.5" style={{ color: "#8b949e" }}>{item.csiCode} · {item.divisionName}</div>
          <input
            value={item.name}
            onChange={e => onChange(index, "name", e.target.value)}
            className="w-full rounded px-2 py-1 text-sm"
            style={inputStyle}
            placeholder="Item name"
          />
        </div>
        <button
          onClick={() => onDelete(index)}
          className="mt-5 w-7 h-7 rounded flex items-center justify-center shrink-0"
          style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
        >
          ×
        </button>
      </div>
      <input
        value={item.description}
        onChange={e => onChange(index, "description", e.target.value)}
        className="w-full rounded px-2 py-1 text-xs mb-2"
        style={{ ...inputStyle, color: "#8b949e" }}
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
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={inputStyle}
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

// ── Main tab component ───────────────────────────────────────────────────────

export default function ChangeOrdersTab({
  companyId,
  clientId,
  initialOrders,
  canEdit,
}: {
  companyId: string;
  clientId: string;
  initialOrders: ChangeOrder[];
  canEdit: boolean;
}) {
  const [orders, setOrders] = useState<ChangeOrder[]>(initialOrders);
  const [editing, setEditing] = useState<ChangeOrder | null | "new">(null);
  const [isPending, startTransition] = useTransition();

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
    <div>
      {/* Header */}
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

                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
                    </div>
                  )}
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
    </div>
  );
}
