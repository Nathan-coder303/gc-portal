import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list change orders for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.changeOrder.findMany({
    where: { companyId: params.companyId, clientId: params.clientId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidDate: "desc" } },
    },
  });

  return NextResponse.json(orders);
}

// POST — create a new change order
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, orderNumber, notes, items, timeDelay, daysDelayed, billingStatus } = body as {
    title: string;
    orderNumber?: string;
    notes?: string;
    timeDelay?: boolean;
    daysDelayed?: number | null;
    billingStatus?: string | null;
    items?: { csiCode?: string; divisionName: string; name: string; description?: string; qty?: number; unit?: string; unitCost?: number; markupPct?: number; sortOrder?: number }[];
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const order = await prisma.changeOrder.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      title: title.trim(),
      orderNumber: orderNumber || null,
      notes: notes || null,
      timeDelay: !!timeDelay,
      daysDelayed: daysDelayed == null ? null : Number(daysDelayed),
      billingStatus: billingStatus || null,
      items: items?.length
        ? {
            create: items.map((it, idx) => ({
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
          }
        : undefined,
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(order);
}
