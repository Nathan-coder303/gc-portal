import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { companyId: string; subId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sub = await prisma.subContractor.update({
    where: { id: params.subId },
    data: {
      name: body.name,
      contactName: body.contactName ?? null,
      address: body.address ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      divisionCode: body.divisionCode,
      divisionName: body.divisionName,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(sub);
}

export async function DELETE(_req: NextRequest, { params }: { params: { companyId: string; subId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.subContractor.delete({ where: { id: params.subId } });
  return NextResponse.json({ ok: true });
}
