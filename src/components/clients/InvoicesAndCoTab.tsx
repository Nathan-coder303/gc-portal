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

type PaymentRow = { invoiceNumber: string; phase: string | null; payment: Payment };

export default function InvoicesAndCoTab(props: {
  invoices: ComponentProps<typeof ClientInvoicesTab>;
  changeOrders: ComponentProps<typeof ChangeOrdersTab>;
  clientName: string;
}) {
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const invoices: Invoice[] = props.invoices.initialInvoices;
  const orders: ChangeOrder[] = props.changeOrders.initialOrders;
  const clientName = props.clientName;

  const allPayments: PaymentRow[] = invoices.flatMap(inv =>
    inv.payments.map(p => ({ invoiceNumber: inv.invoiceNumber, phase: inv.phase, payment: p }))
  ).sort((a, b) => new Date(b.payment.paidDate).getTime() - new Date(a.payment.paidDate).getTime());

  const approvedChangeOrders = orders.filter(co => co.status === "APPROVED" || !!co.signedAt);

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const totalChangeOrders = approvedChangeOrders.reduce((s, co) => s + coTotal(co), 0);
  const totalClientPaid = allPayments.reduce((s, r) => s + r.payment.amount, 0);
  const totalBilled = totalInvoiced + totalChangeOrders;
  const clientBalance = totalBilled - totalClientPaid;

  function printStatement() {
    const win = window.open("", "_blank");
    if (!win) return;

    const invoiceRows = invoices.length === 0
      ? `<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic">No invoices issued yet.</td></tr>`
      : invoices.map((inv, idx) => `<tr><td style="padding:8px 12px;color:#1e293b">Invoice #${inv.invoiceNumber || idx + 1}${inv.status ? ` (${inv.status})` : ""}</td><td style="padding:8px 12px;color:#475569">Invoice</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(inv.amount)}</td></tr>`).join("");

    const coRows = approvedChangeOrders.length === 0
      ? ""
      : approvedChangeOrders.map(co => `<tr><td style="padding:8px 12px;color:#1e293b">${co.orderNumber ? `CO #${co.orderNumber} — ` : ""}${co.title}${co.signedAt ? ` (signed ${fmtDate(co.signedAt)})` : ""}</td><td style="padding:8px 12px;color:#92400e">Change Order</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(coTotal(co))}</td></tr>`).join("");

    const paymentRows = allPayments.map(r => `<tr><td style="padding:6px 12px 6px 24px;color:#475569;font-size:13px">Payment on ${fmtDate(r.payment.paidDate)} — toward Invoice #${r.invoiceNumber}</td><td style="padding:6px 12px;color:#22c55e;font-size:13px">Payment</td><td style="padding:6px 12px;text-align:right;color:#22c55e;font-size:13px">-$${fmt(r.payment.amount)}</td></tr>`).join("");

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
            <ClientInvoicesTab {...props.invoices} />
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
            <ChangeOrdersTab {...props.changeOrders} />
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
          <div className="px-4 pb-4 pt-1 space-y-1.5" style={{ borderTop: `1px solid ${BORDER}` }}>
            {allPayments.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: MUTED }}>No payments recorded yet.</p>
            ) : (
              allPayments.map(({ invoiceNumber, phase, payment }) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-bold font-mono" style={{ color: "#22c55e" }}>${fmt(payment.amount)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>{payment.method}</span>
                    <span className="text-xs truncate" style={{ color: MUTED }}>
                      Invoice #{invoiceNumber}{phase ? ` · ${phase}` : ""}
                    </span>
                    {payment.notes && <span className="text-xs truncate" style={{ color: MUTED }}>· {payment.notes}</span>}
                  </div>
                  <span className="text-xs shrink-0 ml-2" style={{ color: MUTED }}>{fmtDate(payment.paidDate)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
