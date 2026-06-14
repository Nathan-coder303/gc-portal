"use client";

import { useState, useEffect } from "react";
import PayAppEditor from "./PayAppEditor";

const GOLD = "#C9A84C";
const INPUT_STYLE = {
  background: "#1e2736",
  border: "1px solid #30373f",
  color: "#e6edf3",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
};

const PAYMENT_METHODS = ["Zelle", "Check", "Cash", "Credit Card", "ACH", "Wire"];

type PaymentRow = { payment: string; trigger: string; pct: number };

type Payment = {
  id: string;
  amount: number;
  method: string;
  paidDate: string;
  notes: string | null;
};

type Estimate = {
  id: string;
  name: string;
  estimateNumber: string | null;
  paymentSchedule: PaymentRow[] | null;
  total: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  estimateId: string;
  phase: string;
  trigger: string | null;
  pct: number;
  amount: number;
  status: string;
  dueDate: string | null;
  notes: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  payments: Payment[];
};

const DEFAULT_SCHEDULE: PaymentRow[] = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

function fmt(n: number) {
  const safe = Number(n);
  if (!Number.isFinite(safe)) return "0.00";
  return safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  SENT: "#3b82f6",
  PAID: "#22c55e",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: STATUS_COLORS[status] + "22", color: STATUS_COLORS[status], textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

export default function ClientInvoicesTab({
  companyId,
  clientId,
  clientName,
  clientEmail,
  estimates,
  initialInvoices,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  estimates: Estimate[];
  initialInvoices: Invoice[];
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);

  // Pay Apps state
  type PayAppSummary = { id: string; payAppNumber: number; invoiceNumber: string | null; projectName: string | null; invoiceDate: string | null; createdAt: string };
  const [payApps, setPayApps] = useState<PayAppSummary[]>([]);
  const [openPayAppId, setOpenPayAppId] = useState<string | null>(null);
  const [openPayAppTab, setOpenPayAppTab] = useState<"summary" | "lines" | "send">("summary");
  const [creatingPayApp, setCreatingPayApp] = useState(false);

  useEffect(() => {
    fetch(`/api/${companyId}/clients/${clientId}/payapps`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setPayApps(data))
      .catch(() => {});
  }, [companyId, clientId]);

  async function createPayApp() {
    setCreatingPayApp(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/payapps`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const { id, payAppNumber } = await res.json();
      setPayApps(prev => [...prev, { id, payAppNumber, invoiceNumber: null, projectName: null, invoiceDate: null, createdAt: new Date().toISOString() }]);
      setOpenPayAppId(id);
    } finally { setCreatingPayApp(false); }
  }

  async function deletePayApp(id: string) {
    if (!confirm("Delete this Pay App?")) return;
    await fetch(`/api/${companyId}/clients/${clientId}/payapps/${id}`, { method: "DELETE" });
    setPayApps(prev => prev.filter(p => p.id !== id));
  }

  // Create invoice state
  const [creating, setCreating] = useState(false);
  const [selectedEstId, setSelectedEstId] = useState(estimates[0]?.id ?? "");
  const [selectedPhase, setSelectedPhase] = useState<PaymentRow | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(plusDaysStr(30));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Payment recording state
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Zelle");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNotes, setPayNotes] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);

  // Edit invoice state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editPhase, setEditPhase] = useState("");
  const [editTrigger, setEditTrigger] = useState("");
  const [editPct, setEditPct] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  type EditLine = {
    id?: string;
    estimateItemId: string | null;
    sortOrder: number;
    itemNumber: string;
    description: string;
    scheduledValue: number;
    fromPrevious: number;
    pctThisInvoice: number;
    thisInvoice: number;
  };
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editLinesLoading, setEditLinesLoading] = useState(false);
  const [editApplyPct, setEditApplyPct] = useState("");
  const [editDivNames, setEditDivNames] = useState<Record<string, string>>({});
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  function toggleInvoice(id: string) {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [expandedDivs, setExpandedDivs] = useState<Set<string>>(new Set());

  function toggleDiv(code: string) {
    setExpandedDivs(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function openEdit(inv: Invoice) {
    setEditingInvoice(inv);
    setEditPhase(inv.phase);
    setEditTrigger(inv.trigger ?? "");
    setEditPct(inv.pct.toString());
    setEditDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : "");
    setEditNotes(inv.notes ?? "");
    setEditLines([]);
    setEditApplyPct(inv.pct.toString());
    setExpandedDivs(new Set()); // all collapsed on open
    setEditDivNames({});
    setEditLinesLoading(true);
    Promise.all([
      fetch(`/api/${companyId}/clients/${clientId}/invoices/${inv.id}`).then(r => r.json()),
      fetch(`/api/${companyId}/estimates/${inv.estimateId}/division-totals`).then(r => r.json()),
    ]).then(([invData, divTotals]) => {
      setEditLines(invData.lines ?? []);
      if (Array.isArray(divTotals)) {
        const nameMap: Record<string, string> = {};
        (divTotals as { name: string; csiCode: string | null }[]).forEach((d, i) => {
          const code = d.csiCode ? d.csiCode.slice(0, 2).padStart(2, "0") : String(i + 1).padStart(2, "0");
          nameMap[code] = d.name;
        });
        setEditDivNames(nameMap);
      }
    }).finally(() => setEditLinesLoading(false));
  }

  function setEditLinePct(idx: number, pct: number) {
    setEditLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, pctThisInvoice: pct, thisInvoice: Math.round(l.scheduledValue * pct / 100 * 100) / 100 };
    }));
  }

  function applyEditPctAll(pct: number) {
    setEditLines(prev => prev.map(l => ({
      ...l, pctThisInvoice: pct,
      thisInvoice: Math.round(l.scheduledValue * pct / 100 * 100) / 100,
    })));
  }

  async function saveEdit() {
    if (!editingInvoice || !editPhase.trim()) return;
    setEditSaving(true);
    try {
      await fetch(`/api/${companyId}/clients/${clientId}/invoices/${editingInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: editPhase.trim(),
          trigger: editTrigger.trim() || null,
          pct: editPct,
          dueDate: editDueDate || null,
          notes: editNotes.trim() || null,
          lines: editLines.length > 0 ? editLines : undefined,
        }),
      });
      const newAmount = editLines.length > 0
        ? editLines.reduce((s, l) => s + l.thisInvoice, 0)
        : Number(editingInvoice.amount);
      setInvoices(prev => prev.map(i =>
        i.id === editingInvoice.id
          ? { ...i, phase: editPhase.trim(), trigger: editTrigger.trim() || null, amount: newAmount, pct: Number(editPct), dueDate: editDueDate || null, notes: editNotes.trim() || null }
          : i
      ));
      setEditingInvoice(null);
    } finally {
      setEditSaving(false);
    }
  }

  // Send modal state
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);
  const [sendTo, setSendTo] = useState(clientEmail ?? "");
  const [sendCc, setSendCc] = useState("mikebaruh@gmail.com");
  const [sendBcc, setSendBcc] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedEst = estimates.find((e) => e.id === selectedEstId);
  const schedule = selectedEst?.paymentSchedule?.length
    ? selectedEst.paymentSchedule
    : DEFAULT_SCHEDULE;

  // Summary across all invoices
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.reduce((s, i) => s + i.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const totalBalance = totalInvoiced - totalPaid;

  function openSend(inv: Invoice) {
    const est = estimates.find(e => e.id === inv.estimateId);
    setSendInvoice(inv);
    setSendTo(clientEmail ?? "");
    setSendCc("mikebaruh@gmail.com");
    setSendBcc("");
    setSendSubject(`Invoice #${inv.invoiceNumber} - ${inv.phase}${est?.estimateNumber ? ` - Est. #${est.estimateNumber}` : ""}`);
    setSendBody(`Dear ${clientName},\n\nPlease find below your invoice for the ${inv.phase} phase of your project. We appreciate your continued trust in MIBH Construction and look forward to delivering exceptional results.\n\nPayment can be made via Zelle to mikebaruh@gmail.com or by check payable to MIBH Construction. Please include Invoice #${inv.invoiceNumber} in the memo.\n\nDon't hesitate to reach out if you have any questions.`);
    setSendResult(null);
    setPreviewOpen(false);
  }

  function openPayment(inv: Invoice) {
    const balance = inv.amount - inv.payments.reduce((s, p) => s + p.amount, 0);
    setPayingInvoice(inv);
    setPayAmount(balance > 0 ? balance.toFixed(2) : "");
    setPayMethod("Zelle");
    setPayDate(todayStr());
    setPayNotes("");
  }

  async function createInvoice() {
    if (!selectedEst || !selectedPhase) return;
    setSaving(true);
    const amount = parseFloat(customAmount) || (selectedEst.total * selectedPhase.pct) / 100;
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: selectedEst.id,
          phase: selectedPhase.payment,
          trigger: selectedPhase.trigger,
          pct: selectedPhase.pct,
          amount,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          notes: notes || null,
        }),
      });
      const inv = await res.json();
      setInvoices((prev) => [...prev, { ...inv, amount: Number(inv.amount), pct: Number(inv.pct), payments: [] }]);
      setCreating(false);
      setSelectedPhase(null);
      setCustomAmount("");
      setInvoiceDate(todayStr());
      setDueDate(plusDaysStr(30));
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (!payingInvoice || !payAmount || !payMethod) return;
    setPayingSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices/${payingInvoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payAmount, method: payMethod, paidDate: payDate, notes: payNotes || null }),
      });
      const rawPayment = await res.json();
      const payment = { ...rawPayment, amount: Number(rawPayment.amount) };

      // Update invoice payments + possibly status
      setInvoices(prev => {
        const next = prev.map(inv => {
          if (inv.id !== payingInvoice.id) return inv;
          const newPayments = [...inv.payments, payment];
          const paid = newPayments.reduce((s, p) => s + p.amount, 0);
          return {
            ...inv,
            payments: newPayments,
            status: paid >= inv.amount ? "PAID" : inv.status,
            paidAt: paid >= inv.amount ? new Date().toISOString() : inv.paidAt,
          };
        });
        const totalInvoiced = next.reduce((s, i) => s + Number(i.amount), 0);
        const totalPaid = next.reduce((s, i) => s + i.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
        window.dispatchEvent(new CustomEvent("payment-summary-updated", {
          detail: totalInvoiced > 0 ? { totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid } : null,
        }));
        return next;
      });
      setPayingInvoice(null);
    } finally {
      setPayingSaving(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function deletePayment(invoiceId: string, paymentId: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/invoices/${invoiceId}/payments/${paymentId}`, { method: "DELETE" });
    setInvoices(prev => {
      const next = prev.map(inv => {
        if (inv.id !== invoiceId) return inv;
        const newPayments = inv.payments.filter(p => p.id !== paymentId);
        const paid = newPayments.reduce((s, p) => s + p.amount, 0);
        return {
          ...inv,
          payments: newPayments,
          status: paid >= inv.amount ? "PAID" : (inv.sentAt ? "SENT" : "DRAFT"),
          paidAt: paid >= inv.amount ? inv.paidAt : null,
        };
      });
      const totalInvoiced = next.reduce((s, i) => s + Number(i.amount), 0);
      const totalPaid = next.reduce((s, i) => s + i.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
      window.dispatchEvent(new CustomEvent("payment-summary-updated", {
        detail: totalInvoiced > 0 ? { totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid } : null,
      }));
      return next;
    });
  }

  async function deleteInvoice(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/invoices/${id}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  async function duplicateInvoice(inv: Invoice) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimateId: inv.estimateId,
        phase: inv.phase,
        trigger: inv.trigger,
        pct: inv.pct,
        amount: inv.amount,
        dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : null,
        notes: inv.notes,
      }),
    });
    const newInv = await res.json();
    setInvoices((prev) => [...prev, { ...newInv, amount: Number(newInv.amount), pct: Number(newInv.pct), payments: [] }]);
  }

  async function sendEmail() {
    if (!sendInvoice) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices/${sendInvoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendTo, cc: sendCc, bcc: sendBcc || undefined, subject: sendSubject, bodyText: sendBody }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult("✓ Invoice sent successfully");
        setInvoices((prev) =>
          prev.map((i) => i.id === sendInvoice.id ? { ...i, status: "SENT", sentAt: new Date().toISOString() } : i)
        );
        setTimeout(() => { setSendInvoice(null); setSendResult(null); }, 1500);
      } else {
        const errMsg = data.error ?? "Unknown error";
        if (errMsg.includes("invalid_grant") || errMsg.includes("Invalid Credentials")) {
          setSendResult("RECONNECT");
        } else {
          setSendResult("Error: " + errMsg);
        }
      }
    } finally {
      setSending(false);
    }
  }

  const invoicesByEst: Record<string, Invoice[]> = {};
  for (const inv of invoices) {
    if (!invoicesByEst[inv.estimateId]) invoicesByEst[inv.estimateId] = [];
    invoicesByEst[inv.estimateId].push(inv);
  }

  return (
    <div className="space-y-6">

      {/* ── Payment Applications ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Payment Applications</h2>
          <button onClick={createPayApp} disabled={creatingPayApp}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
            {creatingPayApp ? "Creating…" : "+ New Pay App"}
          </button>
        </div>
        {payApps.length === 0 ? (
          <p className="text-sm" style={{ color: "#484f58" }}>No payment applications yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {payApps.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "#161b22", border: "1px solid #30373f" }}>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold" style={{ color: GOLD }}>Pay App #{p.payAppNumber}</span>
                  {p.invoiceNumber && <span className="text-xs" style={{ color: "#8b949e" }}>Invoice #{p.invoiceNumber}</span>}
                  {p.projectName && <span className="text-xs" style={{ color: "#8b949e" }}>{p.projectName}</span>}
                  {p.invoiceDate && <span className="text-xs" style={{ color: "#8b949e" }}>{p.invoiceDate}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setOpenPayAppTab("send"); setOpenPayAppId(p.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
                    ✉ Send
                  </button>
                  <button onClick={() => { setOpenPayAppTab("summary"); setOpenPayAppId(p.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: "#1e2736", color: "#e6edf3", border: "1px solid #30373f" }}>
                    Open
                  </button>
                  <button onClick={() => deletePayApp(p.id)}
                    className="text-xs px-2 py-1.5 rounded-lg"
                    style={{ color: "#f85149" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PayApp Editor Modal ──────────────────────────────────────────────── */}
      {openPayAppId && (
        <PayAppEditor
          payAppId={openPayAppId}
          companyId={companyId}
          clientId={clientId}
          clientEmail={clientEmail ?? ""}
          estimates={estimates.map(e => ({ id: e.id, name: e.name ?? "", estimateNumber: e.estimateNumber ?? "" }))}
          initialTab={openPayAppTab}
          onClose={refresh => {
            setOpenPayAppId(null);
            setOpenPayAppTab("summary");
            if (refresh) {
              fetch(`/api/${companyId}/clients/${clientId}/payapps`)
                .then(r => r.json())
                .then(data => Array.isArray(data) && setPayApps(data))
                .catch(() => {});
            }
          }}
        />
      )}

      <hr style={{ borderColor: "#21262d" }} />

      {/* Header + summary */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Invoices</h2>
          {invoices.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-1">
              <span className="text-xs" style={{ color: "#8b949e" }}>Invoiced: <strong style={{ color: "#e6edf3" }}>${fmt(totalInvoiced)}</strong></span>
              <span className="text-xs" style={{ color: "#8b949e" }}>Received: <strong style={{ color: "#22c55e" }}>${fmt(totalPaid)}</strong></span>
              <span className="text-xs" style={{ color: "#8b949e" }}>Balance: <strong style={{ color: totalBalance > 0 ? "#f87171" : "#22c55e" }}>${fmt(totalBalance)}</strong></span>
            </div>
          )}
        </div>
        {estimates.length > 0 && (
          <button
            onClick={() => { setCreating(true); setSelectedEstId(estimates[0].id); setSelectedPhase(null); setInvoiceDate(todayStr()); setDueDate(plusDaysStr(30)); }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            + New Invoice
          </button>
        )}
      </div>

      {estimates.length === 0 && (
        <p className="text-sm" style={{ color: "#8b949e" }}>No estimates found for this client. Create an estimate first.</p>
      )}

      {/* Create invoice modal */}
      {creating && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setCreating(false)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "#e6edf3" }}>Create Invoice</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Estimate</label>
                <select value={selectedEstId} onChange={(e) => { setSelectedEstId(e.target.value); setSelectedPhase(null); }}
                  style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                  {estimates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.estimateNumber ? `#${e.estimateNumber} — ` : ""}{e.name} (${fmt(e.total)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase / Stage</label>
                <div className="space-y-1.5">
                  {schedule.map((row) => {
                    const amount = selectedEst ? (selectedEst.total * row.pct) / 100 : 0;
                    const isSelected = selectedPhase?.payment === row.payment;
                    return (
                      <button key={row.payment}
                        onClick={() => { setSelectedPhase(row); setCustomAmount(amount.toFixed(2)); }}
                        className="w-full text-left rounded-lg px-3 py-2.5 flex items-center justify-between"
                        style={{
                          background: isSelected ? "#C9A84C22" : "#1e2736",
                          border: `1px solid ${isSelected ? GOLD : "#30373f"}`,
                        }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: isSelected ? GOLD : "#e6edf3" }}>{row.payment} ({row.pct}%)</div>
                          <div className="text-[10px]" style={{ color: "#8b949e" }}>{row.trigger}</div>
                        </div>
                        <div className="text-xs font-mono font-bold" style={{ color: isSelected ? GOLD : "#e6edf3" }}>
                          ${fmt(amount)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPhase && (
                <>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Amount ($)</label>
                    <input type="number" step="0.01" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} style={INPUT_STYLE} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Invoice Date</label>
                      <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={INPUT_STYLE} />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Due Date</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={INPUT_STYLE} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes (optional)</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...INPUT_STYLE, resize: "none" }} />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={createInvoice} disabled={!selectedPhase || saving}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {saving ? "Creating…" : "Create Invoice"}
              </button>
              <button onClick={() => setCreating(false)}
                className="px-4 py-2 text-xs rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {payingInvoice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setPayingInvoice(null)}>
          <div style={{ background: "#161b22", border: "1px solid #22c55e44", borderRadius: 14, padding: 24, width: "100%", maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Record Payment</h3>
            <p className="text-xs mb-4" style={{ color: "#8b949e" }}>
              Invoice #{payingInvoice.invoiceNumber} · {payingInvoice.phase} · <strong style={{ color: GOLD }}>${fmt(payingInvoice.amount)}</strong>
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Amount ($) *</label>
                  <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={INPUT_STYLE} autoFocus />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Date *</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Form of Payment *</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{
                        background: payMethod === m ? "#22c55e22" : "#1e2736",
                        border: `1px solid ${payMethod === m ? "#22c55e" : "#30373f"}`,
                        color: payMethod === m ? "#22c55e" : "#8b949e",
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes (optional)</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} style={INPUT_STYLE} placeholder="Check #1234, etc." />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={recordPayment} disabled={!payAmount || payingSaving}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: "#22c55e", color: "#fff" }}>
                {payingSaving ? "Saving…" : "✓ Record Payment"}
              </button>
              <button onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-xs rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit invoice modal */}
      {editingInvoice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setEditingInvoice(null)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 860, maxHeight: "92vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "#e6edf3" }}>
              Edit Invoice #{editingInvoice.invoiceNumber}
            </h3>

            {/* Top fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase / Name *</label>
                <input type="text" value={editPhase} onChange={e => setEditPhase(e.target.value)} style={INPUT_STYLE} autoFocus />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Milestone / Trigger</label>
                <input type="text" value={editTrigger} onChange={e => setEditTrigger(e.target.value)} style={INPUT_STYLE} placeholder="e.g. Contract signing" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Due Date</label>
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes</label>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} style={INPUT_STYLE} placeholder="Optional" />
              </div>
            </div>

            {/* Line items */}
            <div style={{ borderTop: "1px solid #30373f", paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3" }}>Schedule of Values</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>Apply % to all:</span>
                  <input type="number" min={0} max={100} step={0.5}
                    value={editApplyPct}
                    onChange={e => setEditApplyPct(e.target.value)}
                    placeholder="%"
                    style={{ width: 60, background: "#0d1117", border: `1px solid ${GOLD}44`, color: GOLD, borderRadius: 6, padding: "4px 6px", fontSize: 12, textAlign: "right", outline: "none" }} />
                  <button onClick={() => { const p = parseFloat(editApplyPct); if (!isNaN(p)) applyEditPctAll(p); }}
                    style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Apply
                  </button>
                </div>
              </div>

              {editLinesLoading ? (
                <div style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: 24 }}>Loading lines…</div>
              ) : editLines.length === 0 ? (
                <div style={{ color: "#8b949e", fontSize: 12, textAlign: "center", padding: 24 }}>No lines found for this invoice.</div>
              ) : (() => {
                // Build division groups preserving order
                const divOrder: string[] = [];
                const divMap: Record<string, { line: EditLine; globalIdx: number }[]> = {};
                editLines.forEach((line, globalIdx) => {
                  const code = line.itemNumber.split(".")[0];
                  if (!divMap[code]) { divMap[code] = []; divOrder.push(code); }
                  divMap[code].push({ line, globalIdx });
                });
                return (
                  <div style={{ overflowY: "auto", maxHeight: 400, border: "1px solid #30373f", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr style={{ background: "#0d1117" }}>
                          <th style={{ padding: "6px 6px", textAlign: "left", color: "#8b949e", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f", width: 60 }}>#</th>
                          <th style={{ padding: "6px 6px", textAlign: "left", color: "#8b949e", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f" }}>DESCRIPTION</th>
                          <th style={{ padding: "6px 6px", textAlign: "right", color: "#8b949e", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f", width: 88 }}>SCHEDULED</th>
                          <th style={{ padding: "6px 6px", textAlign: "right", color: "#8b949e", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f", width: 80 }}>FROM PREV</th>
                          <th style={{ padding: "6px 6px", textAlign: "right", color: GOLD, fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f", width: 76 }}>% THIS INV</th>
                          <th style={{ padding: "6px 6px", textAlign: "right", color: "#8b949e", fontWeight: 700, fontSize: 10, borderBottom: "1px solid #30373f", width: 90 }}>THIS INVOICE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divOrder.map(code => {
                          const entries = divMap[code];
                          const divName = editDivNames[code] ?? `Division ${code}`;
                          const isExpanded = expandedDivs.has(code);
                          const divScheduled = entries.reduce((s, e) => s + e.line.scheduledValue, 0);
                          const divFromPrev = entries.reduce((s, e) => s + e.line.fromPrevious, 0);
                          const divThisInv = entries.reduce((s, e) => s + e.line.thisInvoice, 0);
                          return (
                            <>
                              {/* Division header row */}
                              <tr key={`hdr-${code}`} onClick={() => toggleDiv(code)}
                                style={{ background: "#21262d", cursor: "pointer", userSelect: "none", borderBottom: "1px solid #30373f" }}>
                                <td style={{ padding: "7px 8px", fontWeight: 700, fontSize: 11, color: GOLD }}>
                                  <span style={{ marginRight: 6, fontSize: 9 }}>{isExpanded ? "▾" : "▸"}</span>{code}
                                </td>
                                <td style={{ padding: "7px 6px", fontWeight: 700, fontSize: 11, color: "#e6edf3" }}>{divName}</td>
                                <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "#e6edf3" }}>${fmt(divScheduled)}</td>
                                <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600, fontSize: 11, color: "#8b949e" }}>{divFromPrev > 0 ? `$${fmt(divFromPrev)}` : "—"}</td>
                                <td style={{ padding: "7px 6px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>—</td>
                                <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, fontSize: 11, color: GOLD }}>${fmt(divThisInv)}</td>
                              </tr>
                              {/* Item rows — only when expanded */}
                              {isExpanded && entries.map(({ line, globalIdx }, i) => (
                                <tr key={`item-${globalIdx}`} style={{ background: i % 2 === 0 ? "#161b22" : "#1a1f2b", borderBottom: "1px solid #21262d" }}>
                                  <td style={{ padding: "4px 6px", color: "#8b949e", fontSize: 10, paddingLeft: 20 }}>{line.itemNumber}</td>
                                  <td style={{ padding: "4px 6px", color: "#e6edf3" }}>{line.description}</td>
                                  <td style={{ padding: "4px 6px", textAlign: "right", color: "#8b949e" }}>${fmt(line.scheduledValue)}</td>
                                  <td style={{ padding: "4px 6px", textAlign: "right", color: "#8b949e" }}>{line.fromPrevious > 0 ? `$${fmt(line.fromPrevious)}` : "—"}</td>
                                  <td style={{ padding: "2px 2px", textAlign: "right" }}>
                                    <input
                                      type="number" min={0} max={100} step={0.5}
                                      value={line.pctThisInvoice}
                                      onChange={e => setEditLinePct(globalIdx, parseFloat(e.target.value) || 0)}
                                      style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${GOLD}44`, outline: "none", color: GOLD, fontWeight: 700, fontSize: 11, textAlign: "right", padding: "2px 6px" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px 6px", textAlign: "right", color: line.thisInvoice > 0 ? GOLD : "#8b949e", fontWeight: 600 }}>${fmt(line.thisInvoice)}</td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {editLines.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", marginTop: 8, background: "#0d1117", borderRadius: 6, border: "1px solid #30373f" }}>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>Invoice Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>
                    ${fmt(editLines.reduce((s, l) => s + l.thisInvoice, 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} disabled={!editPhase.trim() || editSaving}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditingInvoice(null)}
                className="px-4 py-2 text-xs rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Send modal */}
      {sendInvoice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setSendInvoice(null); setPreviewOpen(false); }}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Send Invoice #{sendInvoice.invoiceNumber}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>{sendInvoice.phase} — <strong style={{ color: GOLD }}>${fmt(sendInvoice.amount)}</strong></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewOpen(v => !v)}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>
                  👁 Preview
                </button>
                <a href={`/api/${companyId}/clients/${clientId}/invoices/${sendInvoice.id}/pdf`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
                  ⬇ PDF
                </a>
              </div>
            </div>

            {previewOpen && (
              <div className="mb-4 rounded-lg overflow-hidden" style={{ border: "1px solid #30373f", height: 400 }}>
                <iframe
                  src={`/api/${companyId}/clients/${clientId}/invoices/${sendInvoice.id}/preview`}
                  className="w-full h-full bg-white"
                  style={{ border: "none" }}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>To *</label>
                  <input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Cc</label>
                  <input type="email" value={sendCc} onChange={(e) => setSendCc(e.target.value)} style={INPUT_STYLE} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Bcc</label>
                  <input type="email" value={sendBcc} onChange={(e) => setSendBcc(e.target.value)} style={INPUT_STYLE} placeholder="optional" />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Subject</label>
                  <input type="text" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Message</label>
                <textarea value={sendBody} onChange={(e) => setSendBody(e.target.value)} rows={6}
                  style={{ ...INPUT_STYLE, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "#1a2a1a", color: "#22c55e" }}>
                ✓ Payment history and balance due are included automatically in the invoice.
              </div>
            </div>

            {sendResult && sendResult === "RECONNECT" ? (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "#2d1b1b", border: "1px solid #f8514944" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#f87171" }}>Gmail authorization expired.</p>
                <a
                  href={`/api/google-oauth?companyId=${companyId}`}
                  className="text-xs font-bold underline"
                  style={{ color: "#C9A84C" }}
                >
                  Click here to reconnect Gmail →
                </a>
                <p className="text-[10px] mt-1" style={{ color: "#8b949e" }}>After reconnecting, return here and send again.</p>
              </div>
            ) : sendResult ? (
              <p className="text-xs mt-3" style={{ color: sendResult.startsWith("✓") ? "#22c55e" : "#f87171" }}>{sendResult}</p>
            ) : null}

            <div className="flex gap-2 mt-4">
              <button onClick={sendEmail} disabled={sending || !sendTo}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {sending ? "Sending…" : "✉ Send Invoice"}
              </button>
              <button onClick={() => { setSendInvoice(null); setPreviewOpen(false); }}
                className="px-4 py-2 text-xs rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice list grouped by estimate */}
      {estimates.map((est) => {
        const estInvoices = invoicesByEst[est.id] ?? [];
        if (estInvoices.length === 0) return null;
        return (
          <div key={est.id}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#8b949e" }}>
              {est.estimateNumber ? `#${est.estimateNumber} — ` : ""}{est.name}
            </div>
            <div className="space-y-3">
              {estInvoices.map((inv) => {
                const invPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
                const balance = inv.amount - invPaid;
                const isExpanded = expandedInvoices.has(inv.id);

                return (
                  <div key={inv.id} className="rounded-xl overflow-hidden" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                    {/* Header row — always visible, click to toggle */}
                    <div
                      className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer select-none"
                      style={{ borderBottom: isExpanded ? "1px solid #21262d" : "none" }}
                      onClick={() => toggleInvoice(inv.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: GOLD }}>#{inv.invoiceNumber}</span>
                        <span className="text-xs font-medium" style={{ color: "#e6edf3" }}>{inv.phase}</span>
                        <StatusBadge status={inv.status} />
                        {!isExpanded && inv.dueDate && (
                          <span className="text-[10px]" style={{ color: balance > 0 && new Date(inv.dueDate) < new Date() ? "#f87171" : "#6b7280" }}>
                            Due {fmtDate(inv.dueDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Desktop-only inline actions — always visible on sm+ */}
                        <div className="hidden sm:flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <a
                            href={`/api/${companyId}/clients/${clientId}/invoices/${inv.id}/preview`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>
                            👁 Preview
                          </a>
                          <button onClick={() => openSend(inv)}
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}>
                            ✉ Send
                          </button>
                          {balance > 0 && (
                            <button onClick={() => openPayment(inv)}
                              className="text-[10px] px-2 py-1 rounded font-semibold"
                              style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
                              $ Pay
                            </button>
                          )}
                          <button onClick={() => openEdit(inv)}
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
                            ✎ Edit
                          </button>
                          <button onClick={() => duplicateInvoice(inv)}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                            title="Duplicate">
                            ⧉
                          </button>
                          <button onClick={() => deleteInvoice(inv.id)}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ background: "#2d1b1b", color: "#f87171" }}>
                            ✕
                          </button>
                        </div>
                        <span className="text-sm font-mono font-bold" style={{ color: "#e6edf3" }}>${fmt(inv.amount)}</span>
                        <span
                          className="flex items-center justify-center w-6 h-6 rounded text-[13px]"
                          style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f", transition: "color 0.15s" }}
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? "▶" : "▼"}
                        </span>
                      </div>
                    </div>

                    {/* Expandable body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
                        {inv.trigger && (
                          <div className="text-[11px]" style={{ color: "#8b949e" }}>{inv.trigger}</div>
                        )}

                        <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: "#6b7280" }}>
                          <span>Created {fmtDate(inv.createdAt)}</span>
                          {inv.dueDate && <span style={{ color: balance > 0 && new Date(inv.dueDate) < new Date() ? "#f87171" : undefined }}>Due {fmtDate(inv.dueDate)}</span>}
                          {inv.sentAt && <span>Sent {fmtDate(inv.sentAt)}</span>}
                          {inv.paidAt && <span style={{ color: "#22c55e" }}>Paid in full {fmtDate(inv.paidAt)}</span>}
                        </div>

                        {inv.notes && (
                          <div className="text-[11px] rounded px-2 py-1" style={{ background: "#1e2736", color: "#8b949e" }}>{inv.notes}</div>
                        )}

                        {/* Balance summary (payment list moved to its own section in Invoices & CO's tab) */}
                        {inv.payments.length > 0 && (
                          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: balance <= 0 ? "#0a1a0a" : "#1a0a0a", border: `1px solid ${balance <= 0 ? "#1a2a1a" : "#2a1010"}` }}>
                            <span className="text-[11px] font-semibold" style={{ color: balance <= 0 ? "#22c55e" : "#f87171" }}>
                              {balance <= 0 ? "✓ Paid in Full" : `Balance Due (${inv.payments.length} payment${inv.payments.length === 1 ? "" : "s"} received)`}
                            </span>
                            <span className="text-sm font-bold font-mono" style={{ color: balance <= 0 ? "#22c55e" : "#f87171" }}>
                              {balance <= 0 ? "$0.00" : `$${fmt(balance)}`}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap mt-0.5">
                          <a
                            href={`/api/${companyId}/clients/${clientId}/invoices/${inv.id}/preview`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>
                            👁 Preview
                          </a>
                          <button onClick={() => openSend(inv)}
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}>
                            ✉ Send
                          </button>
                          {balance > 0 && (
                            <button onClick={() => openPayment(inv)}
                              className="text-[10px] px-2 py-1 rounded font-semibold"
                              style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
                              $ Record Payment
                            </button>
                          )}
                          <button onClick={() => openEdit(inv)}
                            className="text-[10px] px-2 py-1 rounded font-semibold"
                            style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
                            ✎ Edit
                          </button>
                          <button onClick={() => duplicateInvoice(inv)}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                            title="Duplicate invoice">
                            ⧉ Duplicate
                          </button>
                          <button onClick={() => deleteInvoice(inv.id)}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ background: "#2d1b1b", color: "#f87171" }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {invoices.length === 0 && estimates.length > 0 && (
        <div className="text-center py-10 text-sm" style={{ color: "#6b7280" }}>
          No invoices yet. Click <strong>+ New Invoice</strong> to create one from a payment phase.
        </div>
      )}
    </div>
  );
}
