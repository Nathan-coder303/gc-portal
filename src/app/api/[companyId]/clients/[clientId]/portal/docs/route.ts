import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.clientPortalDocument.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string | null;
  const label = formData.get("label") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!category || !label) return NextResponse.json({ error: "category and label required" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });

  const blob = await put(
    `portal-docs/${params.clientId}/${Date.now()}-${file.name}`,
    file,
    { access: "private" }
  );

  const doc = await prisma.clientPortalDocument.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      category,
      label: label.trim(),
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
    },
  });

  return NextResponse.json(doc);
}

export async function DELETE(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docId = req.nextUrl.searchParams.get("id");
  if (!docId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const doc = await prisma.clientPortalDocument.findFirst({
    where: { id: docId, clientId: params.clientId },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await del(doc.fileUrl); } catch { /* ok if gone */ }
  await prisma.clientPortalDocument.delete({ where: { id: docId } });

  return NextResponse.json({ ok: true });
}
