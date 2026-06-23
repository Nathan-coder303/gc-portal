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

async function loadCo(companyId: string, clientId: string, changeOrderId: string) {
  return prisma.changeOrder.findFirst({
    where: { id: changeOrderId, clientId, companyId },
    select: { attachments: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const co = await loadCo(params.companyId, params.clientId, params.changeOrderId);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(parseAttachments(co.attachments));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const co = await loadCo(params.companyId, params.clientId, params.changeOrderId);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let newAttachment: Attachment;

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = await req.json() as { name: string; url: string; size: number; mimeType: string };
    newAttachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: body.name,
      url: body.url,
      size: body.size,
      mimeType: body.mimeType || "application/octet-stream",
    };
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });

    let blob;
    try {
      blob = await put(`change-orders/${params.changeOrderId}/${Date.now()}-${file.name}`, file, { access: "private" });
    } catch (err) {
      console.error("Blob upload failed:", err);
      return NextResponse.json({ error: `Upload failed: ${String(err)}` }, { status: 500 });
    }
    newAttachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      url: blob.url,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
    };
  }

  const existing = parseAttachments(co.attachments);
  const updated = [...existing, newAttachment];

  await prisma.changeOrder.update({
    where: { id: params.changeOrderId },
    data: { attachments: JSON.stringify(updated) },
  });

  return NextResponse.json(newAttachment, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachmentId = req.nextUrl.searchParams.get("id");
  if (!attachmentId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { name?: string };
  const newName = body.name?.trim();
  if (!newName) return NextResponse.json({ error: "name required" }, { status: 400 });

  const co = await loadCo(params.companyId, params.clientId, params.changeOrderId);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = parseAttachments(co.attachments);
  const target = existing.find(a => a.id === attachmentId);
  if (!target) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  const updated = existing.map(a => a.id === attachmentId ? { ...a, name: newName } : a);
  await prisma.changeOrder.update({
    where: { id: params.changeOrderId },
    data: { attachments: JSON.stringify(updated) },
  });

  return NextResponse.json(updated.find(a => a.id === attachmentId));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachmentId = req.nextUrl.searchParams.get("id");
  if (!attachmentId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const co = await loadCo(params.companyId, params.clientId, params.changeOrderId);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = parseAttachments(co.attachments);
  const target = existing.find(a => a.id === attachmentId);
  if (!target) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  try { await del(target.url); } catch { /* non-fatal */ }

  const updated = existing.filter(a => a.id !== attachmentId);
  await prisma.changeOrder.update({
    where: { id: params.changeOrderId },
    data: { attachments: JSON.stringify(updated) },
  });

  return NextResponse.json({ success: true });
}
