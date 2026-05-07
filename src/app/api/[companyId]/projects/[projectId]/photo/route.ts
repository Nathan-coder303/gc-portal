import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — serve the project's private photo
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, companyId: params.companyId },
    select: { photoUrl: true },
  });
  if (!project?.photoUrl) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(project.photoUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Blob not found", { status: 404 });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// POST — upload a project photo
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

    // Return the dedicated photo endpoint URL (not the raw private blob URL)
    return NextResponse.json({ url: `/api/${params.companyId}/projects/${params.projectId}/photo` });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
