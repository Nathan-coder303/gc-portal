function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fmtDate = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

type PaymentEntry = { amount: number; method: string; paidDate: Date | string; notes?: string | null };

export type InvoiceDivisionLine = {
  itemNumber: string;
  description: string;
  scheduledValue: number;
};

export function buildInvoiceHtml(opts: {
  invoiceNumber: string;
  phase: string;
  trigger: string | null;
  pct: number;
  amount: number;
  estimateName: string;
  clientName: string;
  clientAddress?: string | null;
  fromName?: string | null;
  fromAddress?: string | null;
  invoiceDate?: string | Date | null;
  dueDate: Date | null;
  notes: string | null;
  customBody?: string | null;
  payments?: PaymentEntry[];
  printMode?: boolean;
  divisions?: InvoiceDivisionLine[];
  gcFeeScheduledValue?: number;
}) {
  const due = opts.dueDate ? fmtDate(opts.dueDate) : null;
  const payments = opts.payments ?? [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = opts.amount - totalPaid;

  const fromName = opts.fromName ?? "MIBH Construction";
  const fromAddress = opts.fromAddress ?? "2950 N 28 Terr, Hollywood, FL 33020";

  const divisions = opts.divisions ?? [];
  const gcFeeScheduledValue = opts.gcFeeScheduledValue ?? 0;
  const pct = Number(opts.pct);

  const totalScheduled = divisions.reduce((s, l) => s + l.scheduledValue, 0);
  const grandScheduled = totalScheduled + gcFeeScheduledValue;
  const gcFeeThisInvoice = gcFeeScheduledValue * pct / 100;
  const gcFeeBalance = gcFeeScheduledValue - gcFeeThisInvoice;

  const hasTable = divisions.length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice #${opts.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; }
  .header-bar .title { font-size: 18px; font-weight: 800; color: #C9A84C; }
  .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1px solid #ccc; margin-bottom: 16px; }
  .grid4 > div { padding: 8px 10px; border-right: 1px solid #ccc; }
  .grid4 > div:last-child { border-right: none; }
  .label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
  .value { font-size: 11px; font-weight: 600; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
  th { background: #f5f5f5; padding: 5px 6px; text-align: right; font-size: 9px; font-weight: 700; border: 1px solid #ddd; text-transform: uppercase; }
  th:first-child, th:nth-child(2) { text-align: left; }
  td { padding: 4px 6px; border: 1px solid #eee; text-align: right; vertical-align: middle; }
  td:first-child, td:nth-child(2) { text-align: left; }
  tr:nth-child(even) { background: #fafafa; }
  tfoot td { font-weight: 700; background: #f0f0f0; border-top: 2px solid #ccc; }
  .summary-table td:first-child { color: #555; padding-left: 10px; }
  .summary-table tr.bold td { font-weight: 700; color: #111; }
  .summary-table tr.highlight td { background: #FFF8E7; font-weight: 700; }
  .gold { color: #C9A84C; }
  .section-title { font-size: 11px; font-weight: 700; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
  .box { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 16px; }
  .pay-instructions { background: #fff8ed; border: 1px solid #f59e0b44; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; font-size: 11px; }
  .pay-instructions .pt { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 6px; }
  .pay-row { display: flex; gap: 8px; margin-bottom: 3px; }
  .pay-row .pk { color: #78716c; width: 70px; font-size: 10px; }
  .pay-row .pv { font-weight: 700; }
  .ph-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: #f9fafb; border-radius: 4px; margin-bottom: 3px; font-size: 11px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>

<!-- Header -->
<div class="header-bar">
  <div>
    <div class="title">Invoice #${opts.invoiceNumber}</div>
    <div style="font-size:11px;color:#555;margin-top:2px;">
      ${opts.estimateName}
      ${opts.phase ? ` &nbsp;·&nbsp; ${opts.phase}` : ""}
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#555;">
    ${opts.invoiceDate ? `<div>Invoice Date: <strong>${fmtDate(opts.invoiceDate)}</strong></div>` : ""}
    ${due ? `<div>Due: <strong>${due}</strong></div>` : ""}
    <div style="margin-top:4px;font-size:11px;color:#888;">CGC 1527069 · CCC 1336817</div>
  </div>
</div>

<!-- Parties + Amount Due -->
<div class="grid4" style="margin-bottom:16px;">
  <div>
    <div class="label">Bill To</div>
    <div class="value">${opts.clientName}</div>
    ${opts.clientAddress ? `<div style="font-size:10px;color:#555;white-space:pre-line;margin-top:2px;">${opts.clientAddress}</div>` : ""}
  </div>
  <div>
    <div class="label">From</div>
    <div class="value">${fromName}</div>
    <div style="font-size:10px;color:#555;white-space:pre-line;margin-top:2px;">${fromAddress}</div>
  </div>
  <div>
    <div class="label">Phase</div>
    <div class="value">${opts.phase}</div>
    ${opts.trigger ? `<div style="font-size:10px;color:#555;margin-top:2px;">${opts.trigger}</div>` : ""}
    ${hasTable ? `<div style="font-size:10px;color:#888;margin-top:4px;">${pct}% of scheduled values</div>` : ""}
  </div>
  <div>
    <div class="label">${balance <= 0 ? "Paid in Full" : "Amount Due"}</div>
    <div style="font-size:20px;font-weight:800;color:${balance <= 0 ? "#16a34a" : "#C9A84C"};">$${fmt(balance <= 0 ? 0 : balance)}</div>
    <div style="font-size:10px;color:#888;margin-top:2px;">Invoice Total: $${fmt(opts.amount)}</div>
    ${totalPaid > 0 ? `<div style="font-size:10px;color:#16a34a;margin-top:1px;">Paid: $${fmt(totalPaid)}</div>` : ""}
  </div>
</div>

${hasTable ? `
<!-- Continuation Sheet -->
<div class="section-title" style="margin-bottom:8px;">Schedule of Values — This Invoice</div>
<table>
  <thead>
    <tr>
      <th style="text-align:left;width:70px;">Item #</th>
      <th style="text-align:left;">Description</th>
      <th>Scheduled Value</th>
      <th>This Invoice (${pct}%)</th>
      <th>Balance to Finish</th>
    </tr>
  </thead>
  <tbody>
    ${divisions.map(l => {
      const thisInv = Math.round(l.scheduledValue * pct / 100 * 100) / 100;
      const bal = l.scheduledValue - thisInv;
      return `<tr>
        <td>${l.itemNumber}</td>
        <td>${l.description}</td>
        <td>$${fmt(l.scheduledValue)}</td>
        <td style="font-weight:600;color:#C9A84C;">$${fmt(thisInv)}</td>
        <td>$${fmt(bal)}</td>
      </tr>`;
    }).join("")}
    ${gcFeeScheduledValue > 0 ? `<tr style="color:#888;font-style:italic;">
      <td>GC Fee</td>
      <td>GC Fee (auto)</td>
      <td>$${fmt(gcFeeScheduledValue)}</td>
      <td style="font-weight:700;color:#C9A84C;">$${fmt(gcFeeThisInvoice)}</td>
      <td>$${fmt(gcFeeBalance)}</td>
    </tr>` : ""}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2">TOTALS</td>
      <td>$${fmt(grandScheduled)}</td>
      <td style="color:#C9A84C;">$${fmt(opts.amount)}</td>
      <td>$${fmt(grandScheduled - opts.amount)}</td>
    </tr>
  </tfoot>
</table>
` : ""}

${payments.length > 0 ? `
<div class="section-title">Payment History</div>
<div style="margin-bottom:16px;">
  ${payments.map(p => {
    const d = fmtDate(p.paidDate);
    return `<div class="ph-row"><div><strong>$${fmt(p.amount)}</strong> <span style="color:#6b7280;font-size:10px;">via ${p.method}${p.notes ? ` · ${p.notes}` : ""}</span></div><span style="font-size:10px;color:#6b7280;">${d}</span></div>`;
  }).join("")}
  <div style="display:flex;justify-content:space-between;padding:6px 8px;border-radius:4px;background:${balance <= 0 ? "#f0fdf4" : "#fef2f2"};margin-top:4px;">
    <span style="font-weight:700;font-size:11px;color:${balance <= 0 ? "#16a34a" : "#dc2626"};">${balance <= 0 ? "✓ Paid in Full" : "Balance Due"}</span>
    <span style="font-weight:700;font-size:13px;color:${balance <= 0 ? "#16a34a" : "#dc2626"};">${balance <= 0 ? "$0.00" : `$${fmt(balance)}`}</span>
  </div>
</div>
` : ""}

${opts.notes ? `<div style="font-size:11px;background:#f9fafb;padding:8px 10px;border-radius:4px;margin-bottom:14px;"><strong>Notes:</strong> ${opts.notes}</div>` : ""}

<!-- Payment Instructions -->
<div class="pay-instructions">
  <div class="pt">Payment Instructions</div>
  <div class="pay-row"><span class="pk">Zelle</span><span class="pv">mikebaruh@gmail.com</span></div>
  <div class="pay-row"><span class="pk">Phone</span><span class="pv">305-746-7307</span></div>
  <div class="pay-row"><span class="pk">Check</span><span class="pv">Payable to MIBH Construction</span></div>
  <div style="font-size:10px;color:#92400e;margin-top:6px;">Please include Invoice #${opts.invoiceNumber} in the payment memo.</div>
</div>

<div style="font-size:10px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:10px;text-align:center;">
  MIBH Construction · CGC 1527069 | CCC 1336817 · Licensed &amp; Insured · State of Florida
</div>

</body>
</html>`;
}
