import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
}) {
  const due = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

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
      <div class="label">Amount Due</div>
      <div class="amount">$${fmt(opts.amount)}</div>
      <div class="pct">${opts.pct}% of project total</div>
    </div>

    <table>
      <tr><td>Invoice #</td><td>${opts.invoiceNumber}</td></tr>
      <tr><td>Phase</td><td>${opts.phase}</td></tr>
      ${opts.trigger ? `<tr><td>Milestone</td><td>${opts.trigger}</td></tr>` : ""}
      ${due ? `<tr><td>Due Date</td><td>${due}</td></tr>` : ""}
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

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { to, cc, bcc, subject, bodyText } = body as { to: string; cc?: string; bcc?: string; subject: string; bodyText?: string };

  if (!to) return NextResponse.json({ error: "Recipient required" }, { status: 400 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, companyId: params.companyId },
    include: {
      client: { select: { name: true } },
      estimate: { select: { name: true, estimateNumber: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    phase: invoice.phase,
    trigger: invoice.trigger,
    pct: invoice.pct,
    amount: Number(invoice.amount),
    estimateName: invoice.estimate.name,
    clientName: invoice.client.name,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    customBody: bodyText ?? null,
  });

  // Build MIME message
  const boundary = "inv_boundary_mibh";
  const mime = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    bcc ? `Bcc: ${bcc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    `Invoice #${invoice.invoiceNumber} — ${invoice.phase} — $${Number(invoice.amount).toFixed(2)}\n\nZelle: mikebaruh@gmail.com | Phone: 305-746-7307`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    `--${boundary}--`,
  ]
    .filter((l) => l !== undefined && l !== "")
    .join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
