import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suppliers = await prisma.supplier.findMany({
    where: { companyId: params.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: { companyId: params.companyId, name: name.trim() },
  });

  return NextResponse.json({ id: supplier.id, name: supplier.name });
}
