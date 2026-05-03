import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list payments for an invoice
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await prisma.payment.findMany({
    where: { invoiceId: params.invoiceId, companyId: params.companyId },
    orderBy: { paidDate: "asc" },
  });
  return NextResponse.json(payments);
}

// POST — record a payment against an invoice
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { amount, method, paidDate, notes } = body;

  if (!amount || !method) {
    return NextResponse.json({ error: "amount and method are required" }, { status: 400 });
  }

  // Verify invoice belongs to this company/client
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, companyId: params.companyId, clientId: params.clientId },
    include: { payments: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const payment = await prisma.payment.create({
    data: {
      invoiceId: params.invoiceId,
      companyId: params.companyId,
      amount: parseFloat(amount),
      method,
      paidDate: paidDate ? new Date(paidDate) : new Date(),
      notes: notes ?? null,
    },
  });

  // Auto-mark invoice PAID if total payments >= invoice amount
  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0) + parseFloat(amount);
  if (totalPaid >= invoice.amount && invoice.status !== "PAID") {
    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  // Touch client updatedAt so it bubbles to top of "newest" sort
  await prisma.client.update({ where: { id: params.clientId }, data: {} });

  return NextResponse.json(payment);
}
