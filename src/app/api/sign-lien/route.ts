import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const release = await prisma.lienRelease.findUnique({
    where: { signatureToken: token },
    select: {
      id: true, type: true, subName: true, throughDate: true, amount: true,
      signedAt: true, signedByName: true, archivedAt: true,
      client: { select: { name: true } },
      companyId: true,
    },
  });

  if (!release || release.archivedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const typeLabel = release.type === "PARTIAL" ? "Partial" : "Final";
  return NextResponse.json({
    name: `Unconditional ${typeLabel} Waiver and Release of Lien`,
    subName: release.subName,
    clientName: release.client?.name ?? null,
    alreadySigned: !!release.signedAt,
    signedAt: release.signedAt?.toISOString() ?? null,
    signedByName: release.signedByName ?? null,
    pdfUrl: `/api/sign-lien/pdf?token=${token}`,
  });
}

export async function PATCH(req: NextRequest) {
  const { token, signatureData, signedByName } = await req.json() as {
    token: string; signatureData: string; signedByName: string;
  };

  if (!token || !signatureData || !signedByName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const release = await prisma.lienRelease.findUnique({
    where: { signatureToken: token },
    select: { id: true, companyId: true, type: true, subName: true, signedAt: true, archivedAt: true },
  });

  if (!release || release.archivedAt) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (release.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  const signedAt = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE "LienRelease" SET "signedAt" = $1, "signatureData" = $2, "signedByName" = $3 WHERE id = $4`,
    signedAt, signatureData, signedByName, release.id,
  );

  // Notify contractor
  try {
    const oauth2Client = await getGmailOAuth(release.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const typeLabel = release.type === "PARTIAL" ? "Partial" : "Final";
    const subject = `${release.subName} has signed the ${typeLabel} Lien Release — please review`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const body = [
      `${release.subName} has signed the Unconditional ${typeLabel} Waiver and Release of Lien.`,
      ``,
      `Signed by: ${signedByName}`,
      `Signed at: ${signedAt.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}`,
    ].join("\n");

    const raw = Buffer.from([
      `From: ${fromEmail}`,
      `To: ${fromEmail}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ].join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("Lien release sign notification failed:", err);
  }

  return NextResponse.json({ success: true });
}
