import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";
import { stampSignaturePage } from "@/lib/documents/stampSignaturePage";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — contractor countersigns a ClientDocument
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; docId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { signatureData } = await req.json() as { signatureData: string };
  if (!signatureData) return NextResponse.json({ error: "signatureData required" }, { status: 400 });

  const doc = await prisma.clientDocument.findFirst({
    where: { id: params.docId, clientId: params.clientId, companyId: params.companyId },
    include: { client: true },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.clientSignedAt && !doc.clientAlreadySigned) {
    return NextResponse.json({ error: "Client has not signed yet" }, { status: 400 });
  }
  if (doc.counterSignedAt) return NextResponse.json({ error: "Already countersigned" }, { status: 409 });

  const counterSignedAt = new Date();

  // Stamp signature page onto the PDF
  const finalBuffer = await stampSignaturePage(doc.originalFileUrl, {
    docName: doc.name,
    clientSignedByName: doc.clientSignedByName,
    clientSignedAt: doc.clientSignedAt,
    clientSignatureData: doc.clientSignatureData,
    clientAlreadySigned: doc.clientAlreadySigned,
    contractorSignatureData: signatureData,
    contractorSignedAt: counterSignedAt,
    contractorName: session.user?.name ?? "Mike Baruh",
  });

  // Upload executed PDF to Blob
  const slug = doc.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const blob = await put(
    `client-docs/${params.clientId}/${params.docId}-executed-${Date.now()}.pdf`,
    finalBuffer,
    { access: "private" }
  );

  // Save to DB
  await prisma.$executeRawUnsafe(
    `UPDATE "ClientDocument" SET "counterSignedAt" = $1, "counterSignatureData" = $2, "countersignedFileUrl" = $3 WHERE id = $4`,
    counterSignedAt,
    signatureData,
    blob.url,
    doc.id,
  );

  const pdfBase64 = finalBuffer.toString("base64");
  const filename = `${slug}-executed.pdf`;
  const clientEmail = doc.client?.email;

  // Email both parties
  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const subject = `✅ Fully Executed: ${doc.name}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const bodyText = [
      `Please find attached the fully executed document.`,
      ``,
      `Document: ${doc.name}`,
      `Client: ${doc.client?.name ?? ""}`,
      `Client signed: ${doc.clientSignedAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "External signature"}`,
      `Contractor signed: ${counterSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
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
  } catch (err) {
    console.error("Document countersign email failed:", err);
  }

  return NextResponse.json({
    success: true,
    downloadUrl: `/api/${params.companyId}/clients/${params.clientId}/documents/${doc.id}/file?executed=1`,
    emailedTo: [clientEmail].filter(Boolean),
  });
}
