import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf, InvoicePdfLine } from "@/lib/invoicePdf";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

function sanitizeSubject(s: string): string {
  return s
    .replace(/[—–]/g, " - ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?");
}

function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.7;margin:0;padding:16px 0;">${paragraphs}</body></html>`;
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

  const [invoice, company] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: params.invoiceId, companyId: params.companyId },
      include: {
        client: true,
        estimate: {
          include: {
            divisions: {
              where: { archivedAt: null },
              orderBy: { sortOrder: "asc" },
              include: {
                groups: {
                  where: { archivedAt: null },
                  orderBy: { sortOrder: "asc" },
                  include: { items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
                },
                items: { where: { archivedAt: null, groupId: null }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        payments: { orderBy: { paidDate: "asc" } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!invoice || !company) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Build division lines for the PDF
  function itemTotal(item: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }): number {
    const qty = Number(item.defaultQty ?? 0);
    const cost = Number(item.defaultUnitCost ?? 0);
    const markup = Number(item.defaultMarkupPct ?? 0);
    return qty * cost * (1 + markup / 100);
  }

  let pdfDivisions: InvoicePdfLine[];
  let gcFeeScheduledValue = 0;

  if (invoice.lines.length > 0) {
    const divMap = new Map<string, string>();
    invoice.estimate.divisions.forEach((d, i) => {
      const code = d.csiCode ? d.csiCode.slice(0, 2).padStart(2, "0") : String(i + 1).padStart(2, "0");
      divMap.set(code, d.name);
    });
    const withHeaders: InvoicePdfLine[] = [];
    let lastDivCode: string | null = null;
    for (const l of invoice.lines) {
      const rawNum = l.itemNumber;
      const divCode = rawNum.includes(".") ? rawNum.split(".")[0].padStart(2, "0") : null;
      if (divCode && divCode !== lastDivCode && divMap.has(divCode)) {
        withHeaders.push({ isDivisionHeader: true, itemNumber: `DIV ${divCode}`, description: divMap.get(divCode)!, scheduledValue: 0 });
        lastDivCode = divCode;
      }
      withHeaders.push({
        itemNumber: rawNum,
        description: l.description,
        scheduledValue: Number(l.scheduledValue),
        fromPrevious: Number(l.fromPrevious),
        thisInvoice: Number(l.thisInvoice),
        pctThisInvoice: Number(l.pctThisInvoice),
      });
    }
    pdfDivisions = withHeaders;
  } else {
    const rawDivisions = invoice.estimate.divisions.map((d, i) => {
      const rawCode = d.csiCode ? d.csiCode.slice(0, 2).trim() : null;
      const itemNumber = rawCode ? `Div ${rawCode}` : `Div ${i + 1}`;
      const total = d.manualTotal !== null && d.manualTotal !== undefined
        ? Number(d.manualTotal)
        : [...d.items, ...d.groups.flatMap(g => g.items)].reduce((s, it) => s + itemTotal(it), 0);
      return { itemNumber, description: d.name, scheduledValue: total };
    }).filter(l => l.scheduledValue > 0);
    if (invoice.estimate.gcFeePercent) {
      const rawTotal = rawDivisions.reduce((s, l) => s + l.scheduledValue, 0);
      gcFeeScheduledValue = Math.round(rawTotal * Number(invoice.estimate.gcFeePercent) / 100 * 100) / 100;
    }
    pdfDivisions = rawDivisions;
  }

  const clientAddress = [
    invoice.client.address,
    invoice.client.city && invoice.client.state
      ? `${invoice.client.city}, ${invoice.client.state} ${invoice.client.zip ?? ""}`.trim()
      : null,
  ].filter(Boolean).join("\n");

  // Generate invoice PDF
  const invoicePdf = await renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    phase: invoice.phase,
    trigger: invoice.trigger,
    pct: Number(invoice.pct),
    amount: Number(invoice.amount),
    estimateName: invoice.estimate.name,
    clientName: invoice.client.name,
    clientAddress: clientAddress || null,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    payments: invoice.payments.map(p => ({ amount: Number(p.amount), method: p.method, paidDate: p.paidDate, notes: p.notes })),
    divisions: pdfDivisions,
    gcFeeScheduledValue,
    fromAddress: company.address ?? undefined,
  });

  const clientSlug = invoice.client.name.replace(/[^a-z0-9]/gi, "-");
  const phaseSlug = invoice.phase.replace(/[^a-z0-9]/gi, "-");
  const pdfFilename = `Invoice-${invoice.invoiceNumber}-${phaseSlug}-${invoice.pct}pct-${clientSlug}.pdf`;
  const pdfBase64 = invoicePdf.toString("base64");

  // Email body — compose text only, invoice details are in the PDF
  const plainText = bodyText ?? "";
  const htmlBody = bodyText ? bodyToHtml(bodyText) : "<html><body></body></html>";

  const outerBoundary = `----=_Mixed_${Date.now()}`;
  const innerBoundary = `----=_Alt_${Date.now()}`;

  const plainB64 = Buffer.from(plainText, "utf-8").toString("base64");
  const htmlB64 = Buffer.from(htmlBody, "utf-8").toString("base64");

  const mime = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${sanitizeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    "",
    `--${outerBoundary}`,
    `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
    "",
    `--${innerBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    plainB64,
    "",
    `--${innerBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    "",
    `--${innerBoundary}--`,
    "",
    `--${outerBoundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    "",
    pdfBase64,
    "",
    `--${outerBoundary}--`,
  ].join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");

  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });

    const fromProfile = await gmail.users.getProfile({ userId: "me" }).catch(() => null);
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
        attachments: JSON.stringify([pdfFilename]),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = String(e);
    console.error("Invoice send error:", msg);
    if (msg.includes("invalid_grant") || msg.includes("Invalid Credentials")) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
