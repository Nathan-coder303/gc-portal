import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

function buildDivisions(items: { id: string; csiCode: string | null; divisionName: string; name: string; description: string | null; qty: unknown; unit: string | null; unitCost: unknown; markupPct: unknown; sortOrder: number }[]) {
  const divMap = new Map<string, { id: string; csiCode: string | null; name: string; groups: never[]; items: { id: string; name: string; detail: string | null; unit: string | null; csiCode: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null }[] }>();

  for (const it of items) {
    if (!divMap.has(it.divisionName)) {
      divMap.set(it.divisionName, {
        id: it.divisionName,
        csiCode: it.csiCode ? it.csiCode.substring(0, 2) : null,
        name: it.divisionName,
        groups: [],
        items: [],
      });
    }
    divMap.get(it.divisionName)!.items.push({
      id: it.id,
      name: it.name,
      detail: it.description ?? null,
      unit: it.unit ?? null,
      csiCode: it.csiCode ?? null,
      defaultQty: it.qty != null ? Number(it.qty) : null,
      defaultUnitCost: it.unitCost != null ? Number(it.unitCost) : null,
      defaultMarkupPct: it.markupPct != null ? Number(it.markupPct) : null,
      visibleInPdf: true,
      notes: null,
    });
  }

  return Array.from(divMap.values());
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { changeOrderId, clientId, to, cc, bcc, subject, body: emailBody, coverType, page2 } = body as {
      changeOrderId?: string;
      clientId?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      body?: string;
      coverType?: string;
      page2?: string;
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

    const divisions = buildDivisions(changeOrder.items);

    const buffer = await renderTemplatePdf({
      companyName: company.name,
      template: {
        name: changeOrder.orderNumber ? `Change Order ${changeOrder.orderNumber}` : "Change Order",
        description: changeOrder.title,
        estimateNumber: changeOrder.orderNumber ?? null,
        estimateDate: changeOrder.createdAt.toISOString().split("T")[0],
      },
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
      hideContractorSignature: true,
      includeRoofUpgradesPage: page2 === "ROOF",
      includeAdditionPages: page2 === "ADDITION",
      includeRetailPages: page2 === "RETAIL",
      includeCoverPage: coverType !== "NONE",
      clientCoverPhotoType: coverType ?? changeOrder.client?.coverPhotoType ?? null,
      clientCoverPhotoUrl: null,
      clientCoverTitle: changeOrder.client?.coverTitle ?? null,
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
    const fullEmailBody = `${emailBody}\n\n---\nApprove & sign this change order here: ${signUrl}`;

    const boundary = `----=_Part_${Date.now()}`;
    const clientSlug = changeOrder.client ? `-${changeOrder.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
    const coSlug = changeOrder.orderNumber ? `CO-${changeOrder.orderNumber}` : "ChangeOrder";
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
