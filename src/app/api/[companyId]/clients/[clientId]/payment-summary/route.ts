import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [invoices, changeOrders] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId: params.companyId, clientId: params.clientId },
      include: { payments: true },
    }),
    prisma.changeOrder.findMany({
      where: { companyId: params.companyId, clientId: params.clientId },
      include: { items: true, payments: true },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.amount), 0);
  const invoicePaid = invoices.reduce(
    (s, inv) => s + inv.payments.reduce((ps, p) => ps + Number(p.amount), 0),
    0,
  );

  const approvedCos = changeOrders.filter(co => co.status === "APPROVED" || !!co.signedAt);
  const totalChangeOrders = approvedCos.reduce((sum, co) => {
    return sum + co.items.reduce((s, it) => {
      const qty = it.qty != null ? Number(it.qty) : 0;
      const cost = it.unitCost != null ? Number(it.unitCost) : 0;
      const markup = it.markupPct != null ? Number(it.markupPct) : 0;
      return s + qty * cost * (1 + markup / 100);
    }, 0);
  }, 0);
  const coPaid = approvedCos.reduce(
    (s, co) => s + co.payments.reduce((ps, p) => ps + Number(p.amount), 0),
    0,
  );

  const totalPaid = invoicePaid + coPaid;
  const balance = (totalInvoiced + totalChangeOrders) - totalPaid;

  if (totalInvoiced === 0 && totalChangeOrders === 0) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    totalInvoiced,
    totalChangeOrders,
    totalPaid,
    balance,
  });
}
