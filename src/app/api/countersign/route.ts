import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";
import { put } from "@vercel/blob";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { insertClientPageIntoEstimate } from "@/lib/estimates/insertClientPage";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_PAYMENT_SCHEDULE = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

async function resolvePrivateCoverUrl(blobUrl: string | null): Promise<string | null> {
  if (!blobUrl) return null;
  try {
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const mt = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mt};base64,${Buffer.from(ab).toString("base64")}`;
  } catch {
    return null;
  }
}


// GET /api/countersign?token=xxx — info for the countersign page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      name: true,
      estimateNumber: true,
      estimateDate: true,
      signedAt: true,
      signedByName: true,
      counterSignedAt: true,
      client: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!template.signedAt) return NextResponse.json({ error: "Client has not yet signed this estimate." }, { status: 400 });

  return NextResponse.json({
    name: template.name,
    estimateNumber: template.estimateNumber,
    estimateDate: template.estimateDate,
    clientName: template.client?.name ?? null,
    companyName: template.company?.name ?? null,
    clientSignedAt: template.signedAt?.toISOString() ?? null,
    clientSignedByName: template.signedByName ?? null,
    alreadyCountersigned: !!template.counterSignedAt,
    counterSignedAt: template.counterSignedAt?.toISOString() ?? null,
    pdfUrl: null,
  });
}

// PATCH /api/countersign — save contractor signature, generate & email countersigned PDF
export async function PATCH(req: NextRequest) {
  const { token, signatureData } = await req.json() as {
    token: string;
    signatureData: string;
  };

  if (!token || !signatureData) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    include: {
      client: true,
      company: true,
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
  });

  if (!template) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!template.signedAt) return NextResponse.json({ error: "Client has not yet signed." }, { status: 400 });
  if (template.counterSignedAt) return NextResponse.json({ error: "Already countersigned" }, { status: 409 });

  const counterSignedAt = new Date();

  await prisma.estimateTemplate.update({
    where: { id: template.id },
    data: { counterSignatureData: signatureData, counterSignedAt },
  });

  // Build PDF with both signatures
  const divisions = template.divisions.map((d) => ({
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

  const co = template.company;
  const companyLogoDataUrl = co?.logoUrl ? await resolvePrivateCoverUrl(co.logoUrl) : null;

  const buffer = await renderTemplatePdf({
    companyName: co?.name ?? "MIBH Construction",
    branding: co ? {
      name: co.name || undefined,
      address: co.address || undefined,
      phone: co.phone || undefined,
      email: co.email || undefined,
      licenses: co.licenses || undefined,
      tagline: co.tagline || undefined,
      website: co.website || undefined,
      contactName: co.contactName || undefined,
      logoSrc: companyLogoDataUrl || undefined,
    } : null,
    template: {
      name: template.name,
      description: template.description,
      estimateNumber: template.estimateNumber,
      estimateDate: template.estimateDate,
    },
    client: template.client
      ? { name: template.client.name, address: template.client.address, city: template.client.city, state: template.client.state, zip: template.client.zip, phone: template.client.phone, email: template.client.email }
      : null,
    divisions,
    showTerms: true,
    termsContent: template.termsContent,
    paymentSchedule: (template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null) ?? DEFAULT_PAYMENT_SCHEDULE,
    gcFeePercent: template.gcFeePercent ? Number(template.gcFeePercent) : null,
    summaryGroups: (template.summaryGroups as Record<string, { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null }> | null) ?? null,
    clientSignatureData: template.signatureData,
    clientSignedByName: template.signedByName,
    clientSignedAt: template.signedAt,
    contractorSignatureData: signatureData,
    contractorSignedAt: counterSignedAt,
    includeRoofUpgradesPage: template.name.toLowerCase().includes("roof"),
    includeAdditionPages: template.name.toLowerCase().includes("addition"),
    includePermitPages: false,
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

  // Upload executed PDF to Blob and save URL on the template
  try {
    const clientSlugBlob = template.client ? `-for-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
    const estimateSlugBlob = template.estimateNumber ? `estimate-${template.estimateNumber}` : template.id;
    const blob = await put(
      `executed/${template.companyId}/${estimateSlugBlob}${clientSlugBlob}-executed.pdf`,
      finalBuffer,
      { access: "private" }
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "EstimateTemplate" SET "executedPdfUrl" = $1 WHERE id = $2`,
      blob.url, template.id
    );
  } catch (err) {
    console.error("Failed to store executed PDF:", err);
  }

  // Email to both parties
  try {
    const oauth2Client = await getGmailOAuth(template.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const clientSlug = template.client ? `-for-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
    const estimateSlug = template.estimateNumber ? `Estimate-${template.estimateNumber}` : template.name.replace(/[^a-z0-9]/gi, "-");
    const filename = `${estimateSlug}${clientSlug}-countersigned.pdf`;
    const pdfBase64 = finalBuffer.toString("base64");

    const estimateLabel = template.estimateNumber
      ? `Estimate #${template.estimateNumber} — ${template.name}`
      : template.name;
    const clientLabel = template.client?.name ?? "Client";
    const clientEmail = template.client?.email;

    const subject = `✅ Fully Executed: ${estimateLabel}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const bodyText = [
      `Please find attached the fully executed estimate.`,
      ``,
      `Estimate: ${estimateLabel}`,
      `Client: ${clientLabel}`,
      `Client signed: ${template.signedAt?.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      `Contractor signed: ${counterSignedAt.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      ``,
      `This document is fully executed and legally binding.`,
    ].join("\n");

    const recipients = [fromEmail, ...(clientEmail ? [clientEmail] : [])];

    for (const toEmail of recipients) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const mimeLines = [
        `From: ${fromEmail}`,
        `To: ${toEmail}`,
        `Subject: ${encodedSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        bodyText,
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
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "EstimateTemplate" SET "executedEmailSentAt" = $1 WHERE id = $2`,
      new Date(), template.id,
    );
  } catch (err) {
    console.error("Countersign email failed:", err);
    // Non-fatal — signature was saved
  }

  return NextResponse.json({ success: true });
}
