import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";

// PATCH — mark complete/incomplete or update text
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; followUpId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.followUp.findFirst({
    where: { id: params.followUpId, companyId: params.companyId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.followUp.update({
    where: { id: params.followUpId },
    data: {
      ...(body.completedAt !== undefined ? { completedAt: body.completedAt ? new Date(body.completedAt) : null } : {}),
      ...(body.text !== undefined ? { text: body.text } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — delete follow-up and its audio blob if present
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; followUpId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.followUp.findFirst({
    where: { id: params.followUpId, companyId: params.companyId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.audioUrl) {
    try { await del(item.audioUrl); } catch { /* non-fatal */ }
  }

  await prisma.followUp.delete({ where: { id: params.followUpId } });

  return NextResponse.json({ success: true });
}
