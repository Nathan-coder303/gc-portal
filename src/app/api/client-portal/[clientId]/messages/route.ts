import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { sendPushover } from "@/lib/pushover";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await auth();
  if (!session || (session.user.role === "CLIENT" && session.user.clientId !== params.clientId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await prisma.clientMessage.findMany({
    where: { clientId: params.clientId },
    orderBy: { createdAt: "asc" },
  });

  // Mark as read by client
  await prisma.clientMessage.updateMany({
    where: { clientId: params.clientId, senderType: "CONTRACTOR", readByClient: false },
    data: { readByClient: true },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await auth();
  if (!session || (session.user.role === "CLIENT" && session.user.clientId !== params.clientId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { companyId: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let content = "";
  let attachments: { id: string; name: string; url: string; mimeType: string }[] = [];

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json() as { content?: string; attachments?: typeof attachments };
    content = body.content ?? "";
    attachments = body.attachments ?? [];
  } else {
    const formData = await req.formData();
    content = (formData.get("content") as string) ?? "";
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
      companyId: client.companyId,
      clientId: params.clientId,
      content,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      senderType: "CLIENT",
      senderName: session.user.name ?? client.name,
      readByClient: true,
    },
  });

  const preview = content.slice(0, 100) + (content.length > 100 ? "…" : "");
  const hasAttachments = attachments.length > 0;
  const notifMessage = [
    preview || null,
    hasAttachments ? `📎 ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join("\n") || "(no text)";

  const portalBase = process.env.PORTAL_BASE_URL ?? "https://portal.mibhconstruction.com";
  await sendPushover({
    title: `Message from ${client.name}`,
    message: notifMessage,
    url: `${portalBase}/client-portal/${params.clientId}`,
    urlTitle: "Open Portal",
    priority: 1,
  });

  return NextResponse.json(message, { status: 201 });
}
