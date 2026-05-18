import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import crypto from "crypto";

export const runtime = "nodejs";

// GET — list all documents for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.clientDocument.findMany({
    where: { clientId: params.clientId, companyId: params.companyId, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(docs.map(d => ({
    ...d,
    originalFileUrl: `/api/${params.companyId}/clients/${params.clientId}/documents/${d.id}/file`,
    countersignedFileUrl: d.countersignedFileUrl
      ? `/api/${params.companyId}/clients/${params.clientId}/documents/${d.id}/file?executed=1`
      : null,
  })));
}

// POST — upload a new document
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const clientAlreadySigned = formData.get("clientAlreadySigned") === "true";
  const description = formData.get("description") as string | null;

  if (!file || !name?.trim()) return NextResponse.json({ error: "file and name required" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "PDF files only" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({ where: { id: params.clientId, companyId: params.companyId } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blob = await put(
    `client-docs/${params.clientId}/${Date.now()}-${file.name}`,
    file,
    { access: "private" }
  );

  const signatureToken = clientAlreadySigned ? null : crypto.randomBytes(32).toString("hex");

  const doc = await prisma.clientDocument.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      name: name.trim(),
      description: description?.trim() || null,
      originalFileUrl: blob.url,
      signatureToken,
      clientAlreadySigned,
      clientSignedAt: clientAlreadySigned ? new Date() : null,
      createdBy: session.user?.name ?? session.user?.email ?? null,
    },
  });

  return NextResponse.json({
    ...doc,
    originalFileUrl: `/api/${params.companyId}/clients/${params.clientId}/documents/${doc.id}/file`,
    countersignedFileUrl: null,
    signUrl: signatureToken ? `https://portal.mibhconstruction.com/sign-doc/${signatureToken}` : null,
  });
}

// DELETE — soft-delete a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });

  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await del(doc.originalFileUrl); } catch { /* non-fatal */ }
  if (doc.countersignedFileUrl) {
    try { await del(doc.countersignedFileUrl); } catch { /* non-fatal */ }
  }

  await prisma.$executeRawUnsafe(`UPDATE "ClientDocument" SET "archivedAt" = NOW() WHERE id = $1`, docId);

  return NextResponse.json({ success: true });
}
