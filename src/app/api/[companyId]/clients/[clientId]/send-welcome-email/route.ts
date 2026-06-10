import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";

const PORTAL_BASE = process.env.PORTAL_BASE_URL ?? "https://portal.mibhconstruction.com";

function encodeSubject(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function stripHtml(html: string): string {
  return html
    // Block-level closing tags become newlines so each line stays separated
    .replace(/<\/(div|p|li|tr|h[1-6]|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Collapse 3+ consecutive newlines down to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { name: true, email: true, emailList: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const portalUser = await prisma.user.findFirst({
    where: { clientId: params.clientId, role: "CLIENT" },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  const emails = (client.emailList as string[] | null)?.filter(Boolean) ?? [];
  const to = emails.length > 0 ? emails.join(", ") : client.email;
  if (!to) return NextResponse.json({ error: "Client has no email address" }, { status: 400 });

  const portalUrl = `${PORTAL_BASE}/client-portal/${params.clientId}`;
  const loginEmail = portalUser?.email ?? to;

  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const [profile, sendAsList] = await Promise.all([
      gmail.users.getProfile({ userId: "me" }),
      gmail.users.settings.sendAs.list({ userId: "me" }),
    ]);
    const fromEmail = profile.data.emailAddress ?? "me";
    const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
    const signature = defaultSendAs?.signature ? stripHtml(defaultSendAs.signature) : "";

    const subject = `Welcome to Your Client Portal — ${client.name}`;
    const body = [
      `Hi ${client.name},`,
      ``,
      `We're excited to welcome you to your dedicated client portal! This is your central hub to stay informed and connected throughout your project.`,
      ``,
      `Through your portal you can:`,
      `  • View project photos and updates in real time`,
      `  • Access and download your project documents`,
      `  • Communicate directly with our team via messages`,
      `  • Review your daily logs and progress reports`,
      ``,
      `Your portal link: ${portalUrl}`,
      `Login email: ${loginEmail}`,
      ``,
      `If you have not yet received your password or need to reset it, please reply to this email and we will assist you right away.`,
      ``,
      `We look forward to keeping you informed every step of the way. Thank you for trusting us with your project!`,
      ...(signature ? [``, signature] : []),
    ].join("\n");

    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    await prisma.clientEmail.create({
      data: {
        clientId: params.clientId,
        companyId: params.companyId,
        fromEmail,
        to,
        subject,
        body,
        sentBy: session.user?.name ?? session.user?.email ?? null,
        context: "welcome",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Welcome email failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
