import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { insertClientPageIntoEstimate } from "@/lib/estimates/insertClientPage";
import { getGmailOAuth } from "@/lib/gmail";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Fetch a private Vercel Blob URL and return a base64 data URL for react-pdf */
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

const DEFAULT_PAYMENT_SCHEDULE = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

// GET — returns the authenticated Gmail address and default signature for the modal
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
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
  try {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { templateId, to, cc, bcc, subject, body: emailBody, coverType, page2, includeInsert, includeDivisionSummary, noPresentation, forcedBreakCsiPrefixes, scopeOfWorkId } = body as {
    templateId?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    coverType?: string;
    page2?: string;
    includeInsert?: boolean;
    includeDivisionSummary?: boolean;
    noPresentation?: boolean;
    forcedBreakCsiPrefixes?: string[];
    scopeOfWorkId?: string | null;
  };

  if (!templateId || !to || !subject || !emailBody) {
    return NextResponse.json(
      { error: "templateId, to, subject, and body are required" },
      { status: 400 }
    );
  }

  const [template, company, scopeOfWork] = await Promise.all([
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
    scopeOfWorkId
      ? prisma.scopeOfWork.findFirst({ where: { id: scopeOfWorkId, companyId: params.companyId }, select: { title: true, body: true } })
      : Promise.resolve(null),
  ]);

  if (!template || !company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateCoverUrl(company.logoUrl) : null;

  const buffer = await renderTemplatePdf({
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
      logoSrc: companyLogoDataUrl || undefined,
    },
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
    includeRoofUpgradesPage: page2 ? page2 === "ROOF" : (template.name.toLowerCase().includes("roof") && !template.name.toLowerCase().includes("retail")),
    includeAdditionPages: page2 ? page2 === "ADDITION" : template.name.toLowerCase().includes("addition"),
    includePermitPages: page2 ? page2 === "PERMIT" : false,
    includeRetailPages: page2 ? page2 === "RETAIL" : template.name.toLowerCase().includes("retail"),
    includeCoverPage: coverType !== "NONE",
    includeDivisionSummary: includeDivisionSummary ?? false,
    showTerms: template.showTerms,
    forcedBreakCsiPrefixes: forcedBreakCsiPrefixes ?? [],
    scopeOfWork: scopeOfWork ?? null,
    insulationType: template.insulationType ?? "ISO",
    clientCoverPhotoType: coverType ?? template.client?.coverPhotoType ?? null,
    clientCoverPhotoUrl: await resolvePrivateCoverUrl(template.client?.coverPhotoUrl ?? null),
    clientCoverTitle: template.client?.coverTitle ?? null,
  });

  // Insert client's marked PDF file as page 3 (if opted in and file exists)
  let finalBuffer = buffer;
  if (includeInsert !== false && template.client) {
    const insertFile = await prisma.clientFile.findFirst({
      where: { clientId: template.client.id, useInEstimate: true },
      select: { fileUrl: true },
    });
    const fileUrl = insertFile?.fileUrl?.trim() || null;
    if (fileUrl) {
      finalBuffer = await insertClientPageIntoEstimate(buffer, fileUrl);
    }
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
  const trackPixelUrl = `https://portal.mibhconstruction.com/api/track/open?token=${signToken}`;
  const fullEmailBody = `${emailBody}\n\n---\nSign your estimate here: ${signUrl}`;
  const htmlBody = emailBody
    .split("\n")
    .map(l => l.trim() === "" ? "<br>" : `<p style="margin:0 0 8px">${l}</p>`)
    .join("\n") +
    `\n<br>\n<p style="margin:0 0 8px">---<br>` +
    `<a href="${signUrl}" style="color:#C9A84C;font-weight:bold">Sign your estimate here</a></p>` +
    `\n<img src="${trackPixelUrl}" width="1" height="1" alt="" style="display:none" />`;

  const oauth2Client = await getGmailOAuth(params.companyId);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Use the actual authenticated Gmail address as From
  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  const outerBoundary = `----=_Mixed_${Date.now()}`;
  const altBoundary = `----=_Alt_${Date.now() + 1}`;
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
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    ``,
    `--${outerBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    fullEmailBody,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    `<html><body style="font-family:sans-serif;font-size:14px;color:#1e293b">`,
    htmlBody,
    `</body></html>`,
    ``,
    `--${altBoundary}--`,
    ``,
    `--${outerBoundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    pdfBase64,
    `--${outerBoundary}--`,
  ];
  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    console.error("Gmail send error:", err);
    if (String(err).includes("invalid_grant")) {
      return NextResponse.json({ error: "gmail_auth_expired", detail: String(err) }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { lastSentAt: new Date() },
  });

  // Log to Communications
  if (template.clientId) {
    await prisma.clientEmail.create({
      data: {
        clientId: template.clientId,
        companyId: params.companyId,
        fromEmail,
        to,
        cc: cc ?? null,
        bcc: bcc ?? null,
        subject,
        body: emailBody,
        sentBy: session.user?.name ?? session.user?.email ?? null,
        context: "estimate",
        attachments: JSON.stringify([filename]),
      },
    });
  }

  // Auto-save a version snapshot after successful send
  if (template.clientId) {
    try {
      const gcFeePercent = template.gcFeePercent ? Number(template.gcFeePercent) : 0;
      const calcItemTotal = (qty: number | null, cost: number | null, markup: number | null) => {
        const q = qty ?? 0; const c = cost ?? 0; const m = markup ?? 0;
        return q * c * (1 + m / 100);
      };
      const divSubtotal = template.divisions.reduce((sum, div) => {
        if (div.manualTotal != null) return sum + Number(div.manualTotal);
        const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
        return sum + allItems.reduce((s, i) => s + calcItemTotal(i.defaultQty ? Number(i.defaultQty) : null, i.defaultUnitCost ? Number(i.defaultUnitCost) : null, i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null), 0);
      }, 0);
      const gcFeeAmt = gcFeePercent > 0 ? divSubtotal * gcFeePercent / 100 : 0;
      const versionTotal = divSubtotal + gcFeeAmt;
      const snapshot = {
        divisions: template.divisions.map(div => {
          const divTotal = div.manualTotal != null ? Number(div.manualTotal)
            : [...div.items, ...div.groups.flatMap(g => g.items)].reduce((s, i) => s + calcItemTotal(i.defaultQty ? Number(i.defaultQty) : null, i.defaultUnitCost ? Number(i.defaultUnitCost) : null, i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null), 0);
          return {
            name: div.name, csiCode: div.csiCode, manualTotal: div.manualTotal != null ? Number(div.manualTotal) : null, total: divTotal,
            groups: div.groups.map(g => ({
              name: g.name,
              items: g.items.map(i => ({ name: i.name, qty: i.defaultQty ? Number(i.defaultQty) : null, unitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null, markup: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null, unit: i.unit, detail: i.detail, total: calcItemTotal(i.defaultQty ? Number(i.defaultQty) : null, i.defaultUnitCost ? Number(i.defaultUnitCost) : null, i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null) })),
            })),
            items: div.items.map(i => ({ name: i.name, qty: i.defaultQty ? Number(i.defaultQty) : null, unitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null, markup: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null, unit: i.unit, detail: i.detail, total: calcItemTotal(i.defaultQty ? Number(i.defaultQty) : null, i.defaultUnitCost ? Number(i.defaultUnitCost) : null, i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null) })),
          };
        }),
        subtotal: divSubtotal, gcFee: gcFeeAmt, total: versionTotal,
      };
      // Create without snapshot first (avoids Prisma stale-cache type error on Vercel)
      const ver = await prisma.estimateVersion.create({
        data: {
          companyId: params.companyId,
          clientId: template.clientId,
          templateId: templateId,
          label: `Sent to ${to}`,
          total: versionTotal,
          subtotal: divSubtotal,
          gcFee: gcFeeAmt,
          createdBy: session.user?.name ?? session.user?.email ?? null,
        },
      });
      // Set snapshot via raw SQL — bypasses Prisma's stale generated client
      await prisma.$executeRawUnsafe(
        `UPDATE "EstimateVersion" SET snapshot = $1::jsonb WHERE id = $2`,
        JSON.stringify(snapshot),
        ver.id,
      );
    } catch { /* version save failure is non-critical */ }
  }

  return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-estimate-email unhandled error:", err);
    const msg = String(err);
    if (msg.includes("invalid_grant")) {
      return NextResponse.json({ error: "gmail_auth_expired", detail: msg }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}
