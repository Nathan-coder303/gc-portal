import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recipientEmail, recipientName } = await req.json();
  if (!id || !recipientEmail) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const release = await prisma.lienRelease.findFirst({
    where: { id, companyId: params.companyId, clientId: params.clientId, archivedAt: null },
    include: { client: { select: { name: true } } },
  });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await prisma.company.findFirst({ where: { id: params.companyId } });
  const companyName = company?.name ?? "MIBH Construction";

  const signingUrl = `${process.env.NEXTAUTH_URL}/sign-lien/${release.signatureToken}`;
  const typeLabel = release.type === "PARTIAL" ? "Partial" : "Final";
  const docTitle = `Unconditional ${typeLabel} Waiver and Release of Lien`;

  const subject = `Please sign: ${docTitle} — ${release.client.name}`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align:center; margin-bottom: 24px;">
    <span style="font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #C9A84C; text-transform: uppercase;">${companyName}</span>
  </div>
  <h2 style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 8px;">Please Review & Sign</h2>
  <p style="color: #475569; margin-bottom: 20px;">${recipientName ? `Hi ${recipientName},` : "Hello,"}</p>
  <p style="color: #475569; margin-bottom: 20px;">
    ${companyName} has sent you a <strong>${docTitle}</strong> for <strong>${release.client.name}</strong> to review and sign electronically.
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${signingUrl}" style="background: #C9A84C; color: #fff; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block;">
      Review &amp; Sign Document
    </a>
  </div>
  <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
    If the button above doesn't work, copy and paste this link into your browser:<br/>
    <a href="${signingUrl}" style="color: #C9A84C;">${signingUrl}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 11px; color: #94a3b8;">
    This document was sent by ${companyName}. Electronic signatures are legally binding under the ESIGN Act and Florida law.
  </p>
</body>
</html>`.trim();

  const textBody = [
    `${companyName} has sent you a ${docTitle} for ${release.client.name} to review and sign.`,
    "",
    `Please click the link below to review and sign the document:`,
    signingUrl,
    "",
    "Electronic signatures are legally binding under the ESIGN Act and Florida law.",
  ].join("\n");

  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const boundary = `----=_Part_${Date.now()}`;
    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${recipientEmail}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.$executeRawUnsafe(
      `UPDATE "LienRelease" SET "recipientEmail" = $1, "emailSentAt" = NOW() WHERE id = $2`,
      recipientEmail, id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lien release email failed:", err);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
