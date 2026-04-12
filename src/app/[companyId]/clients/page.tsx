import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import ClientsManager from "./ClientsManager";

type DivisionLike = { items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[]; groups: { items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[] }[] };

function calcRaw(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => {
    const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
    return sum + allItems.reduce((s, i) => {
      const qty = i.defaultQty ? Number(i.defaultQty) : 0;
      const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
      const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
      return s + qty * cost * (1 + markup / 100);
    }, 0);
  }, 0);
}

function calcMarkupTotal(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => {
    const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
    return sum + allItems.reduce((s, i) => {
      const qty = i.defaultQty ? Number(i.defaultQty) : 0;
      const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
      const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
      return s + qty * cost * (markup / 100);
    }, 0);
  }, 0);
}

function calcEstimateTotal(divisions: DivisionLike[], gcFeePercent: unknown): number {
  const raw = calcRaw(divisions);
  const fee = gcFeePercent ? raw * Number(gcFeePercent) / 100 : 0;
  return raw + fee;
}

function calcGcFeeAmt(divisions: DivisionLike[], gcFeePercent: unknown): number {
  if (!gcFeePercent) return 0;
  return calcRaw(divisions) * Number(gcFeePercent) / 100;
}

export default async function ClientsPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const [clients] = await Promise.all([
  prisma.client.findMany({
    where: { companyId: params.companyId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { templates: { where: { type: "CLIENT_ESTIMATE", archivedAt: null } } } },
      templates: {
        where: { type: "CLIENT_ESTIMATE", archivedAt: null },
        select: {
          gcFeePercent: true,
          internalProfitOverride: true,
          divisions: {
            where: { archivedAt: null },
            select: {
              items: { where: { archivedAt: null, groupId: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } },
              groups: {
                where: { archivedAt: null },
                select: { items: { where: { archivedAt: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } } },
              },
            },
          },
        },
      },
    },
  }),
  ]);

  const isAdmin = can(session.user.role, "estimateTemplate:edit");

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <ClientsManager
        companyId={params.companyId}
        clients={clients.map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
          email: c.email,
          phone: c.phone,
          estimateCount: c._count.templates,
          estimateTotal: c.templates.reduce((sum, t) => sum + calcEstimateTotal(t.divisions, t.gcFeePercent), 0),
          internalProfit: c.templates.reduce((sum, t) => {
            if (t.internalProfitOverride != null) return sum + Number(t.internalProfitOverride);
            return sum + calcMarkupTotal(t.divisions);
          }, 0),
          gcFee: c.templates.reduce((sum, t) => sum + calcGcFeeAmt(t.divisions, t.gcFeePercent), 0),
          status: c.status,
          sortOrder: c.sortOrder,
        }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
