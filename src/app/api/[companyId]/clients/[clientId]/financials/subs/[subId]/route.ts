import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { companyId: string; clientId: string; subId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updated = await prisma.clientSub.update({
    where: { id: params.subId },
    data: {
      contractAmount: body.contractAmount ?? undefined,
      subContractorId: body.subContractorId ?? undefined,
      subName: body.subName ?? undefined,
      scope: body.scope !== undefined ? (body.scope || null) : undefined,
      division: body.division !== undefined ? (body.division || null) : undefined,
      notes: body.notes ?? undefined,
    },
  });

  return NextResponse.json({
    contractAmount: Number(updated.contractAmount),
    scope: updated.scope ?? null,
    division: updated.division ?? null,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { companyId: string; clientId: string; subId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.clientSub.delete({ where: { id: params.subId } });
  return NextResponse.json({ ok: true });
}
