import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderChangeOrderPdfBuffer, ChangeOrderPdfItem, ChangeOrderPdfAttachment } from "@/lib/changeOrderPdf";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseAttachments(raw: string | null): ChangeOrderPdfAttachment[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(a => ({ name: a.name, url: a.url, mimeType: a.mimeType ?? null }));
  } catch { return []; }
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

    const items: ChangeOrderPdfItem[] = changeOrder.items.map(it => ({
      name: it.name,
      description: it.description,
      qty: it.qty != null ? Number(it.qty) : 0,
      unit: it.unit,
      unitCost: it.unitCost != null ? Number(it.unitCost) : 0,
      markupPct: it.markupPct != null ? Number(it.markupPct) : 0,
    }));

    const buffer = await renderChangeOrderPdfBuffer({
      orderNumber: changeOrder.orderNumber,
      createdAt: changeOrder.createdAt,
      title: changeOrder.title,
      notes: changeOrder.notes,
      status: changeOrder.status,
      signedAt: changeOrder.signedAt,
      signedByName: changeOrder.signedByName,
      signatureData: changeOrder.signatureData,
      items,
      attachments: parseAttachments(changeOrder.attachments),
      company: {
        name: company.name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        licenses: company.licenses,
        website: company.website,
        logoSrc: companyLogoDataUrl ?? undefined,
      },
      client: changeOrder.client
        ? {
            name: changeOrder.client.name,
            address: changeOrder.client.address,
            city: changeOrder.client.city,
            state: changeOrder.client.state,
            zip: changeOrder.client.zip,
            projectName: changeOrder.client.projectName,
          }
        : null,
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

    // Split the body around the closing/greeting so the signing block lands in the middle
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
