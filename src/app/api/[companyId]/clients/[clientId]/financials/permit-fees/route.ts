import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fees = await prisma.permitFee.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { incurredAt: "desc" },
  });

  return NextResponse.json(fees.map(f => ({
    id: f.id,
    name: f.name,
    amount: Number(f.amount),
    description: f.description,
    incurredAt: f.incurredAt.toISOString().slice(0, 10),
    notes: f.notes,
  })));
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const fee = await prisma.permitFee.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      name: body.name || null,
      amount: body.amount,
      description: body.description || null,
      incurredAt: new Date(body.incurredAt),
      notes: body.notes || null,
    },
  });

  return NextResponse.json({
    id: fee.id,
    name: fee.name,
    amount: Number(fee.amount),
    description: fee.description,
    incurredAt: fee.incurredAt.toISOString().slice(0, 10),
    notes: fee.notes,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const feeId = req.nextUrl.searchParams.get("id");
  if (!feeId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.permitFee.delete({ where: { id: feeId } });
  return NextResponse.json({ ok: true });
}
