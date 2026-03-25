import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

// POST — upload a custom cover photo for a client
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  // Delete old custom cover if exists
  if (client.coverPhotoUrl && client.coverPhotoType === "CUSTOM") {
    try { await del(client.coverPhotoUrl); } catch { /* non-fatal */ }
  }

  const blob = await put(
    `client-covers/${params.clientId}/${Date.now()}-${file.name}`,
    file,
    { access: "public" } // public so PDF renderer can fetch it directly
  );

  await prisma.client.update({
    where: { id: params.clientId },
    data: { coverPhotoType: "CUSTOM", coverPhotoUrl: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
