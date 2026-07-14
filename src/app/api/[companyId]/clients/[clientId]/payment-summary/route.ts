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

  const [invoices, changeOrders, estimates] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId: params.companyId, clientId: params.clientId },
      include: { payments: true },
    }),
    prisma.changeOrder.findMany({
      where: { companyId: params.companyId, clientId: params.clientId },
      include: { items: true, payments: true },
    }),
    prisma.estimateTemplate.findMany({
      where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null, type: "CLIENT_ESTIMATE" },
      include: {
        divisions: {
          where: { archivedAt: null },
          include: {
            items: { where: { archivedAt: null, groupId: null } },
            groups: { where: { archivedAt: null }, include: { items: { where: { archivedAt: null } } } },
          },
        },
      },
    }),
  ]);

  const estimateTotal = estimates.reduce((sum, est) => {
    const raw = est.divisions.reduce((s, div) => {
      if (div.manualTotal != null) return s + Number(div.manualTotal);
      const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
      return s + allItems.filter(i => i.detail !== "Excluded").reduce((ss, i) => {
        const qty = i.defaultQty ? Number(i.defaultQty) : 0;
        const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
        const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
        return ss + qty * cost * (1 + markup / 100);
      }, 0);
    }, 0);
    const fee = est.gcFeePercent ? raw * Number(est.gcFeePercent) / 100 : 0;
    return sum + raw + fee;
  }, 0);

  // Draft invoices aren't real yet — don't count them as invoiced.
  const countedInvoices = invoices.filter(inv => inv.status !== "DRAFT");
  const rawInvoiced = countedInvoices.reduce((s, inv) => s + Number(inv.amount), 0);
  const totalPct = countedInvoices.reduce((s, inv) => s + Number(inv.pct ?? 0), 0);
  const fullyInvoiced = totalPct >= 99.5 || (estimateTotal > 0 && Math.abs(estimateTotal - rawInvoiced) <= Math.max(200, estimateTotal * 0.005));
  const totalInvoiced = fullyInvoiced ? estimateTotal : rawInvoiced;
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
