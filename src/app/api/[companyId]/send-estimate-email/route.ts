import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { insertClientPageIntoEstimate } from "@/lib/estimates/insertClientPage";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_PAYMENT_SCHEDULE = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// GET — returns the authenticated Gmail address and default signature for the modal
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const [profile, sendAsList] = await Promise.all([
      gmail.users.getProfile({ userId: "me" }),
      gmail.users.settings.sendAs.list({ userId: "me" }),
    ]);

    const fromEmail = profile.data.emailAddress ?? "";
    // Find the default (primary) send-as entry for its signature
    const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
    // Strip HTML tags from signature for plain-text use
    const rawSignature = defaultSendAs?.signature ?? "";
    const plainSignature = rawSignature
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

    return NextResponse.json({ fromEmail, signature: plainSignature });
  } catch (err) {
    console.error("Gmail profile fetch error:", err);
    return NextResponse.json({ fromEmail: "", signature: "" });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { templateId, to, cc, bcc, subject, body: emailBody } = body as {
    templateId?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
  };

  if (!templateId || !to || !subject || !emailBody) {
    return NextResponse.json(
      { error: "templateId, to, subject, and body are required" },
      { status: 400 }
    );
  }

  const [template, company] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: templateId, companyId: params.companyId, archivedAt: null },
      include: {
        client: true,
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
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!template || !company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const divisions = template.divisions.map((d) => ({
    id: d.id,
    csiCode: d.csiCode,
    name: d.name,
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        detail: i.detail,
        unit: i.unit,
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
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      visibleInPdf: i.visibleInPdf,
      notes: i.notes,
    })),
  }));

  const buffer = await renderTemplatePdf({
    companyName: company.name,
    template: {
      name: template.name,
      description: template.description,
      estimateNumber: template.estimateNumber,
      estimateDate: template.estimateDate,
    },
    client: template.client
      ? {
          name: template.client.name,
          address: template.client.address,
          city: template.client.city,
          state: template.client.state,
          zip: template.client.zip,
          phone: template.client.phone,
          email: template.client.email,
        }
      : null,
    divisions,
    showTerms: true,
    termsContent: template.termsContent,
    paymentSchedule:
      (template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null) ??
      DEFAULT_PAYMENT_SCHEDULE,
    gcFeePercent: template.gcFeePercent ? Number(template.gcFeePercent) : null,
    summaryGroups:
      (template.summaryGroups as Record<
        string,
        { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null }
      > | null) ?? null,
    includeRoofUpgradesPage: template.name.toLowerCase().includes("roof"),
    includeAdditionPages: template.name.toLowerCase().includes("addition"),
    includeCoverPage: true,
    insulationType: template.insulationType ?? "ISO",
  });

  // Insert client's marked PDF page 2 as page 3 (roofing only)
  let finalBuffer = buffer;
  if (template.name.toLowerCase().includes("roof") && template.client) {
    const insertFile = await prisma.clientFile.findFirst({
      where: { clientId: template.client.id, useInEstimate: true },
      select: { fileUrl: true },
    });
    finalBuffer = await insertClientPageIntoEstimate(buffer, insertFile?.fileUrl);
  }

  // Generate (or reuse) a signature token for this estimate
  let signToken = template.signatureToken;
  if (!signToken) {
    signToken = crypto.randomBytes(32).toString("hex");
    await prisma.estimateTemplate.update({
      where: { id: templateId },
      data: { signatureToken: signToken },
    });
  }
  const signUrl = `https://portal.mibhconstruction.com/sign/${signToken}`;
  const fullEmailBody = `${emailBody}\n\n---\nSign your estimate here: ${signUrl}`;

  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Use the actual authenticated Gmail address as From
  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  const boundary = `----=_Part_${Date.now()}`;
  const clientSlug = template.client ? `-for-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
  const estimateSlug = template.estimateNumber ? `Estimate-${template.estimateNumber}` : template.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `${estimateSlug}${clientSlug}.pdf`;
  const pdfBase64 = finalBuffer.toString("base64");

  // RFC 2047 encode subject to handle non-ASCII characters (em dash, accents, etc.)
  const encodedSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    fullEmailBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    pdfBase64,
    `--${boundary}--`,
  ];
  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { lastSentAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
