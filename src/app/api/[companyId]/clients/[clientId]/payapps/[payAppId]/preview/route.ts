import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const $$ = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; payAppId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = await prisma.payApp.findUnique({
    where: { id: params.payAppId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = p.lines.map(l => ({
    itemNumber: l.itemNumber,
    description: l.description,
    scheduledValue: Number(l.scheduledValue),
    fromPrevious: Number(l.fromPrevious),
    thisInvoice: Number(l.thisInvoice),
    retainageThis: Number(l.retainageThis),
    retainageTotal: Number(l.retainageTotal),
  }));

  const coAdditions = Number(p.coAdditionsPrev) + Number(p.coAdditionsThis);
  const coDeductions = Number(p.coDeductionsPrev) + Number(p.coDeductionsThis);
  const netChanges = coAdditions - coDeductions;
  const contractSumToDate = Number(p.originalContractSum) + netChanges;
  const gcFeeScheduledValue = Number(p.gcFeeScheduledValue);
  const totalScheduled = lines.reduce((s, l) => s + l.scheduledValue, 0);
  const totalFromPrevious = lines.reduce((s, l) => s + l.fromPrevious, 0);
  const totalThisInvoice = lines.reduce((s, l) => s + l.thisInvoice, 0);
  const pctPrevious = totalScheduled > 0 ? totalFromPrevious / totalScheduled : 0;
  const pctThisInv = totalScheduled > 0 ? totalThisInvoice / totalScheduled : 0;
  const gcFeePrevious = gcFeeScheduledValue * pctPrevious;
  const gcFeeThisInvoice = gcFeeScheduledValue * pctThisInv;
  const gcFeeBalance = gcFeeScheduledValue - gcFeePrevious - gcFeeThisInvoice;
  const totalCompleted = (totalFromPrevious + totalThisInvoice) + gcFeePrevious + gcFeeThisInvoice;
  const retainageAll = lines.reduce((s, l) => s + l.retainageTotal, 0);
  const totalEarnedLessRetainage = totalCompleted - retainageAll;
  const currentPaymentDue = totalEarnedLessRetainage - Number(p.lessPreviousInvoices);
  const balanceToFinish = (contractSumToDate + gcFeeScheduledValue) - totalEarnedLessRetainage;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pay App #${p.payAppNumber}${p.invoiceNumber ? ` — Invoice #${p.invoiceNumber}` : ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .header-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #C9A84C; padding-bottom: 10px; }
  .header-bar .title { font-size: 18px; font-weight: 800; color: #C9A84C; }
  .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1px solid #ccc; margin-bottom: 16px; }
  .grid4 > div { padding: 8px 10px; border-right: 1px solid #ccc; }
  .grid4 > div:last-child { border-right: none; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
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
  .box { border: 1px solid #ddd; border-radius: 4px; padding: 12px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
<div class="header-bar">
  <div>
    <div class="title">AIA Pay Application #${p.payAppNumber}</div>
    <div style="font-size:11px;color:#555;margin-top:2px;">
      ${p.invoiceNumber ? `Invoice #${p.invoiceNumber} &nbsp;·&nbsp; ` : ""}
      ${p.projectName || ""}
      ${p.projectNumber ? ` &nbsp;·&nbsp; Project #${p.projectNumber}` : ""}
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#555;">
    <div>Invoice Date: <strong>${fmtDate(p.invoiceDate)}</strong></div>
    <div>Payment Due: <strong>${fmtDate(p.paymentDue)}</strong></div>
    ${p.periodStart ? `<div>Period: <strong>${fmtDate(p.periodStart)} – ${fmtDate(p.periodEnd)}</strong></div>` : ""}
  </div>
</div>

<!-- Parties -->
<div class="grid4" style="margin-bottom:16px;">
  <div>
    <div class="label">Submitted To</div>
    <div class="value">${p.toName || "—"}</div>
    ${p.toContact ? `<div style="font-size:10px;color:#555;">${p.toContact}</div>` : ""}
    ${p.toAddress ? `<div style="font-size:10px;color:#555;white-space:pre-line;">${p.toAddress}</div>` : ""}
  </div>
  <div>
    <div class="label">From</div>
    <div class="value">${p.fromName || "—"}</div>
    ${p.fromContact ? `<div style="font-size:10px;color:#555;">${p.fromContact}</div>` : ""}
    ${p.fromAddress ? `<div style="font-size:10px;color:#555;white-space:pre-line;">${p.fromAddress}</div>` : ""}
  </div>
  <div>
    <div class="label">Distribute To</div>
    ${p.distributeOwner ? `<div style="font-size:10px;">☑ Owner</div>` : ""}
    ${p.distributeArchitect ? `<div style="font-size:10px;">☑ Architect</div>` : ""}
    ${p.distributeContractor ? `<div style="font-size:10px;">☑ Contractor</div>` : ""}
  </div>
  <div>
    <div class="label">Current Payment Due</div>
    <div style="font-size:20px;font-weight:800;color:#C9A84C;">$${$$(currentPaymentDue)}</div>
  </div>
</div>

<!-- Financial Summary — full width -->
<div class="box" style="margin-bottom:16px;">
  <div class="section-title">Application for Payment</div>
  <table class="summary-table">
    <tbody>
      <tr><td>1. Original Contract Sum</td><td style="text-align:right;font-weight:600;">$${$$(Number(p.originalContractSum))}</td></tr>
      <tr><td>2. GC Fee (Scheduled)</td><td style="text-align:right;">$${$$(gcFeeScheduledValue)}</td></tr>
      <tr><td>3. Net Changes by Change Orders</td><td style="text-align:right;">$${$$(netChanges)}</td></tr>
      <tr class="bold"><td>4. Contract Sum to Date</td><td style="text-align:right;">$${$$(contractSumToDate + gcFeeScheduledValue)}</td></tr>
      <tr><td>5. Total Completed (incl. GC Fee)</td><td style="text-align:right;">$${$$(totalCompleted)}</td></tr>
      <tr><td>&nbsp;&nbsp;GC Fee This Invoice</td><td style="text-align:right;">$${$$(gcFeeThisInvoice)}</td></tr>
      <tr><td>6. Total Retainage</td><td style="text-align:right;">$${$$(retainageAll)}</td></tr>
      <tr class="bold"><td>7. Total Earned Less Retainage</td><td style="text-align:right;">$${$$(totalEarnedLessRetainage)}</td></tr>
      <tr><td>8. Less Previous Invoices</td><td style="text-align:right;">$${$$(Number(p.lessPreviousInvoices))}</td></tr>
      <tr class="highlight"><td><strong>9. Current Payment Due</strong></td><td style="text-align:right;color:#C9A84C;font-size:13px;"><strong>$${$$(currentPaymentDue)}</strong></td></tr>
      <tr><td>10. Balance to Finish</td><td style="text-align:right;">$${$$(balanceToFinish)}</td></tr>
    </tbody>
  </table>
</div>

<!-- Continuation Sheet -->
<div class="section-title" style="margin-top:8px;">Continuation Sheet — Schedule of Values</div>
<table>
  <thead>
    <tr>
      <th style="text-align:left;width:70px;">Item #</th>
      <th style="text-align:left;">Description</th>
      <th>Scheduled Value</th>
      <th>From Previous</th>
      <th>This Invoice</th>
      <th>Balance to Finish</th>
      <th>Retainage This</th>
      <th>Retainage Total</th>
    </tr>
  </thead>
  <tbody>
    ${lines.map(l => {
      const balance = l.scheduledValue - (l.fromPrevious + l.thisInvoice);
      return `<tr>
        <td>${l.itemNumber}</td>
        <td>${l.description}</td>
        <td>$${$$(l.scheduledValue)}</td>
        <td>$${$$(l.fromPrevious)}</td>
        <td>$${$$(l.thisInvoice)}</td>
        <td>$${$$(balance)}</td>
        <td>$${$$(l.retainageThis)}</td>
        <td>$${$$(l.retainageTotal)}</td>
      </tr>`;
    }).join("")}
    ${gcFeeScheduledValue > 0 ? `<tr style="color:#888;font-style:italic;">
      <td>GC Fee</td>
      <td>GC Fee (auto)</td>
      <td>$${$$(gcFeeScheduledValue)}</td>
      <td>$${$$(gcFeePrevious)}</td>
      <td><strong>$${$$(gcFeeThisInvoice)}</strong></td>
      <td>$${$$(gcFeeBalance)}</td>
      <td>—</td>
      <td>—</td>
    </tr>` : ""}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2">TOTALS</td>
      <td>$${$$(totalScheduled + gcFeeScheduledValue)}</td>
      <td>$${$$(totalFromPrevious + gcFeePrevious)}</td>
      <td>$${$$(totalThisInvoice + gcFeeThisInvoice)}</td>
      <td>$${$$(lines.reduce((s, l) => s + (l.scheduledValue - (l.fromPrevious + l.thisInvoice)), 0) + gcFeeBalance)}</td>
      <td>$${$$(lines.reduce((s, l) => s + l.retainageThis, 0))}</td>
      <td>$${$$(lines.reduce((s, l) => s + l.retainageTotal, 0))}</td>
    </tr>
  </tfoot>
</table>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
