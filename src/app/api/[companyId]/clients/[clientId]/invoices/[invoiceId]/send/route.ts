import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml } from "@/lib/invoiceHtml";

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
      payments: { orderBy: { paidDate: "asc" } },
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
    payments: invoice.payments.map(p => ({ amount: p.amount, method: p.method, paidDate: p.paidDate, notes: p.notes })),
  });

  // Sanitize subject: replace typographic dashes/quotes with ASCII equivalents
  function sanitizeSubject(s: string): string {
    return s
      .replace(/[\u2014\u2013]/g, " - ")   // em-dash / en-dash → " - "
      .replace(/[\u2018\u2019]/g, "'")      // smart apostrophes
      .replace(/[\u201C\u201D]/g, '"')      // smart quotes
      .replace(/[^\x20-\x7E]/g, "?");       // anything else non-ASCII → ?
  }

  // Build MIME message — keep blank lines as MIME section separators
  const boundary = "inv_boundary_mibh";
  const mime = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${sanitizeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    `Invoice #${invoice.invoiceNumber} - ${invoice.phase} - $${Number(invoice.amount).toFixed(2)}\r\n\r\nZelle: mikebaruh@gmail.com | Phone: 305-746-7307`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });

    // Log to Communications
    const fromProfile = await google.gmail({ version: "v1", auth: getOAuthClient() }).users.getProfile({ userId: "me" }).catch(() => null);
    await prisma.clientEmail.create({
      data: {
        clientId: params.clientId,
        companyId: params.companyId,
        fromEmail: fromProfile?.data.emailAddress ?? "",
        to,
        cc: cc ?? null,
        bcc: bcc ?? null,
        subject: subject ?? `Invoice #${invoice.invoiceNumber}`,
        body: bodyText ?? "",
        sentBy: session.user?.name ?? session.user?.email ?? null,
        context: "invoice",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
