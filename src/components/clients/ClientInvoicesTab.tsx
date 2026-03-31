"use client";

import { useState } from "react";

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

type PaymentRow = { payment: string; trigger: string; pct: number };

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
};

const DEFAULT_SCHEDULE: PaymentRow[] = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clientName: _clientName,
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
  const [creating, setCreating] = useState(false);
  const [selectedEstId, setSelectedEstId] = useState(estimates[0]?.id ?? "");
  const [selectedPhase, setSelectedPhase] = useState<PaymentRow | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Send modal state
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);
  const [sendTo, setSendTo] = useState(clientEmail ?? "");
  const [sendCc, setSendCc] = useState("mikebaruh@gmail.com");
  const [sendSubject, setSendSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const selectedEst = estimates.find((e) => e.id === selectedEstId);
  const schedule = selectedEst?.paymentSchedule?.length
    ? selectedEst.paymentSchedule
    : DEFAULT_SCHEDULE;

  function openSend(inv: Invoice) {
    setSendInvoice(inv);
    setSendTo(clientEmail ?? "");
    setSendCc("mikebaruh@gmail.com");
    setSendSubject(`Invoice #${inv.invoiceNumber} — ${inv.phase}`);
    setSendResult(null);
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
          dueDate: dueDate || null,
          notes: notes || null,
        }),
      });
      const inv = await res.json();
      setInvoices((prev) => [...prev, inv]);
      setCreating(false);
      setSelectedPhase(null);
      setCustomAmount("");
      setDueDate("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(inv: Invoice) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
    });
    const updated = await res.json();
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function deleteInvoice(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/invoices/${id}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  async function sendEmail() {
    if (!sendInvoice) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/invoices/${sendInvoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendTo, cc: sendCc, subject: sendSubject }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult("✓ Invoice sent successfully");
        setInvoices((prev) =>
          prev.map((i) => i.id === sendInvoice.id ? { ...i, status: "SENT", sentAt: new Date().toISOString() } : i)
        );
        setTimeout(() => { setSendInvoice(null); setSendResult(null); }, 1500);
      } else {
        setSendResult("Error: " + (data.error ?? "Unknown error"));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Invoices</h2>
        {estimates.length > 0 && (
          <button
            onClick={() => { setCreating(true); setSelectedEstId(estimates[0].id); setSelectedPhase(null); }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            + New Invoice
          </button>
        )}
      </div>

      {estimates.length === 0 && (
        <p className="text-sm" style={{ color: "#8b949e" }}>No estimates found for this client. Create an estimate first.</p>
      )}

      {/* Create modal */}
      {creating && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setCreating(false)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480 }}
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
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Due Date (optional)</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={INPUT_STYLE} />
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

      {/* Send modal */}
      {sendInvoice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSendInvoice(null)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Send Invoice #{sendInvoice.invoiceNumber}</h3>
            <p className="text-[11px] mb-4" style={{ color: "#8b949e" }}>{sendInvoice.phase} — ${fmt(sendInvoice.amount)}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>To</label>
                <input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Cc</label>
                <input type="email" value={sendCc} onChange={(e) => setSendCc(e.target.value)} style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Subject</label>
                <input type="text" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} style={INPUT_STYLE} />
              </div>
            </div>

            {sendResult && (
              <p className="text-xs mt-3" style={{ color: sendResult.startsWith("✓") ? "#22c55e" : "#f87171" }}>{sendResult}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={sendEmail} disabled={sending || !sendTo}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {sending ? "Sending…" : "✉ Send Invoice"}
              </button>
              <button onClick={() => setSendInvoice(null)}
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
            <div className="space-y-2">
              {estInvoices.map((inv) => (
                <div key={inv.id} className="rounded-xl px-4 py-3 flex flex-col gap-1.5" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold" style={{ color: GOLD }}>#{inv.invoiceNumber}</span>
                      <span className="text-xs ml-2 font-medium" style={{ color: "#e6edf3" }}>{inv.phase}</span>
                      <span className="ml-2"><StatusBadge status={inv.status} /></span>
                    </div>
                    <span className="text-sm font-mono font-bold" style={{ color: "#e6edf3" }}>${fmt(inv.amount)}</span>
                  </div>

                  {inv.trigger && (
                    <div className="text-[11px]" style={{ color: "#8b949e" }}>{inv.trigger}</div>
                  )}

                  <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: "#6b7280" }}>
                    <span>Created {fmtDate(inv.createdAt)}</span>
                    {inv.dueDate && <span>Due {fmtDate(inv.dueDate)}</span>}
                    {inv.sentAt && <span>Sent {fmtDate(inv.sentAt)}</span>}
                    {inv.paidAt && <span style={{ color: "#22c55e" }}>Paid {fmtDate(inv.paidAt)}</span>}
                  </div>

                  {inv.notes && (
                    <div className="text-[11px] rounded px-2 py-1" style={{ background: "#1e2736", color: "#8b949e" }}>{inv.notes}</div>
                  )}

                  <div className="flex gap-2 mt-1">
                    {inv.status !== "PAID" && (
                      <button onClick={() => openSend(inv)}
                        className="text-[10px] px-2 py-1 rounded font-semibold"
                        style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}>
                        ✉ Send
                      </button>
                    )}
                    {inv.status !== "PAID" && (
                      <button onClick={() => markPaid(inv)}
                        className="text-[10px] px-2 py-1 rounded font-semibold"
                        style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
                        ✓ Mark Paid
                      </button>
                    )}
                    <button onClick={() => deleteInvoice(inv.id)}
                      className="text-[10px] px-2 py-1 rounded"
                      style={{ background: "#2d1b1b", color: "#f87171" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
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
