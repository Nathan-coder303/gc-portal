import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml } from "@/lib/invoiceHtml";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

export const runtime = "nodejs";
export const maxDuration = 30;


function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function sanitizeSubject(s: string): string {
  return s
    .replace(/[—–]/g, " - ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?");
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
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!invoice || !company) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

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

  // Generate estimate PDF (no cover, no presentation pages — just the line items)
  const divisions = invoice.estimate.divisions.map((d) => ({
    id: d.id,
    csiCode: d.csiCode,
    name: d.name,
    manualTotal: d.manualTotal ? Number(d.manualTotal) : null,
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        detail: i.detail,
        unit: i.unit,
        csiCode: i.csiCode ?? null,
        defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
        defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
        defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
        visibleInPdf: i.visibleInPdf,
        notes: i.notes,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      detail: i.detail,
      unit: i.unit,
      csiCode: i.csiCode ?? null,
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      visibleInPdf: i.visibleInPdf,
      notes: i.notes,
    })),
  }));

  const estimatePdf = await renderTemplatePdf({
    companyName: company.name,
    branding: {
      name: company.name || undefined,
      address: company.address || undefined,
      phone: company.phone || undefined,
      email: company.email || undefined,
      licenses: company.licenses || undefined,
      tagline: company.tagline || undefined,
      website: company.website || undefined,
      contactName: company.contactName || undefined,
    },
    template: {
      name: invoice.estimate.name,
      description: invoice.estimate.description,
      estimateNumber: invoice.estimate.estimateNumber,
      estimateDate: invoice.estimate.estimateDate,
    },
    client: {
      name: invoice.client.name,
      address: invoice.client.address,
      city: invoice.client.city,
      state: invoice.client.state,
      zip: invoice.client.zip,
      phone: invoice.client.phone,
      email: invoice.client.email,
    },
    divisions,
    showTerms: false,
    paymentSchedule: null,
    gcFeePercent: invoice.estimate.gcFeePercent ? Number(invoice.estimate.gcFeePercent) : null,
    summaryGroups: null,
    includeCoverPage: false,
    includeRoofUpgradesPage: false,
    includeAdditionPages: false,
    includeRetailPages: false,
    insulationType: invoice.estimate.insulationType ?? "ISO",
    clientCoverPhotoType: null,
    clientCoverPhotoUrl: null,
    clientCoverTitle: null,
    progressPaymentPct: Number(invoice.pct),
    progressPaymentPhase: invoice.phase,
  });

  const clientSlug = invoice.client.name.replace(/[^a-z0-9]/gi, "-");
  const phaseSlug = invoice.phase.replace(/[^a-z0-9]/gi, "-");
  const pdfFilename = `Invoice-${invoice.invoiceNumber}-${phaseSlug}-${invoice.pct}pct-${clientSlug}.pdf`;
  const pdfBase64 = estimatePdf.toString("base64");

  // Build MIME: multipart/mixed wrapping (HTML body + PDF attachment)
  const outerBoundary = `----=_Mixed_${Date.now()}`;
  const innerBoundary = `----=_Alt_${Date.now()}`;

  const mime = [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${sanitizeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    "",
    // ── Body (plain + HTML) ──
    `--${outerBoundary}`,
    `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
    "",
    `--${innerBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    `Invoice #${invoice.invoiceNumber} - ${invoice.phase} - $${Number(invoice.amount).toFixed(2)}\r\n\r\nZelle: mikebaruh@gmail.com | Phone: 305-746-7307`,
    "",
    `--${innerBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    html,
    "",
    `--${innerBoundary}--`,
    "",
    // ── Estimate PDF attachment ──
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
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "SENT", sentAt: new Date() },
    });

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
        attachments: JSON.stringify([pdfFilename]),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Invoice send error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
