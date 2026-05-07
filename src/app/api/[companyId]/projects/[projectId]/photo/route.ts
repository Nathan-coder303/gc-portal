import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("photo") as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop() ?? "jpg";
    const safeName = `${Date.now()}.${ext}`;

    const blob = await put(`project-photos/${params.projectId}/${safeName}`, file, {
      access: "private",
      contentType: file.type || "image/jpeg",
    });

    await prisma.project.update({
      where: { id: params.projectId, companyId: params.companyId },
      data: { photoUrl: blob.url },
    });

    // Return a proxy URL so the client can display private blob images
    const proxyUrl = `/api/${params.companyId}/blob-proxy?u=${encodeURIComponent(blob.url)}`;
    return NextResponse.json({ url: proxyUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
