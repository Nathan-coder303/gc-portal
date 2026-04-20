import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; assignmentId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const assignment = await prisma.subAssignment.update({
    where: { id: params.assignmentId },
    data: {
      subContractorId: body.subContractorId ?? null,
      subName: body.subName ?? null,
      cost: body.cost != null ? body.cost : null,
      salePrice: body.salePrice != null ? body.salePrice : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(assignment);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; assignmentId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.subAssignment.delete({ where: { id: params.assignmentId } });
  return NextResponse.json({ ok: true });
}
