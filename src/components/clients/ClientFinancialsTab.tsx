"use client";
import { useState, useEffect, useCallback } from "react";
import { TrashIcon } from "@/components/ui/icons";

type SubContractor = { id: string; name: string; email: string | null; phone: string | null; divisionCode: string; divisionName: string };
type SubPayment = { id: string; amount: number; method: string; paidAt: string; checkNumber: string | null; notes: string | null };
type ClientSub = { id: string; subContractorId: string | null; subName: string; contractAmount: number; notes: string | null; payments: SubPayment[] };
type Supplier = { id: string; name: string };
type MaterialPurchase = { id: string; supplierId: string; supplierName: string; amount: number; description: string | null; purchasedAt: string; notes: string | null };

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

const METHOD_LABELS: Record<string, string> = { CHECK: "Check", ZELLE: "Zelle", ACH: "ACH", CASH: "Cash" };

// ─── Sub Card ─────────────────────────────────────────────────────────────────
function SubCard({
  sub, companyId, clientId, allSubs,
  onUpdate, onDelete,
}: {
  sub: ClientSub; companyId: string; clientId: string; allSubs: SubContractor[];
  onUpdate: (updated: ClientSub) => void;
  onDelete: (id: string) => void;
}) {
  const totalPaid = sub.payments.reduce((s, p) => s + p.amount, 0);
  const balance = sub.contractAmount - totalPaid;
  const pct = sub.contractAmount > 0 ? Math.min(totalPaid / sub.contractAmount * 100, 100) : 0;

  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CHECK");
  const [payDate, setPayDate] = useState(today());
  const [payCheck, setPayCheck] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editContract, setEditContract] = useState(false);
  const [contractVal, setContractVal] = useState(String(sub.contractAmount));

  async function addPayment() {
    if (!payAmount || isNaN(Number(payAmount))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod, paidAt: payDate, checkNumber: payCheck || null, notes: payNotes || null }),
      });
      if (res.ok) {
        const payment = await res.json();
        onUpdate({ ...sub, payments: [...sub.payments, payment] });
        setPayAmount(""); setPayCheck(""); setPayNotes(""); setShowPayForm(false);
      }
    } finally { setSaving(false); }
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/payments?paymentId=${paymentId}`, { method: "DELETE" });
    onUpdate({ ...sub, payments: sub.payments.filter(p => p.id !== paymentId) });
  }

  async function saveContract() {
    const val = Number(contractVal);
    if (isNaN(val)) return;
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractAmount: val }),
    });
    onUpdate({ ...sub, contractAmount: val });
    setEditContract(false);
  }

  async function deleteSub() {
    if (!confirm(`Remove ${sub.subName}?`)) return;
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, { method: "DELETE" });
    onDelete(sub.id);
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{sub.subName}</div>
          <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Subcontractor</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Contract amount */}
          {editContract ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={contractVal}
                onChange={e => setContractVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveContract(); if (e.key === "Escape") setEditContract(false); }}
                className="w-28 rounded-lg px-2 py-1 text-xs text-right"
                style={{ background: "#0d1117", border: "1px solid #C9A84C", color: "#C9A84C" }}
              />
              <button onClick={saveContract} className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: "#C9A84C", color: "#0d1117" }}>✓</button>
              <button onClick={() => setEditContract(false)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setContractVal(String(sub.contractAmount)); setEditContract(true); }} className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
              Contract: ${fmt(sub.contractAmount)}
            </button>
          )}
          <button onClick={deleteSub} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>
            <TrashIcon size={13} />
          </button>
        </div>
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

      {/* Payment history */}
      {sub.payments.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Payments</div>
          {sub.payments.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33" }}>{METHOD_LABELS[p.method] ?? p.method}</span>
                <span className="text-xs font-bold" style={{ color: "#22c55e" }}>${fmt(p.amount)}</span>
                <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {p.checkNumber && <span className="text-xs" style={{ color: "#8b949e" }}>#{p.checkNumber}</span>}
                {p.notes && <span className="text-xs truncate" style={{ color: "#8b949e" }}>{p.notes}</span>}
              </div>
              <button onClick={() => deletePayment(p.id)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ color: "#f85149" }}>
                <TrashIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add payment */}
      {showPayForm ? (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "#0d1421", border: "1px solid #C9A84C33" }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
              <input value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                <option value="CHECK">Check</option>
                <option value="ZELLE">Zelle</option>
                <option value="ACH">ACH</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Check # (optional)</label>
              <input value={payCheck} onChange={e => setPayCheck(e.target.value)} placeholder="Check number" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
          </div>
          <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
          <div className="flex gap-2">
            <button onClick={addPayment} disabled={saving || !payAmount} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#22c55e", color: "#fff" }}>{saving ? "Saving…" : "Add Payment"}</button>
            <button onClick={() => setShowPayForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
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
  supplierName, purchases, companyId, clientId,
  onDelete,
}: {
  supplierName: string; purchases: MaterialPurchase[];
  companyId: string; clientId: string;
  onDelete: (id: string) => void;
}) {
  const total = purchases.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{supplierName}</div>
        <div className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633" }}>${fmt(total)}</div>
      </div>
      <div className="space-y-1">
        {purchases.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-bold" style={{ color: "#3b82f6" }}>${fmt(p.amount)}</span>
              <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.purchasedAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              {p.description && <span className="text-xs truncate" style={{ color: "#e6edf3" }}>{p.description}</span>}
            </div>
            <button onClick={() => onDelete(p.id)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ color: "#f85149" }}>
              <TrashIcon size={11} />
            </button>
          </div>
        ))}
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
  const [loading, setLoading] = useState(true);

  // Add sub form
  const [selectedSubId, setSelectedSubId] = useState("__new__");
  const [newSubName, setNewSubName] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [addingSubForm, setAddingSubForm] = useState(false);
  const [savingSub, setSavingSub] = useState(false);

  // Add material form
  const [selectedSupplierId, setSelectedSupplierId] = useState("__new__");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matDate, setMatDate] = useState(today());
  const [matNotes, setMatNotes] = useState("");
  const [addingMatForm, setAddingMatForm] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  const load = useCallback(async () => {
    const [subsRes, allSubsRes, suppliersRes, matsRes] = await Promise.all([
      fetch(`/api/${companyId}/clients/${clientId}/financials/subs`),
      fetch(`/api/${companyId}/subs`),
      fetch(`/api/${companyId}/suppliers`),
      fetch(`/api/${companyId}/clients/${clientId}/financials/materials`),
    ]);
    const [subs, allSubsList, suppliersList, matsList] = await Promise.all([
      subsRes.json(), allSubsRes.json(), suppliersRes.json(), matsRes.json(),
    ]);
    setClientSubs(subs);
    setAllSubs(Array.isArray(allSubsList) ? allSubsList.sort((a: SubContractor, b: SubContractor) => a.name.localeCompare(b.name)) : []);
    setSuppliers(Array.isArray(suppliersList) ? suppliersList : []);
    setMaterials(Array.isArray(matsList) ? matsList : []);
    setLoading(false);
  }, [companyId, clientId]);

  useEffect(() => { load(); }, [load]);

  async function addSub() {
    if (!contractAmount || isNaN(Number(contractAmount))) return;
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
        body: JSON.stringify({ subContractorId, subName, contractAmount: Number(contractAmount) }),
      });
      if (res.ok) {
        const newSub = await res.json();
        newSub.subName = newSub.subName ?? subName;
        setClientSubs(prev => [...prev, newSub]);
        setContractAmount(""); setNewSubName(""); setSelectedSubId("__new__"); setAddingSubForm(false);
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
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, amount: Number(matAmount), description: matDesc || null, purchasedAt: matDate, notes: matNotes || null }),
      });
      if (res.ok) {
        const purchase = await res.json();
        setMaterials(prev => [purchase, ...prev]);
        setMatAmount(""); setMatDesc(""); setMatNotes(""); setNewSupplierName(""); setAddingMatForm(false);
      }
    } finally { setSavingMat(false); }
  }

  async function deleteMaterial(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/materials?id=${id}`, { method: "DELETE" });
    setMaterials(prev => prev.filter(p => p.id !== id));
  }

  // Computed totals
  const totalContracted = clientSubs.reduce((s, sub) => s + sub.contractAmount, 0);
  const totalLaborPaid = clientSubs.reduce((s, sub) => s + sub.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalLaborBalance = totalContracted - totalLaborPaid;
  const totalMaterials = materials.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = totalLaborPaid + totalMaterials;
  const netProfit = contractTotal - totalExpenses;

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
        ...sub.payments.map(p => `<tr><td style="padding:6px 12px 6px 28px;color:#475569;font-size:13px">${new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} — ${METHOD_LABELS[p.method] ?? p.method}${p.checkNumber ? ` #${p.checkNumber}` : ""}</td><td style="padding:6px 12px;color:#22c55e;font-size:13px">Payment</td><td style="padding:6px 12px;text-align:right;color:#22c55e;font-size:13px">($${fmt(p.amount)})</td></tr>`),
      ]),
      ...materials.map(p => `<tr><td style="padding:8px 12px;color:#475569">${new Date(p.purchasedAt + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} — ${p.supplierName}${p.description ? `: ${p.description}` : ""}</td><td style="padding:8px 12px;color:#3b82f6">Materials</td><td style="padding:8px 12px;text-align:right;color:#3b82f6">$${fmt(p.amount)}</td></tr>`),
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
<tr class="total"><td colspan="2" style="padding:10px 12px">Total Labor (Paid to Subs)</td><td style="padding:10px 12px;text-align:right">$${fmt(totalLaborPaid)}</td></tr>
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sub Contracted", value: totalContracted, color: "#C9A84C" },
          { label: "Labor Paid", value: totalLaborPaid, color: "#22c55e" },
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Sub</label>
                <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                  <option value="__new__">+ New sub (type name below)</option>
                  {allSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Contract Amount</label>
                <input value={contractAmount} onChange={e => setContractAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
            </div>
            {selectedSubId === "__new__" && (
              <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Sub name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="flex gap-2">
              <button onClick={addSub} disabled={savingSub || !contractAmount} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>{savingSub ? "Saving…" : "Add Sub"}</button>
              <button onClick={() => setAddingSubForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
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
              allSubs={allSubs}
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
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Add Material Purchase</div>
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
                <input type="date" value={matDate} onChange={e => setMatDate(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Description</label>
                <input value={matDesc} onChange={e => setMatDesc(e.target.value)} placeholder="What was purchased" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
            </div>
            {selectedSupplierId === "__new__" && (
              <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Supplier name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="flex gap-2">
              <button onClick={addMaterial} disabled={savingMat || !matAmount} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#3b82f6", color: "#fff" }}>{savingMat ? "Saving…" : "Add Purchase"}</button>
              <button onClick={() => setAddingMatForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
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
              companyId={companyId}
              clientId={clientId}
              onDelete={deleteMaterial}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
