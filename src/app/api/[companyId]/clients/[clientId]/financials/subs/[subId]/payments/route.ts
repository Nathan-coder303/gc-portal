import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string; subId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const payment = await prisma.subPayment.create({
    data: {
      companyId: params.companyId,
      clientSubId: params.subId,
      amount: body.amount,
      method: body.method,
      paidAt: new Date(body.paidAt),
      checkNumber: body.checkNumber || null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({
    id: payment.id,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt.toISOString().slice(0, 10),
    checkNumber: payment.checkNumber,
    notes: payment.notes,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { paymentId, amount, method, paidAt, checkNumber, notes } = body;
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  const payment = await prisma.subPayment.update({
    where: { id: paymentId },
    data: {
      amount: amount ?? undefined,
      method: method ?? undefined,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      checkNumber: checkNumber !== undefined ? (checkNumber || null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  });

  return NextResponse.json({
    id: payment.id,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt.toISOString().slice(0, 10),
    checkNumber: payment.checkNumber,
    notes: payment.notes,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  await prisma.subPayment.delete({ where: { id: paymentId } });
  return NextResponse.json({ ok: true });
}
