import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

// GET /api/sign-doc?token=xxx — public: info for signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const doc = await prisma.clientDocument.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      name: true,
      description: true,
      clientSignedAt: true,
      clientSignedByName: true,
      archivedAt: true,
      client: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!doc || doc.archivedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: doc.name,
    description: doc.description,
    clientName: doc.client?.name ?? null,
    companyName: doc.company?.name ?? null,
    alreadySigned: !!doc.clientSignedAt,
    signedAt: doc.clientSignedAt?.toISOString() ?? null,
    signedByName: doc.clientSignedByName ?? null,
    pdfUrl: `/api/sign-doc/pdf?token=${token}`,
  });
}

// PATCH /api/sign-doc — public: client submits signature
export async function PATCH(req: NextRequest) {
  const { token, signatureData, signedByName } = await req.json() as {
    token: string;
    signatureData: string;
    signedByName: string;
  };

  if (!token || !signatureData || !signedByName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const doc = await prisma.clientDocument.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      name: true,
      clientSignedAt: true,
      archivedAt: true,
      client: { select: { name: true } },
    },
  });

  if (!doc || doc.archivedAt) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (doc.clientSignedAt) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  const signedAt = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE "ClientDocument" SET "clientSignedAt" = $1, "clientSignatureData" = $2, "clientSignedByName" = $3 WHERE id = $4`,
    signedAt, signatureData, signedByName, doc.id,
  );

  // Notify contractor
  try {
    const oauth2Client = await getGmailOAuth(doc.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const clientLabel = doc.client?.name ?? "The client";
    const subject = `${clientLabel} has signed "${doc.name}" — please countersign now`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const signedTime = signedAt.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
    const body = [
      `${clientLabel} has signed the document. Your countersignature is required.`,
      ``,
      `Document: ${doc.name}`,
      `Signed by: ${signedByName}`,
      `Signed at: ${signedTime}`,
    ].join("\n");

    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${fromEmail}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("Sign-doc notification failed:", err);
  }

  return NextResponse.json({ success: true });
}
