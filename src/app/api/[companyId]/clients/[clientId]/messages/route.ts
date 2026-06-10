import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";
export const maxDuration = 30;

const PORTAL_BASE = process.env.PORTAL_BASE_URL ?? "https://portal.mibhconstruction.com";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages = await prisma.clientMessage.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "asc" },
  });

  // Mark contractor-side as read by contractor
  await prisma.clientMessage.updateMany({
    where: { clientId: params.clientId, companyId: params.companyId, senderType: "CLIENT", readByContractor: false },
    data: { readByContractor: true },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let content = "";
  let notifyClient = true;
  let attachments: { id: string; name: string; url: string; mimeType: string }[] = [];
  let replyToId: string | null = null;

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json() as { content?: string; notifyClient?: boolean; attachments?: typeof attachments; replyToId?: string | null };
    content = body.content ?? "";
    notifyClient = body.notifyClient ?? true;
    attachments = body.attachments ?? [];
    replyToId = body.replyToId ?? null;
  } else {
    const formData = await req.formData();
    content = (formData.get("content") as string) ?? "";
    notifyClient = formData.get("notifyClient") === "true";
    const files = formData.getAll("files") as File[];
    for (const file of files) {
      if (file.size > 0) {
        try {
          const blob = await put(`messages/${params.clientId}/${Date.now()}-${file.name}`, file, { access: "private" });
          attachments.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url: blob.url, mimeType: file.type || "application/octet-stream" });
        } catch (err) { console.error("attachment upload failed:", err); }
      }
    }
  }

  const message = await prisma.clientMessage.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      content,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      senderType: "CONTRACTOR",
      senderName: session.user?.name ?? session.user?.email ?? "Team",
      readByContractor: true,
      replyToId: replyToId ?? undefined,
    },
  });

  // Mirror each attachment into ClientFile so it shows up in the Files tab
  if (attachments.length > 0) {
    const senderLabel = session.user?.name ?? session.user?.email ?? "Team";
    await prisma.clientFile.createMany({
      data: attachments.map(att => ({
        clientId: params.clientId,
        companyId: params.companyId,
        fileName: att.name,
        fileUrl: att.url,
        fileSize: 0,
        mimeType: att.mimeType || null,
        uploadedBy: `Message from ${senderLabel}`,
        sourceMessageId: message.id,
        clientVisible: false,
      })),
    });
  }

  // Email client if requested
  if (notifyClient) {
    const client = await prisma.client.findFirst({
      where: { id: params.clientId },
      select: { name: true, contactName: true, email: true, emailList: true, messageCcEmails: true },
    });
    const emails = (client?.emailList as string[] | null)?.filter(Boolean) ?? [];
    const to = emails.length > 0 ? emails.join(", ") : client?.email;
    const ccList = ((client?.messageCcEmails as string[] | null) ?? []).filter(Boolean);
    if (to) {
      try {
        const oauth2Client = await getGmailOAuth(params.companyId);
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const fromEmail = profile.data.emailAddress ?? "me";
        const portalUrl = `${PORTAL_BASE}/client-portal/${params.clientId}`;
        const subject = `New message from your contractor — action may be needed`;
        const body = `Hi ${client?.contactName || client?.name || "there"},\n\nYou have a new message from your contractor:\n\n"${content.slice(0, 300)}${content.length > 300 ? "…" : ""}"\n\nPlease log in to your portal to view and reply:\n${portalUrl}\n\nThank you`;
        const mimeLines = [
          `From: ${fromEmail}`,
          `To: ${to}`,
          ...(ccList.length > 0 ? [`Cc: ${ccList.join(", ")}`] : []),
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          body,
        ];
        const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      } catch (err) { console.error("notify email failed:", err); }
    }
  }

  return NextResponse.json(message, { status: 201 });
}
