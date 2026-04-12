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

  // Encode subject for non-ASCII characters (RFC 2047)
  function encodeSubject(s: string): string {
    if (/^[\x20-\x7E]*$/.test(s)) return s;
    return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
  }

  // Build MIME message — keep blank lines as MIME section separators
  const boundary = "inv_boundary_mibh";
  const mime = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeSubject(subject)}`,
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

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
