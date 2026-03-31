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

function buildInvoiceHtml(opts: {
  invoiceNumber: string;
  phase: string;
  trigger: string | null;
  pct: number;
  amount: number;
  estimateName: string;
  clientName: string;
  dueDate: Date | null;
  notes: string | null;
}) {
  const due = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${opts.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; max-width: 640px; margin: 0 auto; padding: 40px 20px; }
  .header { background: #0d1117; color: #e6edf3; padding: 28px 32px; border-radius: 10px 10px 0 0; }
  .header h1 { margin: 0 0 4px; font-size: 22px; color: #C9A84C; }
  .header p { margin: 0; font-size: 13px; color: #8b949e; }
  .body { border: 1px solid #e5e7eb; border-top: none; padding: 28px 32px; border-radius: 0 0 10px 10px; }
  .amount-box { background: #f9fafb; border: 2px solid #C9A84C; border-radius: 8px; padding: 20px 24px; margin: 20px 0; text-align: center; }
  .amount-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 6px; }
  .amount-box .amount { font-size: 36px; font-weight: 700; font-family: monospace; color: #111; }
  .amount-box .pct { font-size: 13px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; width: 140px; }
  td:last-child { font-weight: 600; }
  .footer { font-size: 12px; color: #9ca3af; margin-top: 28px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Invoice #${opts.invoiceNumber}</h1>
    <p>${opts.estimateName}</p>
  </div>
  <div class="body">
    <p>Dear ${opts.clientName},</p>
    <p>Please find below your invoice for the <strong>${opts.phase}</strong> phase of your project.</p>

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

    ${opts.notes ? `<p style="font-size:13px;color:#374151"><strong>Notes:</strong> ${opts.notes}</p>` : ""}

    <p style="font-size:13px;color:#374151">Please remit payment upon receipt. If you have any questions regarding this invoice, don't hesitate to contact us.</p>

    <p style="margin-top:28px;font-size:13px">Best regards,<br>
    <strong>MIBH Construction</strong><br>
    <a href="mailto:mikebaruh@gmail.com" style="color:#C9A84C">mikebaruh@gmail.com</a></p>

    <div class="footer">MIBH Construction · CGC1527069 | CCC1336817 · Licensed &amp; Insured · Florida</div>
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
  const { to, cc, subject, bodyText } = body as { to: string; cc?: string; subject: string; bodyText?: string };

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
    amount: invoice.amount,
    estimateName: invoice.estimate.name,
    clientName: invoice.client.name,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
  });

  // Build MIME message
  const boundary = "inv_boundary_mibh";
  const mime = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    bodyText ?? `Invoice #${invoice.invoiceNumber} — ${invoice.phase} — $${invoice.amount.toFixed(2)}`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    `--${boundary}--`,
  ]
    .filter((l) => l !== undefined)
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
