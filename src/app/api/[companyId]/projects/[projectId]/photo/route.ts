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

  const form = await req.formData();
  const file = form.get("photo") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const blob = await put(`project-photos/${params.projectId}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.project.update({
    where: { id: params.projectId, companyId: params.companyId },
    data: { photoUrl: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
