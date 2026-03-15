import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import ProjectEstimateEditor from "@/components/estimates/ProjectEstimateEditor";
import { getCorrectCsiCode, lookupItemCsiCode } from "@/lib/divisions";

export default async function EstimateEditorPage({
  params,
}: {
  params: { companyId: string; projectId: string; estimateId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}/${params.projectId}/dashboard`);

  const estimate = await prisma.projectEstimate.findFirst({
    where: { id: params.estimateId, projectId: params.projectId, archivedAt: null },
    include: {
      divisions: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
            },
          },
          items: {
            where: { archivedAt: null, groupId: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!estimate) redirect(`/${params.companyId}/${params.projectId}/estimates`);

  // Auto-apply / upgrade CSI codes for divisions missing or using old short codes
  const needsCsiUpdate = estimate.divisions
    .map(d => ({ d, code: getCorrectCsiCode(d.name, d.csiCode) }))
    .filter(({ code }) => code !== undefined);
  if (needsCsiUpdate.length > 0) {
    await Promise.all(needsCsiUpdate.map(({ d, code }) =>
      prisma.projectEstimateDivision.update({ where: { id: d.id }, data: { csiCode: code } })
    ));
    needsCsiUpdate.forEach(({ d, code }) => { d.csiCode = code ?? null; });
  }

  // Auto-populate item CSI codes for items that have none
  const allItems = estimate.divisions.flatMap(d => [...d.items, ...d.groups.flatMap(g => g.items)]);
  const itemsNeedingCsi = allItems.filter(i => !i.csiCode).map(i => ({ i, code: lookupItemCsiCode(i.name) })).filter(({ code }) => code !== undefined);
  if (itemsNeedingCsi.length > 0) {
    await Promise.all(itemsNeedingCsi.map(({ i, code }) =>
      prisma.projectEstimateItem.update({ where: { id: i.id }, data: { csiCode: code } })
    ));
    itemsNeedingCsi.forEach(({ i, code }) => { i.csiCode = code ?? null; });
  }

  const divisions = estimate.divisions.map((d) => ({
    id: d.id,
    csiCode: d.csiCode,
    name: d.name,
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        csiCode: i.csiCode,
        unit: i.unit,
        qty: Number(i.qty),
        unitCost: Number(i.unitCost),
        laborCost: Number(i.laborCost),
        materialCost: Number(i.materialCost),
        markupPct: Number(i.markupPct),
        manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
        vendor: i.vendor,
        notes: i.notes,
        sortOrder: i.sortOrder,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      csiCode: i.csiCode,
      unit: i.unit,
      qty: Number(i.qty),
      unitCost: Number(i.unitCost),
      laborCost: Number(i.laborCost),
      materialCost: Number(i.materialCost),
      markupPct: Number(i.markupPct),
      manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
      vendor: i.vendor,
      notes: i.notes,
      sortOrder: i.sortOrder,
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href={`/${params.companyId}/${params.projectId}/estimates`} className="hover:text-blue-600">
          ← Back to Estimates
        </a>
      </div>
      <ProjectEstimateEditor
        companyId={params.companyId}
        projectId={params.projectId}
        estimate={{
          id: estimate.id,
          name: estimate.name,
          description: estimate.description,
          status: estimate.status,
          projectId: params.projectId,
        }}
        divisions={divisions}
        canEdit={can(session.user.role, "estimate:edit")}
        canArchive={can(session.user.role, "estimate:edit")}
      />
    </div>
  );
}
