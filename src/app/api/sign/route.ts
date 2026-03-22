import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { google } from "googleapis";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

export const runtime = "nodejs";

// POST /api/sign — called server-side when sending the email; generates and returns a signature token
export async function POST(req: NextRequest) {
  const { templateId } = await req.json() as { templateId: string };
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  // Reuse existing token if already generated
  const existing = await prisma.estimateTemplate.findUnique({
    where: { id: templateId },
    select: { signatureToken: true },
  });
  if (existing?.signatureToken) {
    return NextResponse.json({ token: existing.signatureToken });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { signatureToken: token },
  });
  return NextResponse.json({ token });
}

// PATCH /api/sign — called when client submits their signature
export async function PATCH(req: NextRequest) {
  const { token, signatureData, signedByName } = await req.json() as {
    token: string;
    signatureData: string;
    signedByName: string;
  };

  if (!token || !signatureData || !signedByName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      name: true,
      estimateNumber: true,
      signedAt: true,
      client: { select: { name: true, address: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (template.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  const signedAt = new Date();
  await prisma.estimateTemplate.update({
    where: { id: template.id },
    data: { signatureData, signedByName, signedAt },
  });

  // Send notification email to Mike
  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const signedTime = signedAt.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
    const estimateLabel = template.estimateNumber
      ? `Estimate #${template.estimateNumber} — ${template.name}`
      : template.name;
    const clientLabel = template.client?.name ?? "Unknown client";
    const portalUrl = `https://portal.mibhconstruction.com/${template.companyId}/clients`;

    const countersignUrl = `https://portal.mibhconstruction.com/countersign/${token}`;
    const notifSubject = `✍️ Action Required: Countersign estimate for ${clientLabel}`;
    const notifBody = [
      `${clientLabel} has signed the estimate. Your countersignature is required.`,
      ``,
      `Estimate: ${estimateLabel}`,
      `Client: ${clientLabel}`,
      `Signed by: ${signedByName}`,
      `Signed at: ${signedTime}`,
      ``,
      `👉 Click here to countersign: ${countersignUrl}`,
      ``,
      `View in portal: ${portalUrl}`,
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
    // Non-fatal — signature was saved, just log the notification failure
    console.error("Sign notification email failed:", err);
  }

  return NextResponse.json({ success: true });
}

// GET /api/sign?token=xxx — returns the template info for the signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      name: true,
      estimateNumber: true,
      estimateDate: true,
      signedAt: true,
      signedByName: true,
      client: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: template.name,
    estimateNumber: template.estimateNumber,
    estimateDate: template.estimateDate,
    clientName: template.client?.name ?? null,
    companyName: template.company?.name ?? null,
    alreadySigned: !!template.signedAt,
    signedAt: template.signedAt?.toISOString() ?? null,
    signedByName: template.signedByName ?? null,
    pdfUrl: `/api/${template.companyId}/estimates/${template.id}/pdf`,
  });
}
