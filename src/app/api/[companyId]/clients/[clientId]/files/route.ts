import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

// POST — upload a file for a client
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blob = await put(
    `client-files/${params.clientId}/${Date.now()}-${file.name}`,
    file,
    { access: "public" }
  );

  const record = await prisma.clientFile.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      mimeType: file.type || null,
      uploadedBy: session.user.id,
    },
  });

  return NextResponse.json(record);
}

// DELETE — remove a file by id (passed as query param)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

  const file = await prisma.clientFile.findFirst({
    where: { id: fileId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await del(file.fileUrl);
  } catch {
    // Non-fatal if blob already gone
  }

  await prisma.clientFile.delete({ where: { id: fileId } });

  return NextResponse.json({ success: true });
}
