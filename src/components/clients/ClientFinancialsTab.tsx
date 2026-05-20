"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TrashIcon } from "@/components/ui/icons";
import { STANDARD_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameMonth, isToday, eachDayOfInterval,
} from "date-fns";

type SubContractor = { id: string; name: string; email: string | null; phone: string | null; divisionCode: string; divisionName: string };
type SubPayment = { id: string; amount: number; method: string; paidAt: string; checkNumber: string | null; notes: string | null };
type ScopeItem = { id: string; csiCode: string | null; name: string; amount: number; salePrice: number | null };
type EstimateLineItem = { id: string; name: string; csiCode: string | null; salePrice: number };
type EstimateDivision = { divisionId: string; divisionName: string; csiCode: string | null; items: EstimateLineItem[] };
type ClientSub = { id: string; subContractorId: string | null; subName: string; scope: string | null; division: string | null; contractAmount: number; notes: string | null; payments: SubPayment[]; scopeItems: ScopeItem[] };
type Supplier = { id: string; name: string };
type MaterialPurchase = { id: string; supplierId: string; supplierName: string; amount: number; description: string | null; purchasedAt: string; notes: string | null };

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

const METHOD_LABELS: Record<string, string> = { CHECK: "Check", ZELLE: "Zelle", ACH: "ACH", CASH: "Cash" };

// ─── Calendar date picker ──────────────────────────────────────────────────────
function DatePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value + "T12:00:00") : new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  function selectDate(d: Date) {
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  const displayVal = value ? format(new Date(value + "T12:00:00"), "MM/dd/yyyy") : "Select date";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (value) setViewMonth(new Date(value + "T12:00:00")); }}
        className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2"
        style={{ background: "#0d1117", border: "1px solid #30373f", color: value ? "#e6edf3" : "#8b949e" }}
      >
        <span style={{ fontSize: "13px" }}>📅</span>
        <span>{displayVal}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl p-3 shadow-xl" style={{ background: "#161b22", border: "1px solid #30373f", width: "240px" }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg font-bold" style={{ color: "#8b949e" }}>‹</button>
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{format(viewMonth, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg font-bold" style={{ color: "#8b949e" }}>›</button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs py-0.5" style={{ color: "#4d5566" }}>{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map(d => {
              const dateStr = format(d, "yyyy-MM-dd");
              const isSelected = dateStr === value;
              const inMonth = isSameMonth(d, viewMonth);
              const todayBool = isToday(d);
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => selectDate(d)}
                  className="text-center text-xs py-1.5 rounded-lg"
                  style={{
                    color: isSelected ? "#fff" : inMonth ? (todayBool ? "#3b82f6" : "#e6edf3") : "#4d5566",
                    background: isSelected ? "#3b82f6" : "transparent",
                    fontWeight: isSelected || todayBool ? "700" : "400",
                  }}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { onChange(today()); setOpen(false); }}
            className="mt-2 w-full text-xs py-1 rounded-lg"
            style={{ color: "#3b82f6", background: "#3b82f611", border: "1px solid #3b82f633" }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Division Picker (multi-select chip dropdown) ─────────────────────────────
function DivisionPicker({ value, onChange, bg = "#0d1117" }: { value: string; onChange: (v: string) => void; bg?: string }) {
  const selected = value ? value.split(" | ").filter(Boolean) : [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter(d => d !== val) : [...selected, val];
    onChange(next.join(" | "));
  }

  return (
    <div className="relative" ref={ref}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map(div => (
            <span key={div} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
              <span>{div.split(" · ")[0]?.slice(0, 2)} · {div.split(" · ").slice(1).join(" · ")}</span>
              <button type="button" onClick={() => toggle(div)} className="leading-none" style={{ color: "#C9A84C99" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between" style={{ background: bg, border: "1px solid #30373f", color: "#8b949e" }}>
        <span>{selected.length === 0 ? "— Select Divisions —" : `${selected.length} division${selected.length > 1 ? "s" : ""} selected`}</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl overflow-y-auto shadow-xl" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: 220, width: "100%" }}>
          {STANDARD_TEMPLATE_DIVISIONS.map(d => {
            const val = `${d.csiCode} · ${d.name}`;
            const isSelected = selected.includes(val);
            return (
              <button key={d.csiCode} type="button" onClick={() => toggle(val)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors" style={{ color: isSelected ? "#C9A84C" : "#e6edf3", background: isSelected ? "#C9A84C11" : "transparent" }}>
                <span className="w-4 text-center text-xs">{isSelected ? "✓" : ""}</span>
                <span>{d.csiCode.slice(0, 2)} · {d.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub Card ─────────────────────────────────────────────────────────────────
function PayForm({ subId, companyId, clientId, payment, onSave, onCancel }: {
  subId: string; companyId: string; clientId: string;
  payment?: SubPayment;
  onSave: (p: SubPayment) => void;
  onCancel: () => void;
}) {
  const isEdit = !!payment;
  const [amount, setAmount] = useState(payment ? String(Math.abs(payment.amount)) : "");
  const [method, setMethod] = useState(payment?.method ?? "CHECK");
  const [date, setDate] = useState(payment?.paidAt ?? today());
  const [check, setCheck] = useState(payment?.checkNumber ?? "");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [isCredit, setIsCredit] = useState(payment ? payment.amount < 0 : false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount || isNaN(Number(amount))) return;
    setSaving(true);
    try {
      const raw = Number(amount);
      const final = isCredit ? -Math.abs(raw) : Math.abs(raw);
      if (isEdit) {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${subId}/payments`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: payment!.id, amount: final, method, paidAt: date, checkNumber: check || null, notes: notes || null }),
        });
        if (res.ok) onSave(await res.json());
      } else {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${subId}/payments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: final, method, paidAt: date, checkNumber: check || null, notes: notes || null }),
        });
        if (res.ok) onSave(await res.json());
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#0d1421", border: "1px solid #C9A84C33" }}>
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <div onClick={() => setIsCredit(c => !c)} className="w-9 h-5 rounded-full transition-colors relative" style={{ background: isCredit ? "#f85149" : "#30373f" }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: isCredit ? "18px" : "2px" }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: isCredit ? "#f85149" : "#8b949e" }}>{isCredit ? "Credit from sub" : "Payment to sub"}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
          <input autoFocus={isEdit} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
            <option value="CHECK">Check</option><option value="ZELLE">Zelle</option><option value="ACH">ACH</option><option value="CASH">Cash</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
          <DatePickerInput value={date} onChange={setDate} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Check # (optional)</label>
          <input value={check} onChange={e => setCheck(e.target.value)} placeholder="Check number" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
        </div>
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !amount} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: isCredit ? "#f85149" : "#22c55e", color: "#fff" }}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : isCredit ? "Log Credit" : "Add Payment"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
      </div>
    </div>
  );
}

function SubCard({
  sub, companyId, clientId, estimateDivisions,
  onUpdate, onDelete,
}: {
  sub: ClientSub; companyId: string; clientId: string;
  estimateDivisions: EstimateDivision[];
  onUpdate: (updated: ClientSub) => void;
  onDelete: (id: string) => void;
}) {
  const contractTotal = sub.scopeItems.length > 0
    ? sub.scopeItems.reduce((s, i) => s + i.amount, 0)
    : sub.contractAmount;
  const totalPaid = sub.payments.reduce((s, p) => s + p.amount, 0);
  const balance = contractTotal - totalPaid;
  const pct = contractTotal > 0 ? Math.min(totalPaid / contractTotal * 100, 100) : 0;

  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editDivision, setEditDivision] = useState(sub.division ?? "");
  const [editScope, setEditScope] = useState(sub.scope ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  const [showScopePicker, setShowScopePicker] = useState(false);
  const [openPickerDivs, setOpenPickerDivs] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemAmt, setEditingItemAmt] = useState("");

  const [showPayForm, setShowPayForm] = useState(false);
  const [editingPayId, setEditingPayId] = useState<string | null>(null);

  async function saveInfo() {
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: editScope.trim() || null, division: editDivision || null }),
      });
      if (res.ok) { onUpdate({ ...sub, scope: editScope.trim() || null, division: editDivision || null }); setShowEditInfo(false); }
    } finally { setSavingInfo(false); }
  }

  async function deleteSub() {
    if (!confirm(`Remove ${sub.subName}?`)) return;
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, { method: "DELETE" });
    onDelete(sub.id);
  }

  async function addScopeItems(items: { csiCode?: string | null; name: string; amount?: number; salePrice?: number | null }[]) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: [...sub.scopeItems, ...data.items] });
    }
  }

  async function saveScopeItemAmount(itemId: string, rawAmt: string) {
    const amount = Number(rawAmt);
    if (isNaN(amount)) return;
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, amount }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: sub.scopeItems.map(i => i.id === itemId ? { ...i, amount: data.amount } : i) });
      setEditingItemId(null);
    }
  }

  async function deleteScopeItem(itemId: string) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope?itemId=${itemId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: sub.scopeItems.filter(i => i.id !== itemId) });
    }
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/payments?paymentId=${paymentId}`, { method: "DELETE" });
    onUpdate({ ...sub, payments: sub.payments.filter(p => p.id !== paymentId) });
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{sub.subName}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: "#8b949e" }}>
              {[sub.division?.split(" | ").map(d => d.slice(0, 2) + " · " + d.split(" · ").slice(1).join(" · ")).join(", "), sub.scope].filter(Boolean).join(" — ") || "Subcontractor"}
            </span>
            <button onClick={() => { setEditDivision(sub.division ?? ""); setEditScope(sub.scope ?? ""); setShowEditInfo(v => !v); }} className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ color: "#C9A84C", background: "#C9A84C11", border: "1px solid #C9A84C33" }}>Edit</button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
            Contract: ${fmt(contractTotal)}
          </div>
          <button onClick={deleteSub} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>
            <TrashIcon size={13} />
          </button>
        </div>
      </div>

      {/* Edit info panel */}
      {showEditInfo && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: "#0d1117", border: "1px solid #C9A84C33" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Division</label>
              <DivisionPicker value={editDivision} onChange={setEditDivision} bg="#161b22" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Trade / Role</label>
              <input value={editScope} onChange={e => setEditScope(e.target.value)} placeholder="e.g. Electrician, Plumber" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveInfo} disabled={savingInfo} className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>{savingInfo ? "Saving…" : "Save"}</button>
            <button onClick={() => setShowEditInfo(false)} className="px-4 py-1.5 rounded-lg text-xs" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Scope of work */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Scope of Work</span>
          <button onClick={() => setShowScopePicker(v => !v)} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
            {showScopePicker ? "Close" : "+ Add Items"}
          </button>
        </div>

        {/* Scope items list with sale price + sub cost + profit */}
        {sub.scopeItems.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262d" }}>
            {/* Header row — compact columns that fit mobile */}
            <div className="grid px-2 py-1.5" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 74px 70px 20px", columnGap: "6px", background: "#0d1117", borderBottom: "1px solid #21262d" }}>
              <span className="text-xs" style={{ color: "#4d5566" }}>Item</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Sale</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Cost</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Profit</span>
              <span />
            </div>
            {sub.scopeItems.map(item => {
              const profit = item.salePrice != null ? item.salePrice - item.amount : null;
              return (
                <div key={item.id} style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
                  {editingItemId === item.id ? (
                    /* Edit row — full width, stacked */
                    <div className="flex items-center gap-1 px-2 py-2">
                      <span className="text-xs flex-1 truncate" style={{ color: "#8b949e" }}>{item.name}</span>
                      <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>$</span>
                      <input
                        autoFocus
                        value={editingItemAmt}
                        onChange={e => setEditingItemAmt(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveScopeItemAmount(item.id, editingItemAmt); if (e.key === "Escape") setEditingItemId(null); }}
                        className="w-20 rounded px-1.5 py-0.5 text-xs text-right shrink-0"
                        style={{ background: "#161b22", border: "1px solid #C9A84C", color: "#C9A84C" }}
                      />
                      <button onClick={() => saveScopeItemAmount(item.id, editingItemAmt)} className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: "#C9A84C", color: "#0d1117" }}>✓</button>
                      <button onClick={() => setEditingItemId(null)} className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "#30373f", color: "#8b949e" }}>✕</button>
                    </div>
                  ) : (
                    <div className="grid items-center px-2 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 74px 70px 20px", columnGap: "6px" }}>
                      <span className="text-xs truncate pr-1" style={{ color: "#e6edf3" }}>{item.name}</span>
                      <span className="text-xs text-right" style={{ color: "#8b949e" }}>{item.salePrice != null ? `$${fmt(item.salePrice)}` : "—"}</span>
                      <button onClick={() => { setEditingItemId(item.id); setEditingItemAmt(String(item.amount)); }} className="text-xs text-right font-semibold px-1 py-0.5 rounded" style={{ color: "#C9A84C", background: "#C9A84C11" }}>${fmt(item.amount)}</button>
                      <span className="text-xs text-right font-semibold" style={{ color: profit == null ? "#4d5566" : profit >= 0 ? "#22c55e" : "#f85149" }}>
                        {profit != null ? `$${fmt(profit)}` : "—"}
                      </span>
                      <button onClick={() => deleteScopeItem(item.id)} className="flex items-center justify-center" style={{ color: "#f85149" }}><TrashIcon size={10} /></button>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Totals row */}
            {(() => {
              const totalSale = sub.scopeItems.filter(i => i.salePrice != null).reduce((s, i) => s + (i.salePrice ?? 0), 0);
              const totalCost = sub.scopeItems.reduce((s, i) => s + i.amount, 0);
              const totalProfit = totalSale - totalCost;
              const hasSale = sub.scopeItems.some(i => i.salePrice != null);
              return (
                <div className="grid px-2 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 74px 70px 20px", columnGap: "6px", background: "#161b22", borderTop: "1px solid #30373f" }}>
                  <span className="text-xs font-bold" style={{ color: "#8b949e" }}>TOTAL</span>
                  <span className="text-xs font-bold text-right" style={{ color: "#e6edf3" }}>{hasSale ? `$${fmt(totalSale)}` : "—"}</span>
                  <span className="text-xs font-bold text-right" style={{ color: "#C9A84C" }}>${fmt(totalCost)}</span>
                  <span className="text-xs font-bold text-right" style={{ color: hasSale ? (totalProfit >= 0 ? "#22c55e" : "#f85149") : "#4d5566" }}>{hasSale ? `$${fmt(totalProfit)}` : "—"}</span>
                  <span />
                </div>
              );
            })()}
          </div>
        )}

        {sub.scopeItems.length === 0 && !showScopePicker && (
          <p className="text-xs py-2 text-center" style={{ color: "#4d5566" }}>No scope items yet — click &ldquo;+ Add Items&rdquo;</p>
        )}

        {/* Estimate-based picker */}
        {showScopePicker && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
            {estimateDivisions.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#4d5566", background: "#0d1117" }}>No estimate items found for this client.</p>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 340, background: "#0d1117" }}>
                {estimateDivisions.map(div => {
                  const isOpen = openPickerDivs.has(div.divisionId);
                  const addedNames = new Set(sub.scopeItems.map(i => i.name));
                  const allAdded = div.items.every(i => addedNames.has(i.name));
                  return (
                    <div key={div.divisionId}>
                      <div className="flex items-center gap-2 px-3 py-2 sticky top-0" style={{ background: "#161b22", borderBottom: "1px solid #21262d" }}>
                        <button onClick={() => setOpenPickerDivs(prev => { const n = new Set(prev); if (isOpen) { n.delete(div.divisionId); } else { n.add(div.divisionId); } return n; })} className="flex items-center gap-2 flex-1 text-left">
                          <span className="text-xs" style={{ color: "#8b949e" }}>{isOpen ? "▼" : "▶"}</span>
                          <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{div.divisionName}</span>
                        </button>
                        {!allAdded && (
                          <button
                            onClick={() => addScopeItems(div.items.filter(i => !addedNames.has(i.name)).map(i => ({ csiCode: i.csiCode ?? undefined, name: i.name, salePrice: i.salePrice, amount: 0 })))}
                            className="text-xs px-2 py-0.5 rounded font-semibold shrink-0"
                            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C33" }}
                          >
                            + Add All
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <div>
                          {div.items.map(item => {
                            const added = addedNames.has(item.name);
                            return (
                              <div key={item.id} className="flex items-center gap-2 px-4 py-1.5" style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
                                <span className="text-xs flex-1 truncate" style={{ color: added ? "#4d5566" : "#e6edf3" }}>{item.name}</span>
                                <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>${fmt(item.salePrice)}</span>
                                {added ? (
                                  <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: "#22c55e", background: "#22c55e11" }}>Added</span>
                                ) : (
                                  <button onClick={() => addScopeItems([{ csiCode: item.csiCode ?? undefined, name: item.name, salePrice: item.salePrice, amount: 0 }])} className="text-xs px-2 py-0.5 rounded font-semibold shrink-0" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C33" }}>+ Add</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Balance bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs" style={{ color: "#8b949e" }}>
          <span>Paid: <span style={{ color: "#22c55e", fontWeight: 700 }}>${fmt(totalPaid)}</span></span>
          <span>Balance: <span style={{ color: balance > 0 ? "#f85149" : "#22c55e", fontWeight: 700 }}>${fmt(Math.abs(balance))}{balance < 0 ? " overpaid" : ""}</span></span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#0d1117" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "#C9A84C" }} />
        </div>
      </div>

      {/* Payments */}
      {sub.payments.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Payments</div>
          {sub.payments.map(p => {
            const isCr = p.amount < 0;
            if (editingPayId === p.id) {
              return (
                <PayForm key={p.id} subId={sub.id} companyId={companyId} clientId={clientId} payment={p}
                  onSave={updated => { onUpdate({ ...sub, payments: sub.payments.map(x => x.id === p.id ? updated : x) }); setEditingPayId(null); }}
                  onCancel={() => setEditingPayId(null)} />
              );
            }
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: isCr ? "#f8514922" : "#22c55e22", color: isCr ? "#f85149" : "#22c55e", border: `1px solid ${isCr ? "#f8514933" : "#22c55e33"}` }}>{METHOD_LABELS[p.method] ?? p.method}</span>
                  <span className="text-xs font-bold" style={{ color: isCr ? "#f85149" : "#22c55e" }}>{isCr ? "-" : ""}${fmt(Math.abs(p.amount))}</span>
                  <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {p.checkNumber && <span className="text-xs" style={{ color: "#8b949e" }}>#{p.checkNumber}</span>}
                  {p.notes && <span className="text-xs truncate" style={{ color: "#8b949e" }}>{p.notes}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingPayId(p.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#C9A84C", background: "#C9A84C11" }}>Edit</button>
                  <button onClick={() => deletePayment(p.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "#f85149" }}><TrashIcon size={11} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add payment */}
      {showPayForm ? (
        <PayForm subId={sub.id} companyId={companyId} clientId={clientId}
          onSave={p => { onUpdate({ ...sub, payments: [...sub.payments, p] }); setShowPayForm(false); }}
          onCancel={() => setShowPayForm(false)} />
      ) : (
        <button onClick={() => setShowPayForm(true)} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33" }}>
          + Add Payment
        </button>
      )}
    </div>
  );
}

// ─── Material Card (per supplier) ─────────────────────────────────────────────
function SupplierCard({
  supplierName, purchases,
  onDelete,
}: {
  supplierName: string; purchases: MaterialPurchase[];
  onDelete: (id: string) => void;
}) {
  const total = purchases.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{supplierName}</div>
        <div className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: total < 0 ? "#f8514922" : "#3b82f622", color: total < 0 ? "#f85149" : "#3b82f6", border: `1px solid ${total < 0 ? "#f8514933" : "#3b82f633"}` }}>
          {total < 0 ? "-" : ""}${fmt(Math.abs(total))}
        </div>
      </div>
      <div className="space-y-1">
        {purchases.map(p => {
          const isCredit = p.amount < 0;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isCredit && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>CR</span>}
                <span className="text-xs font-bold" style={{ color: isCredit ? "#f85149" : "#3b82f6" }}>{isCredit ? "-" : ""}${fmt(Math.abs(p.amount))}</span>
                <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.purchasedAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {p.description && <span className="text-xs truncate" style={{ color: "#e6edf3" }}>{p.description}</span>}
              </div>
              <button onClick={() => onDelete(p.id)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ color: "#f85149" }}>
                <TrashIcon size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ClientFinancialsTab({
  companyId, clientId, clientName, contractTotal,
}: {
  companyId: string; clientId: string; clientName: string; contractTotal: number;
}) {
  const [clientSubs, setClientSubs] = useState<ClientSub[]>([]);
  const [allSubs, setAllSubs] = useState<SubContractor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<MaterialPurchase[]>([]);
  const [estimateDivisions, setEstimateDivisions] = useState<EstimateDivision[]>([]);
  const [loading, setLoading] = useState(true);

  // Add sub form
  const [selectedSubId, setSelectedSubId] = useState("__new__");
  const [newSubName, setNewSubName] = useState("");
  const [subScope, setSubScope] = useState("");
  const [subDivision, setSubDivision] = useState("");
  const [addingSubForm, setAddingSubForm] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  // Add material form
  const [selectedSupplierId, setSelectedSupplierId] = useState("__new__");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [matDescChoice, setMatDescChoice] = useState("__custom__");
  const [matDescCustom, setMatDescCustom] = useState("");
  const [matDate, setMatDate] = useState(today());
  const [matNotes, setMatNotes] = useState("");
  const [matIsCredit, setMatIsCredit] = useState(false);
  const [addingMatForm, setAddingMatForm] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  const load = useCallback(async () => {
    const [subsRes, allSubsRes, suppliersRes, matsRes, itemsRes] = await Promise.all([
      fetch(`/api/${companyId}/clients/${clientId}/financials/subs`),
      fetch(`/api/${companyId}/subs`),
      fetch(`/api/${companyId}/suppliers`),
      fetch(`/api/${companyId}/clients/${clientId}/financials/materials`),
      fetch(`/api/${companyId}/clients/${clientId}/estimate-items`),
    ]);
    const [subs, allSubsList, suppliersList, matsList, itemsList] = await Promise.all([
      subsRes.json(), allSubsRes.json(), suppliersRes.json(), matsRes.json(), itemsRes.json(),
    ]);
    setClientSubs(subs);
    setAllSubs(Array.isArray(allSubsList) ? allSubsList.sort((a: SubContractor, b: SubContractor) => a.name.localeCompare(b.name)) : []);
    setSuppliers(Array.isArray(suppliersList) ? suppliersList : []);
    setMaterials(Array.isArray(matsList) ? matsList : []);
    setEstimateDivisions(Array.isArray(itemsList) ? itemsList : []);
    setLoading(false);
  }, [companyId, clientId]);

  useEffect(() => { load(); }, [load]);

  async function addSub() {
    setSavingSub(true);
    try {
      let subContractorId: string | null = null;
      let subName = newSubName.trim();
      if (selectedSubId !== "__new__") {
        subContractorId = selectedSubId;
        subName = allSubs.find(s => s.id === selectedSubId)?.name ?? "";
      }
      if (!subName) return;
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subContractorId, subName, scope: subScope || null, division: subDivision || null }),
      });
      if (res.ok) {
        const newSub = await res.json();
        newSub.subName = newSub.subName ?? subName;
        setClientSubs(prev => [...prev, newSub]);
        setNewSubName(""); setSubScope(""); setSubDivision(""); setSelectedSubId("__new__"); setAddingSubForm(false);
      }
    } finally { setSavingSub(false); }
  }

  async function addMaterial() {
    if (!matAmount || isNaN(Number(matAmount))) return;
    setSavingMat(true);
    try {
      let supplierId = selectedSupplierId;
      if (selectedSupplierId === "__new__") {
        if (!newSupplierName.trim()) return;
        const res = await fetch(`/api/${companyId}/suppliers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newSupplierName.trim() }),
        });
        const newSupplier = await res.json();
        supplierId = newSupplier.id;
        setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedSupplierId(newSupplier.id);
      }
      const description = matDescChoice === "__custom__" ? (matDescCustom.trim() || null) : matDescChoice;
      const rawAmount = Number(matAmount);
      const finalAmount = matIsCredit ? -Math.abs(rawAmount) : Math.abs(rawAmount);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, amount: finalAmount, description, purchasedAt: matDate, notes: matNotes || null }),
      });
      if (res.ok) {
        const purchase = await res.json();
        setMaterials(prev => [purchase, ...prev]);
        setMatAmount(""); setMatDescChoice("__custom__"); setMatDescCustom(""); setMatNotes(""); setMatIsCredit(false); setNewSupplierName(""); setAddingMatForm(false);
      }
    } finally { setSavingMat(false); }
  }

  async function deleteMaterial(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/materials?id=${id}`, { method: "DELETE" });
    setMaterials(prev => prev.filter(p => p.id !== id));
  }

  // Computed totals
  const totalContracted = clientSubs.reduce((s, sub) => s + (sub.scopeItems.length > 0 ? sub.scopeItems.reduce((ss, i) => ss + i.amount, 0) : sub.contractAmount), 0);
  const totalLaborPaid = clientSubs.reduce((s, sub) => s + sub.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalLaborBalance = totalContracted - totalLaborPaid;
  const totalMaterials = materials.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = totalContracted + totalMaterials;
  const netProfit = contractTotal - totalExpenses;

  // Auto-sync netProfit → internalProfitOverride on the client's estimate
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      fetch(`/api/${companyId}/clients/${clientId}/financials/sync-profit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netProfit, hasExpenses: totalExpenses > 0 }),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [netProfit, totalExpenses, companyId, clientId, loading]);

  // Group materials by supplier
  const matsBySupplier: Record<string, MaterialPurchase[]> = {};
  for (const m of materials) {
    if (!matsBySupplier[m.supplierName]) matsBySupplier[m.supplierName] = [];
    matsBySupplier[m.supplierName].push(m);
  }

  function printStatement() {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = [
      ...clientSubs.flatMap(sub => [
        `<tr><td style="padding:8px 12px;color:#1e293b;font-weight:600">${sub.subName}</td><td style="padding:8px 12px;color:#475569">Sub Contract</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(sub.contractAmount)}</td></tr>`,
        ...sub.payments.map(p => `<tr><td style="padding:6px 12px 6px 28px;color:#475569;font-size:13px">${new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} — ${METHOD_LABELS[p.method] ?? p.method}${p.checkNumber ? ` #${p.checkNumber}` : ""}${p.amount < 0 ? " (Credit)" : ""}</td><td style="padding:6px 12px;color:${p.amount < 0 ? "#ef4444" : "#22c55e"};font-size:13px">${p.amount < 0 ? "Credit" : "Payment"}</td><td style="padding:6px 12px;text-align:right;color:${p.amount < 0 ? "#ef4444" : "#22c55e"};font-size:13px">${p.amount < 0 ? "-" : ""}($${fmt(Math.abs(p.amount))})</td></tr>`),
      ]),
      ...materials.map(p => `<tr><td style="padding:8px 12px;color:#475569">${new Date(p.purchasedAt + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} — ${p.supplierName}${p.description ? `: ${p.description}` : ""}${p.amount < 0 ? " (Credit)" : ""}</td><td style="padding:8px 12px;color:${p.amount < 0 ? "#ef4444" : "#3b82f6"}">${p.amount < 0 ? "Credit" : "Materials"}</td><td style="padding:8px 12px;text-align:right;color:${p.amount < 0 ? "#ef4444" : "#3b82f6"}">${p.amount < 0 ? "-" : ""}$${fmt(Math.abs(p.amount))}</td></tr>`),
    ].join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Financial Statement — ${clientName}</title><style>body{font-family:Helvetica,sans-serif;max-width:800px;margin:40px auto;color:#1e293b}h1{font-size:22px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:13px}td{border-bottom:1px solid #e2e8f0;font-size:14px}.total{background:#f8fafc;font-weight:700}.profit{background:#0d2318;color:#22c55e;font-weight:700;font-size:16px}@media print{body{margin:20px}}</style></head><body>
<h1>Financial Statement</h1>
<p style="color:#64748b;font-size:14px">${clientName} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
<div style="display:flex;gap:24px;margin:24px 0;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
  <div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Contract Price</div><div style="font-size:24px;font-weight:800;color:#1e293b">$${fmt(contractTotal)}</div></div>
  <div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Total Expenses</div><div style="font-size:24px;font-weight:800;color:#ef4444">$${fmt(totalExpenses)}</div></div>
  <div><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Net Profit</div><div style="font-size:24px;font-weight:800;color:${netProfit >= 0 ? "#16a34a" : "#ef4444"}">$${fmt(netProfit)}</div></div>
</div>
<table><thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${rows}
<tr class="total"><td colspan="2" style="padding:10px 12px">Total Labor (Sub Contracts)</td><td style="padding:10px 12px;text-align:right">$${fmt(totalContracted)}</td></tr>
<tr><td colspan="2" style="padding:4px 12px 4px 24px;font-size:12px;color:#64748b">Paid to Subs</td><td style="padding:4px 12px;text-align:right;font-size:12px;color:#64748b">$${fmt(totalLaborPaid)}</td></tr>
<tr><td colspan="2" style="padding:4px 12px 10px 24px;font-size:12px;color:#64748b">Balance Owed</td><td style="padding:4px 12px 10px;text-align:right;font-size:12px;color:#64748b">$${fmt(totalLaborBalance)}</td></tr>
<tr class="total"><td colspan="2" style="padding:10px 12px">Total Materials</td><td style="padding:10px 12px;text-align:right">$${fmt(totalMaterials)}</td></tr>
<tr class="total"><td colspan="2" style="padding:10px 12px">Total Expenses</td><td style="padding:10px 12px;text-align:right">$${fmt(totalExpenses)}</td></tr>
<tr class="profit"><td colspan="2" style="padding:12px">NET PROFIT</td><td style="padding:12px;text-align:right">$${fmt(netProfit)}</td></tr>
</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  if (loading) return <div className="text-center py-12 text-sm" style={{ color: "#8b949e" }}>Loading financials…</div>;

  return (
    <div className="space-y-6">

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Contract Value", value: contractTotal, color: "#C9A84C" },
          { label: "Total Expenses", value: totalExpenses, color: "#f85149" },
          { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#22c55e" : "#f85149" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#8b949e" }}>{card.label}</div>
            <div className="text-xl font-bold" style={{ color: card.color }}>${fmt(card.value)}</div>
          </div>
        ))}
      </div>

      {/* Sub breakdown under summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sub Contracted", value: totalContracted, color: "#C9A84C" },
          { label: "Labor Paid", value: totalLaborPaid, color: "#22c55e" },
          { label: "Balance Owed", value: totalLaborBalance, color: "#f85149" },
          { label: "Materials", value: totalMaterials, color: "#3b82f6" },
        ].map(card => (
          <div key={card.label} className="rounded-xl px-4 py-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#8b949e" }}>{card.label}</div>
            <div className="text-base font-bold" style={{ color: card.color }}>${fmt(card.value)}</div>
          </div>
        ))}
      </div>

      {/* Print + actions */}
      <div className="flex justify-end">
        <button onClick={printStatement} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: "#C9A84C" }}>
          🖨 Print Statement
        </button>
      </div>

      {/* ── Section 1: Subcontractors ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Subcontractors</h2>
          {!addingSubForm && (
            <button onClick={() => setAddingSubForm(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>+ Add Sub</button>
          )}
        </div>

        {addingSubForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1421", border: "1px solid #C9A84C44" }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Add Subcontractor</div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Sub</label>
              <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                <option value="__new__">+ New sub (type name below)</option>
                {allSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedSubId === "__new__" && (
              <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Sub name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Division</label>
                <DivisionPicker value={subDivision} onChange={setSubDivision} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Trade / Role</label>
                <select value={subScope} onChange={e => setSubScope(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: subScope ? "#e6edf3" : "#8b949e" }}>
                  <option value="">— Select Trade —</option>
                  {STANDARD_TEMPLATE_DIVISIONS.map(d => (
                    <optgroup key={d.csiCode} label={`${d.csiCode.slice(0, 2)} · ${d.name}`}>
                      {d.items.map(item => (
                        <option key={item.csiCode} value={item.name}>{item.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addSub} disabled={savingSub || (selectedSubId === "__new__" && !newSubName.trim())} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>{savingSub ? "Saving…" : "Add Sub"}</button>
              <button onClick={() => { setAddingSubForm(false); setSubScope(""); setSubDivision(""); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        )}

        {clientSubs.length === 0 && !addingSubForm && (
          <p className="text-sm text-center py-6" style={{ color: "#8b949e" }}>No subs added yet.</p>
        )}

        <div className="space-y-4">
          {clientSubs.map(sub => (
            <SubCard
              key={sub.id}
              sub={sub}
              companyId={companyId}
              clientId={clientId}
              estimateDivisions={estimateDivisions}
              onUpdate={updated => setClientSubs(prev => prev.map(s => s.id === updated.id ? updated : s))}
              onDelete={id => setClientSubs(prev => prev.filter(s => s.id !== id))}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2: Materials / COGS ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Materials / COGS</h2>
          {!addingMatForm && (
            <button onClick={() => setAddingMatForm(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>+ Add Purchase</button>
          )}
        </div>

        {addingMatForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1421", border: "1px solid #3b82f644" }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>
                {matIsCredit ? "Log Supplier Credit" : "Add Material Purchase"}
              </div>
              {/* Credit toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setMatIsCredit(c => !c)}
                  className="w-9 h-5 rounded-full transition-colors relative"
                  style={{ background: matIsCredit ? "#f85149" : "#30373f" }}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: matIsCredit ? "18px" : "2px" }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: matIsCredit ? "#f85149" : "#8b949e" }}>
                  {matIsCredit ? "Credit from supplier" : "Purchase"}
                </span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Supplier</label>
                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                  <option value="__new__">+ New supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
                <input value={matAmount} onChange={e => setMatAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
                <DatePickerInput value={matDate} onChange={setMatDate} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Description</label>
                <select
                  value={matDescChoice}
                  onChange={e => setMatDescChoice(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                >
                  <option value="__custom__">Custom…</option>
                  {estimateDivisions.flatMap(d => d.items).map(item => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedSupplierId === "__new__" && (
              <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Supplier name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            {matDescChoice === "__custom__" && (
              <input value={matDescCustom} onChange={e => setMatDescCustom(e.target.value)} placeholder="Describe what was purchased" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="flex gap-2">
              <button
                onClick={addMaterial}
                disabled={savingMat || !matAmount}
                className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: matIsCredit ? "#f85149" : "#3b82f6", color: "#fff" }}
              >
                {savingMat ? "Saving…" : matIsCredit ? "Log Credit" : "Add Purchase"}
              </button>
              <button onClick={() => { setAddingMatForm(false); setMatIsCredit(false); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        )}

        {Object.keys(matsBySupplier).length === 0 && !addingMatForm && (
          <p className="text-sm text-center py-6" style={{ color: "#8b949e" }}>No material purchases yet.</p>
        )}

        <div className="space-y-4">
          {Object.entries(matsBySupplier).sort(([a], [b]) => a.localeCompare(b)).map(([supplierName, purchases]) => (
            <SupplierCard
              key={supplierName}
              supplierName={supplierName}
              purchases={purchases}
              onDelete={deleteMaterial}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
