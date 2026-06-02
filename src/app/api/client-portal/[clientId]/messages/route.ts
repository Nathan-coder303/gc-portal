import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

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

  const formData = await req.formData();
  const content = (formData.get("content") as string) ?? "";
  const files = formData.getAll("files") as File[];

  const attachments: { id: string; name: string; url: string; mimeType: string }[] = [];
  for (const file of files) {
    if (file.size > 0) {
      try {
        const blob = await put(`messages/${params.clientId}/${Date.now()}-${file.name}`, file, { access: "private" });
        attachments.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, url: blob.url, mimeType: file.type || "application/octet-stream" });
      } catch (err) { console.error("attachment upload failed:", err); }
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

  return NextResponse.json(message, { status: 201 });
}
