function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type PaymentEntry = { amount: number; method: string; paidDate: Date | string; notes?: string | null };

export function buildInvoiceHtml(opts: {
  invoiceNumber: string;
  phase: string;
  trigger: string | null;
  pct: number;
  amount: number;
  estimateName: string;
  clientName: string;
  dueDate: Date | null;
  notes: string | null;
  customBody?: string | null;
  payments?: PaymentEntry[];
}) {
  const due = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const payments = opts.payments ?? [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = opts.amount - totalPaid;

  const intro = opts.customBody
    ? opts.customBody.replace(/\n/g, "<br>")
    : `Dear ${opts.clientName},<br><br>Please find below your invoice for the <strong>${opts.phase}</strong> phase of your project with MIBH Construction. We appreciate your business and look forward to completing this project to your satisfaction.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice #${opts.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; max-width: 660px; margin: 0 auto; padding: 40px 20px; }
  .header { background: #0d1117; color: #e6edf3; padding: 28px 32px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { margin: 0 0 4px; font-size: 22px; color: #C9A84C; }
  .header p { margin: 0; font-size: 13px; color: #8b949e; }
  .header .logo { font-size: 11px; text-align: right; color: #8b949e; line-height: 1.6; }
  .body { border: 1px solid #e5e7eb; border-top: none; padding: 28px 32px; border-radius: 0 0 10px 10px; }
  .amount-box { background: #f9fafb; border: 2px solid #C9A84C; border-radius: 8px; padding: 20px 24px; margin: 20px 0; text-align: center; }
  .amount-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 6px; }
  .amount-box .amount { font-size: 36px; font-weight: 700; font-family: monospace; color: #111; }
  .amount-box .pct { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .balance-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 14px 20px; margin: 12px 0; display: flex; justify-content: space-between; align-items: center; }
  .balance-box .bl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #15803d; }
  .balance-box .bv { font-size: 24px; font-weight: 700; font-family: monospace; color: #15803d; }
  .payment-history { margin: 16px 0; }
  .payment-history .ph-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 8px; }
  .ph-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 6px; background: #f9fafb; margin-bottom: 4px; font-size: 13px; }
  .ph-row .ph-meta { color: #6b7280; font-size: 11px; }
  .zelle-box { background: #fff8ed; border: 1px solid #f59e0b44; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .zelle-box .zt { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #92400e; margin-bottom: 8px; }
  .zelle-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 4px; }
  .zelle-row .zk { color: #78716c; width: 80px; font-size: 12px; }
  .zelle-row .zv { font-weight: 700; color: #111; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; width: 140px; }
  td:last-child { font-weight: 600; }
  .sig { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 13px; line-height: 1.7; }
  .sig strong { font-size: 14px; }
  .footer { font-size: 11px; color: #9ca3af; margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 12px; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice #${opts.invoiceNumber}</h1>
      <p>${opts.estimateName}</p>
    </div>
    <div class="logo">
      MIBH Construction<br>
      CGC 1527069 | CCC 1336817<br>
      Hollywood, FL
    </div>
  </div>
  <div class="body">
    <p style="font-size:14px;line-height:1.6">${intro}</p>

    <div class="amount-box">
      <div class="label">Invoice Amount</div>
      <div class="amount">$${fmt(opts.amount)}</div>
      <div class="pct">${opts.pct}% of project total</div>
    </div>

    ${payments.length > 0 ? `
    <div class="payment-history">
      <div class="ph-title">Payments Received</div>
      ${payments.map(p => {
        const d = new Date(p.paidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `<div class="ph-row"><div><span style="font-weight:600;color:#111">$${fmt(p.amount)}</span> <span class="ph-meta">via ${p.method}${p.notes ? ` · ${p.notes}` : ""}</span></div><span class="ph-meta">${d}</span></div>`;
      }).join("")}
    </div>
    <div class="balance-box">
      <span class="bl">${balance <= 0 ? "Paid in Full" : "Balance Due"}</span>
      <span class="bv" style="${balance <= 0 ? "" : "color:#dc2626"}">${balance <= 0 ? "✓ $0.00" : `$${fmt(balance)}`}</span>
    </div>
    ` : ""}

    <table>
      <tr><td>Invoice #</td><td>${opts.invoiceNumber}</td></tr>
      <tr><td>Phase</td><td>${opts.phase}</td></tr>
      ${opts.trigger ? `<tr><td>Milestone</td><td>${opts.trigger}</td></tr>` : ""}
      ${due ? `<tr><td>Due Date</td><td>${due}</td></tr>` : ""}
      ${payments.length > 0 ? `<tr><td>Total Paid</td><td style="color:#16a34a;font-weight:700">$${fmt(totalPaid)}</td></tr>` : ""}
      ${payments.length > 0 && balance > 0 ? `<tr><td>Balance Due</td><td style="color:#dc2626;font-weight:700">$${fmt(balance)}</td></tr>` : ""}
    </table>

    ${opts.notes ? `<p style="font-size:13px;color:#374151;background:#f9fafb;padding:10px 14px;border-radius:6px"><strong>Notes:</strong> ${opts.notes}</p>` : ""}

    <div class="zelle-box">
      <div class="zt">Payment Instructions</div>
      <div class="zelle-row"><span class="zk">Zelle</span><span class="zv">mikebaruh@gmail.com</span></div>
      <div class="zelle-row"><span class="zk">Phone</span><span class="zv">305-746-7307</span></div>
      <div class="zelle-row"><span class="zk">Check</span><span class="zv">Payable to MIBH Construction</span></div>
      <p style="font-size:11px;color:#92400e;margin:8px 0 0">Please include Invoice #${opts.invoiceNumber} in the payment memo.</p>
    </div>

    <div class="sig">
      Best regards,<br>
      <strong>Mike Baruh</strong><br>
      Founder/CEO · MIBH Construction<br>
      Certified &amp; Licensed General Contractor CGC 1527069<br>
      Certified &amp; Licensed Roofer CCC 1336817<br>
      📱 305.746.7307 &nbsp;·&nbsp;
      📧 <a href="mailto:mike@mibhconstruction.com" style="color:#C9A84C">mike@mibhconstruction.com</a><br>
      📍 2950 N 28 Terr, Hollywood, FL 33020 &nbsp;·&nbsp;
      🌐 <a href="https://www.mibhconstruction.com" style="color:#C9A84C">mibhconstruction.com</a>
    </div>

    <div class="footer">MIBH Construction · CGC 1527069 | CCC 1336817 · Licensed &amp; Insured · State of Florida</div>
  </div>
</body>
</html>`;
}
