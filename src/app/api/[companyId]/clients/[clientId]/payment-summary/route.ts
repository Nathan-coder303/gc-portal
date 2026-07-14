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

  const calcI = (i: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown; detail: string | null }) =>
    i.detail === "Excluded" ? 0 : Number(i.defaultQty ?? 0) * Number(i.defaultUnitCost ?? 0) * (1 + Number(i.defaultMarkupPct ?? 0) / 100);
  // Per-estimate total (respects division AND group lump sums).
  const estTotalById = new Map<string, number>();
  for (const est of estimates) {
    const raw = est.divisions.reduce((s, div) => {
      if (div.manualTotal != null) return s + Number(div.manualTotal);
      const groupsTotal = div.groups.reduce((gs, g) => gs + (g.manualTotal != null ? Number(g.manualTotal) : g.items.reduce((ss, i) => ss + calcI(i), 0)), 0);
      return s + div.items.reduce((ss, i) => ss + calcI(i), 0) + groupsTotal;
    }, 0);
    const fee = est.gcFeePercent ? raw * Number(est.gcFeePercent) / 100 : 0;
    estTotalById.set(est.id, raw + fee);
  }

  // Draft invoices aren't real yet — don't count them as invoiced.
  // Snap PER ESTIMATE: when an estimate is fully invoiced, show that estimate's total
  // (avoids rounding drift), but never inflate to the sum of OTHER estimates.
  const countedInvoices = invoices.filter(inv => inv.status !== "DRAFT");
  const invByEst = new Map<string, { raw: number; pct: number }>();
  for (const inv of countedInvoices) {
    const cur = invByEst.get(inv.estimateId) ?? { raw: 0, pct: 0 };
    cur.raw += Number(inv.amount);
    cur.pct += Number(inv.pct ?? 0);
    invByEst.set(inv.estimateId, cur);
  }
  let totalInvoiced = 0;
  invByEst.forEach(({ raw, pct }, estId) => {
    const estT = estTotalById.get(estId) ?? 0;
    const fully = estT > 0 && (pct >= 99.5 || Math.abs(estT - raw) <= Math.max(200, estT * 0.005));
    totalInvoiced += fully ? estT : raw;
  });
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
