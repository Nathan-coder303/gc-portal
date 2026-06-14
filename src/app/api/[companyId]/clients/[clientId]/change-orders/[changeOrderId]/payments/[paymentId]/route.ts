import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string; paymentId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { amount?: string | number; method?: string; paidDate?: string; notes?: string | null };
  const updated = await prisma.changeOrderPayment.update({
    where: { id: params.paymentId },
    data: {
      ...(body.amount != null ? { amount: typeof body.amount === "string" ? body.amount : String(body.amount) } : {}),
      ...(body.method ? { method: body.method } : {}),
      ...(body.paidDate ? { paidDate: new Date(body.paidDate) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
  return NextResponse.json({
    id: updated.id,
    amount: Number(updated.amount),
    method: updated.method,
    paidDate: updated.paidDate.toISOString(),
    notes: updated.notes,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string; paymentId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.changeOrderPayment.delete({ where: { id: params.paymentId } });
  return NextResponse.json({ success: true });
}
