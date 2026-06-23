import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

// POST — generate or reuse a signature token for a change order
export async function POST(req: NextRequest) {
  const { changeOrderId } = await req.json() as { changeOrderId: string };
  if (!changeOrderId) return NextResponse.json({ error: "changeOrderId required" }, { status: 400 });

  const existing = await prisma.changeOrder.findUnique({
    where: { id: changeOrderId },
    select: { signatureToken: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.signatureToken) return NextResponse.json({ token: existing.signatureToken });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.changeOrder.update({
    where: { id: changeOrderId },
    data: { signatureToken: token },
  });
  return NextResponse.json({ token });
}

// PATCH — client submits their signature
export async function PATCH(req: NextRequest) {
  const { token, signatureData, signedByName } = await req.json() as {
    token: string;
    signatureData: string;
    signedByName: string;
  };

  if (!token || !signatureData || !signedByName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const co = await prisma.changeOrder.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      title: true,
      orderNumber: true,
      signedAt: true,
      client: { select: { name: true } },
    },
  });

  if (!co) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (co.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  const signedAt = new Date();
  // Capture the client's IP from upstream headers (Vercel sets x-forwarded-for / x-real-ip)
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const approverIp = (fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "").slice(0, 64) || null;
  await prisma.changeOrder.update({
    where: { id: co.id },
    data: { signatureData, signedByName, signedAt, status: "APPROVED", approverIp },
  });

  // Notify Mike
  try {
    const oauth2Client = await getGmailOAuth(co.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const signedTime = signedAt.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
    const coLabel = co.orderNumber ? `Change Order #${co.orderNumber} — ${co.title}` : co.title;
    const clientLabel = co.client?.name ?? "Unknown client";
    const notifSubject = `${clientLabel} has signed ${co.orderNumber ? `Change Order #${co.orderNumber}` : "a Change Order"}`;
    const notifBody = [
      `${clientLabel} has signed the change order.`,
      ``,
      `Change Order: ${coLabel}`,
      `Signed by: ${signedByName}`,
      `Signed at: ${signedTime}`,
    ].join("\n");

    const encodedSubject = `=?UTF-8?B?${Buffer.from(notifSubject).toString("base64")}?=`;
    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${fromEmail}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      notifBody,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("CO sign notification failed:", err);
  }

  return NextResponse.json({ success: true });
}

// GET — return CO info for the signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const co = await prisma.changeOrder.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      title: true,
      orderNumber: true,
      createdAt: true,
      signedAt: true,
      signedByName: true,
      client: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    title: co.title,
    orderNumber: co.orderNumber,
    createdAt: co.createdAt.toISOString(),
    clientName: co.client?.name ?? null,
    companyName: co.company?.name ?? null,
    alreadySigned: !!co.signedAt,
    signedAt: co.signedAt?.toISOString() ?? null,
    signedByName: co.signedByName ?? null,
  });
}
