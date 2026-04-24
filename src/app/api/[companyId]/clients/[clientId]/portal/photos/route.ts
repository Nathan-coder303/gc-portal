import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photos = await prisma.clientPortalPhoto.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: [{ sortOrder: "asc" }, { uploadedAt: "desc" }],
  });

  return NextResponse.json(photos);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  const blob = await put(
    `portal-photos/${params.clientId}/${Date.now()}-${file.name}`,
    file,
    { access: "private" }
  );

  const photo = await prisma.clientPortalPhoto.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      caption: caption || null,
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
    },
  });

  return NextResponse.json(photo);
}

export async function DELETE(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photoId = req.nextUrl.searchParams.get("id");
  if (!photoId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const photo = await prisma.clientPortalPhoto.findFirst({
    where: { id: photoId, clientId: params.clientId },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await del(photo.fileUrl); } catch { /* ok if gone */ }
  await prisma.clientPortalPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ ok: true });
}
