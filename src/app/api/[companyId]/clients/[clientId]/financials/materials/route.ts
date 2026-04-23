import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const purchases = await prisma.materialPurchase.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { purchasedAt: "desc" },
    include: { supplier: { select: { id: true, name: true } } },
  });

  return NextResponse.json(purchases.map(p => ({
    id: p.id,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    amount: Number(p.amount),
    description: p.description,
    purchasedAt: p.purchasedAt.toISOString().slice(0, 10),
    notes: p.notes,
  })));
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const purchase = await prisma.materialPurchase.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      supplierId: body.supplierId,
      amount: body.amount,
      description: body.description || null,
      purchasedAt: new Date(body.purchasedAt),
      notes: body.notes || null,
    },
    include: { supplier: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    id: purchase.id,
    supplierId: purchase.supplierId,
    supplierName: purchase.supplier.name,
    amount: Number(purchase.amount),
    description: purchase.description,
    purchasedAt: purchase.purchasedAt.toISOString().slice(0, 10),
    notes: purchase.notes,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const purchaseId = req.nextUrl.searchParams.get("id");
  if (!purchaseId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.materialPurchase.delete({ where: { id: purchaseId } });
  return NextResponse.json({ ok: true });
}
