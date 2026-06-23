import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH — update change order (title, status, notes, items)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.changeOrder.findFirst({
    where: { id: params.changeOrderId, companyId: params.companyId, clientId: params.clientId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, orderNumber, status, notes, items, signatureData, signedByName, timeDelay, daysDelayed, billingStatus } = body as {
    title?: string;
    orderNumber?: string;
    status?: string;
    notes?: string;
    signatureData?: string;
    signedByName?: string;
    timeDelay?: boolean;
    daysDelayed?: number | null;
    billingStatus?: string | null;
    items?: { id?: string; csiCode?: string; divisionName: string; name: string; description?: string; qty?: number; unit?: string; unitCost?: number; markupPct?: number; sortOrder?: number }[];
  };

  // If items are provided, replace all items
  if (items !== undefined) {
    await prisma.changeOrderItem.deleteMany({ where: { changeOrderId: params.changeOrderId } });
    if (items.length > 0) {
      await prisma.changeOrderItem.createMany({
        data: items.map((it, idx) => ({
          changeOrderId: params.changeOrderId,
          csiCode: it.csiCode || null,
          divisionName: it.divisionName,
          name: it.name,
          description: it.description || null,
          qty: it.qty ?? null,
          unit: it.unit || null,
          unitCost: it.unitCost ?? null,
          markupPct: it.markupPct ?? null,
          sortOrder: it.sortOrder ?? idx,
        })),
      });
    }
  }

  const updated = await prisma.changeOrder.update({
    where: { id: params.changeOrderId },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(orderNumber !== undefined ? { orderNumber: orderNumber || null } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(timeDelay !== undefined ? { timeDelay: !!timeDelay } : {}),
      ...(daysDelayed !== undefined ? { daysDelayed: daysDelayed == null ? null : Number(daysDelayed) } : {}),
      ...(billingStatus !== undefined ? { billingStatus: billingStatus || null } : {}),
      ...(signatureData !== undefined ? { signatureData, signedAt: new Date(), signedByName: signedByName || null } : {}),
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}

// DELETE — delete a change order
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.changeOrder.findFirst({
    where: { id: params.changeOrderId, companyId: params.companyId, clientId: params.clientId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.changeOrder.delete({ where: { id: params.changeOrderId } });
  return NextResponse.json({ success: true });
}
