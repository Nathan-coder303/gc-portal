import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function syncContractAmount(subId: string) {
  const items = await prisma.subScopeItem.findMany({ where: { clientSubId: subId }, select: { amount: true } });
  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  await prisma.clientSub.update({ where: { id: subId }, data: { contractAmount: total } });
  return total;
}

// POST: add one or many scope items
export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string; subId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // body can be { items: [{csiCode, name, amount, salePrice}] } or single item
  const items: { csiCode?: string | null; name: string; amount?: number; salePrice?: number | null }[] = Array.isArray(body.items) ? body.items : [body];

  const created = await prisma.$transaction(
    items.map(item =>
      prisma.subScopeItem.create({
        data: {
          companyId: params.companyId,
          clientSubId: params.subId,
          csiCode: item.csiCode || null,
          name: item.name,
          amount: item.amount ?? 0,
          salePrice: item.salePrice ?? null,
        },
      })
    )
  );

  const total = await syncContractAmount(params.subId);

  return NextResponse.json({
    items: created.map(i => ({ id: i.id, csiCode: i.csiCode, name: i.name, amount: Number(i.amount), salePrice: i.salePrice ? Number(i.salePrice) : null })),
    contractAmount: total,
  });
}

// PATCH: update a single item's amount or name
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, amount, name } = body;
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const item = await prisma.subScopeItem.update({
    where: { id: itemId },
    data: {
      amount: amount !== undefined ? amount : undefined,
      name: name !== undefined ? name : undefined,
    },
  });

  const total = await syncContractAmount(item.clientSubId);

  return NextResponse.json({ id: item.id, amount: Number(item.amount), name: item.name, contractAmount: total });
}

// DELETE: remove a scope item
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const item = await prisma.subScopeItem.delete({ where: { id: itemId } });
  const total = await syncContractAmount(item.clientSubId);

  return NextResponse.json({ ok: true, contractAmount: total });
}
