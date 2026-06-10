import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";
export const maxDuration = 60;

const PORTAL_BASE = process.env.PORTAL_BASE_URL ?? "https://portal.mibhconstruction.com";

function encodeSubject(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find contractor messages older than 24h where client hasn't replied and reminder not yet sent
  const unreplied = await prisma.clientMessage.findMany({
    where: {
      senderType: "CONTRACTOR",
      reminderSent: false,
      createdAt: { lt: cutoff },
    },
    select: { id: true, clientId: true, companyId: true, createdAt: true, content: true },
    distinct: ["clientId"],
  });

  let sent = 0;
  for (const msg of unreplied) {
    // Check if the client has replied since this message
    const clientReply = await prisma.clientMessage.findFirst({
      where: {
        clientId: msg.clientId,
        senderType: "CLIENT",
        createdAt: { gt: msg.createdAt },
      },
    });
    if (clientReply) {
      // Client did reply — just mark reminder sent so we don't check again
      await prisma.clientMessage.update({ where: { id: msg.id }, data: { reminderSent: true } });
      continue;
    }

    const client = await prisma.client.findUnique({
      where: { id: msg.clientId },
      select: { name: true, contactName: true, email: true, emailList: true },
    });
    if (!client) continue;

    const emails = (client.emailList as string[] | null)?.filter(Boolean) ?? [];
    const to = emails.length > 0 ? emails.join(", ") : client.email;
    if (!to) continue;

    const portalUrl = `${PORTAL_BASE}/client-portal/${msg.clientId}`;
    const preview = msg.content?.slice(0, 200) ?? "See your portal for details.";

    try {
      const oauth2Client = await getGmailOAuth(msg.companyId);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const fromEmail = profile.data.emailAddress ?? "me";

      const subject = `Reminder: You have an unread message waiting — ${client.name}`;
      const body = [
        `Hi ${client.contactName || client.name},`,
        ``,
        `Just a friendly reminder that you have an unread message from your contractor that may require your attention.`,
        ``,
        `Preview: "${preview}"`,
        ``,
        `Please log in to your portal to view and reply:`,
        portalUrl,
        ``,
        `If you have any questions, feel free to reach out directly. We appreciate your prompt attention.`,
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

      await prisma.clientMessage.update({ where: { id: msg.id }, data: { reminderSent: true } });
      sent++;
    } catch (err) {
      console.error("Reminder email failed for clientId:", msg.clientId, err);
    }
  }

  return NextResponse.json({ sent });
}
