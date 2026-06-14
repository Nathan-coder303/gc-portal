import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, method, paidDate, notes } = await req.json() as { amount: string | number; method: string; paidDate: string; notes?: string | null };
  const co = await prisma.changeOrder.findFirst({
    where: { id: params.changeOrderId, companyId: params.companyId, clientId: params.clientId },
  });
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const created = await prisma.changeOrderPayment.create({
    data: {
      changeOrderId: co.id,
      amount: typeof amount === "string" ? amount : String(amount),
      method,
      paidDate: new Date(paidDate),
      notes: notes ?? null,
    },
  });

  return NextResponse.json({
    id: created.id,
    amount: Number(created.amount),
    method: created.method,
    paidDate: created.paidDate.toISOString(),
    notes: created.notes,
    changeOrderId: created.changeOrderId,
  });
}
