import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

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

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { templateId, to, subject, body: emailBody } = body as {
    templateId?: string;
    to?: string;
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
        }
      : null,
    divisions,
    showTerms: template.showTerms,
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
  });

  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const boundary = `----=_Part_${Date.now()}`;
  const filename = `${template.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-estimate.pdf`;
  const pdfBase64 = buffer.toString("base64");

  const mimeLines = [
    `From: mike@mibhconstruction.com`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    emailBody,
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

  return NextResponse.json({ success: true });
}
