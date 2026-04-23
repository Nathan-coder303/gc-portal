import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.clientSub.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "asc" },
    include: {
      subContractor: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });

  return NextResponse.json(subs.map(s => ({
    id: s.id,
    subContractorId: s.subContractorId,
    subName: s.subName ?? s.subContractor?.name ?? "",
    contractAmount: Number(s.contractAmount),
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    payments: s.payments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString().slice(0, 10),
      checkNumber: p.checkNumber,
      notes: p.notes,
    })),
  })));
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subContractorId, subName, contractAmount, notes } = body;

  const sub = await prisma.clientSub.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      subContractorId: subContractorId || null,
      subName: subName || null,
      contractAmount: contractAmount ?? 0,
      notes: notes || null,
    },
    include: { payments: true },
  });

  return NextResponse.json({
    id: sub.id,
    subContractorId: sub.subContractorId,
    subName: sub.subName,
    contractAmount: Number(sub.contractAmount),
    notes: sub.notes,
    createdAt: sub.createdAt.toISOString(),
    payments: [],
  });
}
