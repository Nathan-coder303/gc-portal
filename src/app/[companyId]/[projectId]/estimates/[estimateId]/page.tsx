import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import ProjectEstimateEditor from "@/components/estimates/ProjectEstimateEditor";
import { lookupCsiCode } from "@/lib/divisions";

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

  // Auto-apply CSI codes to any division missing one
  const missingCsi = estimate.divisions.filter(d => !d.csiCode && lookupCsiCode(d.name));
  if (missingCsi.length > 0) {
    await Promise.all(missingCsi.map(d =>
      prisma.projectEstimateDivision.update({
        where: { id: d.id },
        data: { csiCode: lookupCsiCode(d.name) },
      })
    ));
    missingCsi.forEach(d => { d.csiCode = lookupCsiCode(d.name) ?? null; });
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
