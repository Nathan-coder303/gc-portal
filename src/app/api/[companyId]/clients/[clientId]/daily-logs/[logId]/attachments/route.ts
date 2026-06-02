import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

type Attachment = { id: string; name: string; url: string; size: number; mimeType: string };

function parseAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as Attachment[]; } catch { return []; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    select: { attachments: true },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(parseAttachments(log.attachments));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    select: { attachments: true },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });

  let blob;
  try {
    blob = await put(
      `daily-logs/${params.logId}/${Date.now()}-${file.name}`,
      file,
      { access: "public" }
    );
  } catch (err) {
    console.error("Blob upload failed:", err);
    return NextResponse.json({ error: `Upload failed: ${String(err)}` }, { status: 500 });
  }

  const newAttachment: Attachment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    url: blob.url,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };

  const existing = parseAttachments(log.attachments);
  const updated = [...existing, newAttachment];

  await prisma.dailyLog.update({
    where: { id: params.logId },
    data: { attachments: JSON.stringify(updated) },
  });

  return NextResponse.json(newAttachment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachmentId = req.nextUrl.searchParams.get("id");
  if (!attachmentId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    select: { attachments: true },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = parseAttachments(log.attachments);
  const target = existing.find(a => a.id === attachmentId);
  if (!target) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  try { await del(target.url); } catch { /* non-fatal */ }

  const updated = existing.filter(a => a.id !== attachmentId);
  await prisma.dailyLog.update({
    where: { id: params.logId },
    data: { attachments: JSON.stringify(updated) },
  });

  return NextResponse.json({ success: true });
}
