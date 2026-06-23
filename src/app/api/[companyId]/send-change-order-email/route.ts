import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { getGmailOAuth } from "@/lib/gmail";
import { STANDARD_TEMPLATE_DIVISIONS, BATHROOM_TEMPLATE_DIVISIONS, KITCHEN_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

export const runtime = "nodejs";
export const maxDuration = 30;

const _ALL = [...STANDARD_TEMPLATE_DIVISIONS, ...BATHROOM_TEMPLATE_DIVISIONS, ...KITCHEN_TEMPLATE_DIVISIONS];
const DIV_NAME_LOOKUP: Record<string, string> = {};
for (const d of _ALL) {
  const p = d.csiCode.replace(/\s/g, "").substring(0, 2);
  if (!DIV_NAME_LOOKUP[p]) DIV_NAME_LOOKUP[p] = d.name;
}

function resolveItems(items: { id: string; csiCode: string | null; divisionName: string; name: string; description: string | null; qty: unknown; unit: string | null; unitCost: unknown; markupPct: unknown; sortOrder: number }[]) {
  const divMap = new Map<string, { id: string; csiCode: string | null; name: string; groups: never[]; items: { id: string; name: string; detail: string | null; unit: string | null; csiCode: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null }[] }>();

  for (const it of items) {
    const cleanCode = (it.csiCode ?? "").replace(/\s/g, "");
    const divPrefix = cleanCode.substring(0, 2);
    const mapKey = divPrefix || it.divisionName;
    const divName = (divPrefix && DIV_NAME_LOOKUP[divPrefix]) ? DIV_NAME_LOOKUP[divPrefix] : it.divisionName;
    const divCsiCode = divPrefix ? `${divPrefix} 00 00` : null;

    if (!divMap.has(mapKey)) {
      divMap.set(mapKey, {
        id: mapKey,
        csiCode: divCsiCode,
        name: divName,
        groups: [],
        items: [],
      });
    }
    let qty = it.qty != null ? Number(it.qty) : null;
    let unitCost = it.unitCost != null ? Number(it.unitCost) : null;
    if (qty != null && qty > 0 && (unitCost == null || unitCost === 0)) {
      unitCost = qty;
      qty = 1;
    } else if ((qty == null || qty === 0) && unitCost != null && unitCost > 0) {
      qty = 1;
    }

    divMap.get(mapKey)!.items.push({
      id: it.id,
      name: it.name,
      detail: null,
      unit: it.unit ?? null,
      csiCode: null,
      defaultQty: qty,
      defaultUnitCost: unitCost,
      defaultMarkupPct: it.markupPct != null ? Number(it.markupPct) : null,
      visibleInPdf: true,
      notes: it.description ?? null,
    });
  }

  return Array.from(divMap.values());
}

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

type StoredAttachment = { id: string; name: string; url: string; size: number; mimeType: string };
function parseStoredAttachments(raw: string | null): StoredAttachment[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { changeOrderId, clientId, to, cc, bcc, subject, body: emailBody } = body as {
      changeOrderId?: string;
      clientId?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      body?: string;
    };

    if (!changeOrderId || !clientId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "changeOrderId, clientId, to, subject, and body are required" },
        { status: 400 }
      );
    }

    const [changeOrder, company] = await Promise.all([
      prisma.changeOrder.findFirst({
        where: { id: changeOrderId, companyId: params.companyId, clientId },
        include: {
          client: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.company.findFirst({ where: { id: params.companyId } }),
    ]);

    if (!changeOrder || !company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const companyLogoDataUrl = company.logoUrl ? await resolvePrivateCoverUrl(company.logoUrl) : null;
    const divisions = resolveItems(changeOrder.items);

    // Public proxy URLs so the client can open attachments straight from the emailed PDF
    const origin = new URL(req.url).origin;
    const attachmentLinks = parseStoredAttachments(changeOrder.attachments).map(a => ({
      name: a.name,
      url: `${origin}/api/co-attachment/${changeOrder.id}/${a.id}`,
      mimeType: a.mimeType ?? null,
    }));

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
        name: changeOrder.orderNumber ? `Change Order ${changeOrder.orderNumber}` : changeOrder.title,
        description: null,
        estimateNumber: null,
        estimateDate: changeOrder.createdAt.toISOString().split("T")[0],
      },
      hideEstimateLabel: true,
      changeOrderNotes: changeOrder.notes ?? null,
      client: changeOrder.client
        ? {
            name: changeOrder.client.name,
            address: changeOrder.client.address,
            city: changeOrder.client.city,
            state: changeOrder.client.state,
            zip: changeOrder.client.zip,
            phone: changeOrder.client.phone,
            email: changeOrder.client.email,
          }
        : null,
      divisions,
      showTerms: false,
      paymentSchedule: null,
      gcFeePercent: null,
      summaryGroups: null,
      clientSignatureData: changeOrder.signatureData ?? null,
      clientSignedByName: changeOrder.signedByName ?? null,
      clientSignedAt: changeOrder.signedAt ?? null,
      includeRoofUpgradesPage: false,
      includeAdditionPages: false,
      includeRetailPages: false,
      includeCoverPage: false,
      hideContractorSignature: true,
      clientCoverPhotoType: null,
      clientCoverPhotoUrl: null,
      clientCoverTitle: null,
      attachments: attachmentLinks.length > 0 ? attachmentLinks : null,
    });

    const envToken = process.env.GOOGLE_REFRESH_TOKEN;
    const envClientId = process.env.GOOGLE_CLIENT_ID;
    const tokenPrefix = envToken?.slice(0, 12) ?? "MISSING";
    const clientIdPrefix = envClientId?.slice(0, 20) ?? "MISSING";

    let oauth2Client;
    try {
      oauth2Client = await getGmailOAuth(params.companyId);
    } catch (err) {
      return NextResponse.json({ error: "Gmail auth failed", detail: String(err), step: "getOAuth", tokenPrefix, clientIdPrefix }, { status: 500 });
    }
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    let profile;
    try {
      profile = await gmail.users.getProfile({ userId: "me" });
    } catch (err) {
      return NextResponse.json({ error: "Gmail getProfile failed", detail: String(err), step: "getProfile", tokenPrefix, clientIdPrefix }, { status: 500 });
    }
    const fromEmail = profile.data.emailAddress ?? "me";

    // Generate or reuse sign token
    let signToken = changeOrder.signatureToken;
    if (!signToken) {
      signToken = crypto.randomBytes(32).toString("hex");
      await prisma.changeOrder.update({
        where: { id: changeOrderId },
        data: { signatureToken: signToken },
      });
    }
    const signUrl = `https://portal.mibhconstruction.com/sign-co/${signToken}`;

    // Split body around the closing so the signing block lands in the middle
    let mainBody: string;
    let closing: string;
    const closingMatch = emailBody.match(/[^\n]*(any questions|let me know|thank you|sincerely|best regards|regards,)[^\n]*\n?/i);
    if (closingMatch && closingMatch.index !== undefined) {
      const splitAt = closingMatch.index;
      mainBody = emailBody.slice(0, splitAt).replace(/\s+$/, "");
      closing = emailBody.slice(splitAt).replace(/^\s+/, "");
    } else {
      const lastBreak = emailBody.lastIndexOf("\n\n");
      mainBody = lastBreak >= 0 ? emailBody.slice(0, lastBreak) : emailBody;
      closing = lastBreak >= 0 ? emailBody.slice(lastBreak + 2) : "";
    }

    const fullEmailBody = [
      mainBody,
      "",
      "─────────────────────────────",
      "✅ READY TO APPROVE & SIGN THIS CHANGE ORDER?",
      `Click here to review and sign electronically: ${signUrl}`,
      "─────────────────────────────",
      "",
      closing,
    ].join("\n");

    const mainBodyHtml = mainBody.split("\n")
      .map(l => l.trim() === "" ? "<br>" : `<p style="margin:0 0 8px">${l}</p>`)
      .join("\n");
    const closingHtml = closing.split("\n")
      .map(l => l.trim() === "" ? "<br>" : `<p style="margin:0 0 8px">${l}</p>`)
      .join("\n");
    const signingBlock = `
<div style="background:#fffbf0;border:2px solid #C9A84C;border-radius:10px;padding:20px 24px;margin:20px 0;text-align:center">
  <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b">Your Change Order is Ready to Sign</p>
  <p style="margin:0 0 16px;color:#475569;font-size:14px">Please review the attached PDF change order. When you are ready to proceed, click the button below to approve and sign electronically.</p>
  <a href="${signUrl}" style="display:inline-block;background:#C9A84C;color:#0d1117;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px">Approve &amp; Sign Change Order →</a>
  <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Or copy this link: ${signUrl}</p>
</div>`;
    const htmlBody = mainBodyHtml + signingBlock + (closing.trim() ? "\n" + closingHtml : "");

    const outerBoundary = `----=_Mixed_${Date.now()}`;
    const altBoundary = `----=_Alt_${Date.now() + 1}`;
    const clientSlug = changeOrder.client ? `-${changeOrder.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
    const coSlug = changeOrder.orderNumber ?? "ChangeOrder";
    const filename = `${coSlug}${clientSlug}.pdf`;
    const pdfBase64 = buffer.toString("base64");

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
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    } catch (err) {
      console.error("Gmail send error:", err);
      return NextResponse.json({ error: "Failed to send email", detail: String(err), step: "gmailSend", fromEmail, tokenPrefix, clientIdPrefix }, { status: 500 });
    }

    // Log to Communications
    await prisma.clientEmail.create({
      data: {
        clientId,
        companyId: params.companyId,
        fromEmail,
        to,
        cc: cc ?? null,
        bcc: bcc ?? null,
        subject,
        body: emailBody,
        sentBy: session.user?.name ?? session.user?.email ?? null,
        context: "change-order",
        attachments: JSON.stringify([filename]),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-change-order-email unhandled error:", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
