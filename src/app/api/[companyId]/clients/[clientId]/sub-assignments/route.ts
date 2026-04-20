import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.subAssignment.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(assignments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const assignment = await prisma.subAssignment.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      templateId: body.templateId ?? null,
      divisionId: body.divisionId ?? null,
      itemId: body.itemId ?? null,
      label: body.label,
      subContractorId: body.subContractorId ?? null,
      subName: body.subName ?? null,
      cost: body.cost != null ? body.cost : null,
      salePrice: body.salePrice != null ? body.salePrice : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(assignment, { status: 201 });
}
