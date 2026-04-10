import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    orderBy: [{ divisionCode: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sub = await prisma.subContractor.create({
    data: {
      companyId: params.companyId,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      divisionCode: body.divisionCode,
      divisionName: body.divisionName,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(sub, { status: 201 });
}
