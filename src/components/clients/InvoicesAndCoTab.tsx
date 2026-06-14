"use client";

import { useState, ComponentProps } from "react";
import ClientInvoicesTab from "./ClientInvoicesTab";
import ChangeOrdersTab from "./ChangeOrdersTab";

type Payment = { id: string; amount: number; method: string; paidDate: string; notes: string | null };
type Invoice = ComponentProps<typeof ClientInvoicesTab>["initialInvoices"][number];
type ChangeOrder = ComponentProps<typeof ChangeOrdersTab>["initialOrders"][number];

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

const PAYMENT_METHODS = ["Zelle", "Check", "Cash", "Credit Card", "ACH", "Wire"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function coTotal(co: ChangeOrder): number {
  return co.items.reduce((s, it) => {
    const qty = parseFloat(it.qty ?? "") || 0;
    const cost = parseFloat(it.unitCost ?? "") || 0;
    const markup = parseFloat(it.markupPct ?? "") || 0;
    return s + qty * cost * (1 + markup / 100);
  }, 0);
}

type PaymentRow = {
  source: "invoice" | "co";
  parentId: string;        // invoice id or change order id
  label: string;           // "Invoice #X" or "CO #Y"
  detail?: string | null;  // phase or CO title
  payment: Payment;
};

export default function InvoicesAndCoTab(props: {
  invoices: ComponentProps<typeof ClientInvoicesTab>;
  changeOrders: ComponentProps<typeof ChangeOrdersTab>;
  clientName: string;
}) {
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  // Local mirror of invoices so we can record payments and reflect them immediately
  const [invoices, setInvoices] = useState<Invoice[]>(props.invoices.initialInvoices);
  const [orders, setOrders] = useState<ChangeOrder[]>(props.changeOrders.initialOrders);
  const clientName = props.clientName;
  const { companyId, clientId } = props.invoices;

  const allPayments: PaymentRow[] = [
    ...invoices.flatMap(inv => inv.payments.map(p => ({
      source: "invoice" as const,
      parentId: inv.id,
      label: `Invoice #${inv.invoiceNumber}`,
      detail: inv.phase,
      payment: p,
    }))),
    ...orders.flatMap(co => (co.payments ?? []).map(p => ({
      source: "co" as const,
      parentId: co.id,
      label: `CO ${co.orderNumber ? `#${co.orderNumber} ` : ""}— ${co.title}`,
      detail: null,
      payment: p,
    }))),
  ].sort((a, b) => new Date(b.payment.paidDate).getTime() - new Date(a.payment.paidDate).getTime());

  const approvedChangeOrders = orders.filter(co => co.status === "APPROVED" || !!co.signedAt);

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const totalChangeOrders = approvedChangeOrders.reduce((s, co) => s + coTotal(co), 0);
  const totalClientPaid = allPayments.reduce((s, r) => s + r.payment.amount, 0);
  const totalBilled = totalInvoiced + totalChangeOrders;
  const clientBalance = totalBilled - totalClientPaid;

  // ── Executed contracts list (lifted from ChangeOrdersTab) ──
  const executedItems = [
    ...(props.changeOrders.contracts ?? []).map(c => ({ ...c, type: "estimate" as const })),
    ...(props.changeOrders.initialClientDocs ?? [])
      .filter(d => !!d.counterSignedAt)
      .map(d => ({
        id: d.id,
        name: d.name,
        estimateNumber: null as string | null,
        counterSignedAt: d.counterSignedAt!,
        executedPdfUrl: d.countersignedFileUrl!,
        executedEmailSentAt: null as string | null,
        type: "doc" as const,
      })),
    ...orders.filter(o => o.status === "APPROVED" && o.signedAt).map(o => ({
      id: o.id,
      name: o.title,
      estimateNumber: o.orderNumber,
      counterSignedAt: o.signedAt!,
      executedPdfUrl: `/api/${companyId}/clients/${clientId}/change-orders/${o.id}/pdf`,
      executedEmailSentAt: null as string | null,
      type: "change_order" as const,
    })),
  ].sort((a, b) => new Date(b.counterSignedAt).getTime() - new Date(a.counterSignedAt).getTime());

  // ── Add/Edit Payment modal state ──
  const [payOpen, setPayOpen] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // target = "inv:<id>" or "co:<id>"
  const [payTarget, setPayTarget] = useState<string>("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Zelle");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNotes, setPayNotes] = useState("");
  const [editing, setEditing] = useState<{ row: PaymentRow } | null>(null);

  // Build dropdown options: every invoice + every change order (only approved/signed ones for clarity)
  const targetOptions = [
    ...invoices.map(inv => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const bal = inv.amount - paid;
      return { key: `inv:${inv.id}`, label: `Invoice #${inv.invoiceNumber} · ${inv.phase} · $${fmt(inv.amount)} (${bal <= 0 ? "Paid" : `$${fmt(bal)} due`})` };
    }),
    ...orders.map(co => {
      const total = coTotal(co);
      const paid = (co.payments ?? []).reduce((s, p) => s + p.amount, 0);
      const bal = total - paid;
      return { key: `co:${co.id}`, label: `CO ${co.orderNumber ? `#${co.orderNumber} ` : ""}— ${co.title} · $${fmt(total)} (${bal <= 0 ? "Paid" : `$${fmt(bal)} due`})` };
    }),
  ];

  function openAddPayment() {
    setEditing(null);
    if (targetOptions.length === 0) {
      setPayError("Create an invoice or change order first.");
      setPayOpen(true);
      return;
    }
    setPayTarget(targetOptions[0].key);
    setPayAmount("");
    setPayMethod("Zelle");
    setPayDate(todayStr());
    setPayNotes("");
    setPayError(null);
    setPayOpen(true);
  }

  function openEditPayment(row: PaymentRow) {
    setEditing({ row });
    setPayTarget(row.source === "invoice" ? `inv:${row.parentId}` : `co:${row.parentId}`);
    setPayAmount(String(row.payment.amount));
    setPayMethod(row.payment.method);
    setPayDate(row.payment.paidDate.slice(0, 10));
    setPayNotes(row.payment.notes ?? "");
    setPayError(null);
    setPayOpen(true);
  }

  function applyInvoicePayment(invId: string, newPayments: Payment[]) {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invId) return inv;
      const paid = newPayments.reduce((s, p) => s + p.amount, 0);
      return {
        ...inv,
        payments: newPayments,
        status: paid >= inv.amount ? "PAID" : (inv.sentAt ? "SENT" : inv.status),
        paidAt: paid >= inv.amount && !inv.paidAt ? new Date().toISOString() : (paid >= inv.amount ? inv.paidAt : null),
      };
    }));
  }

  function applyCoPayments(coId: string, newPayments: Payment[]) {
    setOrders(prev => prev.map(co => co.id === coId ? { ...co, payments: newPayments } : co));
  }

  async function savePayment() {
    if (!payTarget || !payAmount || !payMethod) return;
    setPaySaving(true);
    setPayError(null);
    try {
      const [type, id] = payTarget.split(":");
      const isCo = type === "co";

      if (editing) {
        // Edit existing payment — same target only (changing target on edit isn't supported)
        const orig = editing.row;
        const url = orig.source === "invoice"
          ? `/api/${companyId}/clients/${clientId}/invoices/${orig.parentId}/payments/${orig.payment.id}`
          : `/api/${companyId}/clients/${clientId}/change-orders/${orig.parentId}/payments/${orig.payment.id}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: payAmount, method: payMethod, paidDate: payDate, notes: payNotes || null }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json() as Payment;
        if (orig.source === "invoice") {
          const inv = invoices.find(i => i.id === orig.parentId);
          if (inv) {
            const np = inv.payments.map(p => p.id === orig.payment.id ? { id: saved.id, amount: Number(saved.amount), method: saved.method, paidDate: saved.paidDate, notes: saved.notes } : p);
            applyInvoicePayment(inv.id, np);
          }
        } else {
          const co = orders.find(o => o.id === orig.parentId);
          if (co) {
            const np = (co.payments ?? []).map(p => p.id === orig.payment.id ? { id: saved.id, amount: Number(saved.amount), method: saved.method, paidDate: saved.paidDate, notes: saved.notes } : p);
            applyCoPayments(co.id, np);
          }
        }
      } else {
        // Create new
        const url = isCo
          ? `/api/${companyId}/clients/${clientId}/change-orders/${id}/payments`
          : `/api/${companyId}/clients/${clientId}/invoices/${id}/payments`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: payAmount, method: payMethod, paidDate: payDate, notes: payNotes || null }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const saved = await res.json() as Payment;
        const newPayment: Payment = { id: saved.id, amount: Number(saved.amount), method: saved.method, paidDate: typeof saved.paidDate === "string" ? saved.paidDate : new Date(saved.paidDate).toISOString(), notes: saved.notes ?? null };
        if (isCo) {
          const co = orders.find(o => o.id === id);
          applyCoPayments(id, [...(co?.payments ?? []), newPayment]);
        } else {
          const inv = invoices.find(i => i.id === id);
          if (inv) applyInvoicePayment(id, [...inv.payments, newPayment]);
        }
      }
      setPayOpen(false);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Failed to save payment");
    } finally {
      setPaySaving(false);
    }
  }

  async function deletePaymentRow(row: PaymentRow) {
    if (!confirm("Delete this payment?")) return;
    const url = row.source === "invoice"
      ? `/api/${companyId}/clients/${clientId}/invoices/${row.parentId}/payments/${row.payment.id}`
      : `/api/${companyId}/clients/${clientId}/change-orders/${row.parentId}/payments/${row.payment.id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete payment.");
      return;
    }
    if (row.source === "invoice") {
      const inv = invoices.find(i => i.id === row.parentId);
      if (inv) applyInvoicePayment(inv.id, inv.payments.filter(p => p.id !== row.payment.id));
    } else {
      const co = orders.find(o => o.id === row.parentId);
      if (co) applyCoPayments(co.id, (co.payments ?? []).filter(p => p.id !== row.payment.id));
    }
  }

  function printStatement() {
    const win = window.open("", "_blank");
    if (!win) return;

    const invoiceRows = invoices.length === 0
      ? `<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic">No invoices issued yet.</td></tr>`
      : invoices.map((inv, idx) => `<tr><td style="padding:8px 12px;color:#1e293b">Invoice #${inv.invoiceNumber || idx + 1}${inv.status ? ` (${inv.status})` : ""}</td><td style="padding:8px 12px;color:#475569">Invoice</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(inv.amount)}</td></tr>`).join("");

    const coRows = approvedChangeOrders.length === 0
      ? ""
      : approvedChangeOrders.map(co => `<tr><td style="padding:8px 12px;color:#1e293b">${co.orderNumber ? `CO #${co.orderNumber} — ` : ""}${co.title}${co.signedAt ? ` (signed ${fmtDate(co.signedAt)})` : ""}</td><td style="padding:8px 12px;color:#92400e">Change Order</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(coTotal(co))}</td></tr>`).join("");

    const paymentRows = allPayments.map(r => `<tr><td style="padding:6px 12px 6px 24px;color:#475569;font-size:13px">Payment on ${fmtDate(r.payment.paidDate)} — toward ${r.label}</td><td style="padding:6px 12px;color:#22c55e;font-size:13px">Payment</td><td style="padding:6px 12px;text-align:right;color:#22c55e;font-size:13px">-$${fmt(r.payment.amount)}</td></tr>`).join("");

    win.document.write(`<!DOCTYPE html><html><head><title>Client Statement — ${clientName}</title><style>
      body{font-family:Helvetica,sans-serif;max-width:800px;margin:40px auto;color:#1e293b}
      h1{font-size:22px;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:13px}
      td{border-bottom:1px solid #e2e8f0;font-size:14px}
      .group-header{background:#f1f5f9;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:12px;color:#475569}
      .subtotal{background:#f8fafc;font-weight:700}
      .balance{background:#1e293b;color:#C9A84C;font-weight:700;font-size:16px}
      .paid{background:#0d2318;color:#22c55e;font-weight:700;font-size:14px}
      @media print{body{margin:20px}}
    </style></head><body>
<h1>Client Statement</h1>
<p style="color:#64748b;font-size:14px">${clientName} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>

<div style="display:flex;gap:18px;margin:24px 0;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;flex-wrap:wrap">
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Invoices</div><div style="font-size:22px;font-weight:800;color:#1e293b">$${fmt(totalInvoiced)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">+</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Change Orders</div><div style="font-size:22px;font-weight:800;color:#92400e">$${fmt(totalChangeOrders)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">−</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Payments</div><div style="font-size:22px;font-weight:800;color:#22c55e">$${fmt(totalClientPaid)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">=</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Balance Due</div><div style="font-size:22px;font-weight:800;color:${clientBalance > 0 ? "#dc2626" : "#16a34a"}">$${fmt(Math.abs(clientBalance))}${clientBalance < 0 ? " CR" : ""}</div></div>
</div>

<table><thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>

<tr class="group-header"><td colspan="3" style="padding:8px 12px">Invoices</td></tr>
${invoiceRows}
<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Invoiced</td><td style="padding:10px 12px;text-align:right">$${fmt(totalInvoiced)}</td></tr>

${approvedChangeOrders.length > 0 ? `
<tr class="group-header"><td colspan="3" style="padding:8px 12px">Change Orders</td></tr>
${coRows}
<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Change Orders</td><td style="padding:10px 12px;text-align:right">$${fmt(totalChangeOrders)}</td></tr>` : ""}

<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Billed (Invoices + Change Orders)</td><td style="padding:10px 12px;text-align:right">$${fmt(totalBilled)}</td></tr>

${paymentRows ? `
<tr class="group-header"><td colspan="3" style="padding:8px 12px">Payments Received</td></tr>
${paymentRows}
<tr class="paid"><td colspan="2" style="padding:10px 12px">Total Paid</td><td style="padding:10px 12px;text-align:right">-$${fmt(totalClientPaid)}</td></tr>` : `
<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic">No payments received yet.</td></tr>`}

<tr class="balance"><td colspan="2" style="padding:14px 12px">${clientBalance >= 0 ? "BALANCE DUE" : "CREDIT"}</td><td style="padding:14px 12px;text-align:right">$${fmt(Math.abs(clientBalance))}</td></tr>

</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-end">
        <button
          onClick={printStatement}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "#1e2736", border: `1px solid ${GOLD}44`, color: GOLD }}
        >
          🖨 Print Statement
        </button>
      </div>

      {/* ── Executed Contracts & Change Orders (above the 3 cards) ── */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <h3 className="text-sm font-bold mb-2" style={{ color: TEXT }}>Executed Contracts & Change Orders</h3>
        {executedItems.length === 0 ? (
          <p className="text-xs" style={{ color: MUTED }}>No executed contracts yet — fully signed estimates, approved change orders, and uploaded contracts will appear here automatically.</p>
        ) : (
          <div className="space-y-2">
            {executedItems.map(c => {
              const label = c.type === "change_order"
                ? `${c.estimateNumber ? `${c.estimateNumber} — ` : ""}${c.name}`
                : `${c.estimateNumber ? `Estimate #${c.estimateNumber} — ` : ""}${c.name}`;
              const dateLabel = c.type === "change_order" ? "Client approved" : "Executed";
              return (
                <div key={`${c.type}-${c.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "#1e2736", border: `1px solid ${BORDER}` }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {c.type === "change_order" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#1e2a3a", color: "#58a6ff", border: "1px solid #1f6feb44" }}>CO</span>
                      )}
                      <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{label}</p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: MUTED }}>{dateLabel} {fmtDate(c.counterSignedAt)}</p>
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

      {/* ── Invoices section ── */}
      <div className="rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <button
          onClick={() => setInvoicesOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: GOLD }}>{invoicesOpen ? "▼" : "▶"}</span>
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD }}>Invoices</span>
            {invoices.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}>{invoices.length}</span>
            )}
          </div>
          <span className="text-xs font-bold font-mono" style={{ color: TEXT }}>${fmt(totalInvoiced)}</span>
        </button>
        {invoicesOpen && (
          <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
            <ClientInvoicesTab {...props.invoices} initialInvoices={invoices} />
          </div>
        )}
      </div>

      {/* ── Change Orders section ── */}
      <div className="rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <button
          onClick={() => setCoOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#f59e0b" }}>{coOpen ? "▼" : "▶"}</span>
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>Change Orders</span>
            {orders.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>{orders.length}</span>
            )}
          </div>
          <span className="text-xs font-bold font-mono" style={{ color: TEXT }}>${fmt(totalChangeOrders)}</span>
        </button>
        {coOpen && (
          <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
            <ChangeOrdersTab {...props.changeOrders} hideExecutedSection />
          </div>
        )}
      </div>

      {/* ── Payments section ── */}
      <div className="rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <button
          onClick={() => setPaymentsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#22c55e" }}>{paymentsOpen ? "▼" : "▶"}</span>
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>Payments</span>
            {allPayments.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>{allPayments.length}</span>
            )}
          </div>
          <span className="text-xs font-bold font-mono" style={{ color: TEXT }}>${fmt(totalClientPaid)}</span>
        </button>
        {paymentsOpen && (
          <div className="px-4 pb-4 pt-1 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="flex justify-end">
              <button
                onClick={openAddPayment}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "#22c55e", color: "#0d1117" }}
              >
                + Record Payment
              </button>
            </div>
            {allPayments.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: MUTED }}>No payments recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {allPayments.map(row => (
                  <div key={`${row.source}-${row.payment.id}`} className="flex items-center justify-between rounded-lg px-3 py-2.5 gap-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                      <span className="text-sm font-bold font-mono" style={{ color: "#22c55e" }}>${fmt(row.payment.amount)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>{row.payment.method}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" style={{ background: row.source === "co" ? "#1e2a3a" : "#C9A84C22", color: row.source === "co" ? "#58a6ff" : GOLD, border: `1px solid ${row.source === "co" ? "#1f6feb44" : `${GOLD}44`}` }}>
                        {row.source === "co" ? "CO" : "INV"}
                      </span>
                      <span className="text-xs truncate" style={{ color: MUTED }}>
                        {row.label}{row.detail ? ` · ${row.detail}` : ""}
                      </span>
                      {row.payment.notes && <span className="text-xs truncate" style={{ color: MUTED }}>· {row.payment.notes}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs" style={{ color: MUTED }}>{fmtDate(row.payment.paidDate)}</span>
                      <button onClick={() => openEditPayment(row)} className="text-xs px-2 py-0.5 rounded" style={{ color: GOLD, background: "#C9A84C11" }}>Edit</button>
                      <button onClick={() => deletePaymentRow(row)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#f87171", background: "#2d1010" }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Record Payment modal ── */}
      {payOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => !paySaving && setPayOpen(false)}>
          <div style={{ background: CARD, border: "1px solid #22c55e44", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1" style={{ color: TEXT }}>{editing ? "Edit Payment" : "Record Payment"}</h3>
            <p className="text-xs mb-4" style={{ color: MUTED }}>Apply a payment to an invoice or a change order.</p>

            {targetOptions.length === 0 ? (
              <p className="text-sm" style={{ color: "#f87171" }}>{payError ?? "No invoices or change orders yet."}</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: MUTED }}>Apply to *</label>
                  <select
                    value={payTarget}
                    onChange={e => setPayTarget(e.target.value)}
                    disabled={!!editing}
                    className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  >
                    {targetOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  {editing && <p className="text-[10px] mt-1" style={{ color: MUTED }}>Target can&apos;t be changed when editing — delete and re-add to move to a different invoice/CO.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: MUTED }}>Amount ($) *</label>
                    <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                      autoFocus />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: MUTED }}>Date *</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: MUTED }}>Form of Payment *</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} onClick={() => setPayMethod(m)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{
                          background: payMethod === m ? "#22c55e22" : "#1e2736",
                          border: `1px solid ${payMethod === m ? "#22c55e" : BORDER}`,
                          color: payMethod === m ? "#22c55e" : MUTED,
                        }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: MUTED }}>Notes (optional)</label>
                  <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                    placeholder="Check #1234, etc."
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
                </div>
                {payError && <p className="text-xs" style={{ color: "#f87171" }}>{payError}</p>}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={savePayment} disabled={!payAmount || paySaving || targetOptions.length === 0}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: "#22c55e", color: "#fff" }}>
                {paySaving ? "Saving…" : (editing ? "✓ Save Changes" : "✓ Record Payment")}
              </button>
              <button onClick={() => setPayOpen(false)} disabled={paySaving}
                className="px-4 py-2 text-xs rounded-lg disabled:opacity-50"
                style={{ background: "#30373f", color: MUTED }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
