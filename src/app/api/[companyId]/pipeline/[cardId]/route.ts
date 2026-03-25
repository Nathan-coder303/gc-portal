import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH — update pipeline card fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; cardId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const card = await prisma.pipelineCard.findFirst({
    where: { id: params.cardId, companyId: params.companyId },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { stage, displayName, estimateValue, notes, sortOrder, clientId } = body;

  const updated = await prisma.pipelineCard.update({
    where: { id: params.cardId },
    data: {
      ...(stage !== undefined ? { stage } : {}),
      ...(displayName !== undefined ? { displayName } : {}),
      ...(estimateValue !== undefined ? { estimateValue: estimateValue != null ? estimateValue : null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(clientId !== undefined ? { clientId: clientId || null } : {}),
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE — delete a pipeline card
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; cardId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const card = await prisma.pipelineCard.findFirst({
    where: { id: params.cardId, companyId: params.companyId },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pipelineCard.delete({ where: { id: params.cardId } });

  return NextResponse.json({ success: true });
}
