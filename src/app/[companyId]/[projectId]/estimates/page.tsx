import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import ProjectEstimateList from "@/components/estimates/ProjectEstimateList";
import { computeEstimateTotal } from "@/lib/estimates/totals";

export default async function ProjectEstimatesPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}/${params.projectId}/dashboard`);

  const [estimates, templates] = await Promise.all([
    prisma.projectEstimate.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true } },
        divisions: {
          where: { archivedAt: null },
          include: {
            groups: {
              where: { archivedAt: null },
              include: { items: { where: { archivedAt: null } } },
            },
            items: { where: { archivedAt: null, groupId: null } },
          },
        },
      },
    }),
    prisma.estimateTemplate.findMany({
      where: { companyId: params.companyId, archivedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const formatted = estimates.map((est) => {
    const divisions = est.divisions.map((d) => ({
      groups: d.groups.map((g) => ({
        items: g.items.map((i) => ({
          qty: Number(i.qty),
          unitCost: Number(i.unitCost),
          laborCost: Number(i.laborCost),
          materialCost: Number(i.materialCost),
          markupPct: Number(i.markupPct),
          manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
        })),
      })),
      items: d.items.map((i) => ({
        qty: Number(i.qty),
        unitCost: Number(i.unitCost),
        laborCost: Number(i.laborCost),
        materialCost: Number(i.materialCost),
        markupPct: Number(i.markupPct),
        manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
      })),
    }));

    return {
      id: est.id,
      name: est.name,
      description: est.description,
      status: est.status,
      total: computeEstimateTotal(divisions),
      createdAt: est.createdAt,
      template: est.template,
    };
  });

  return (
    <ProjectEstimateList
      companyId={params.companyId}
      projectId={params.projectId}
      estimates={formatted}
      templates={templates}
      canEdit={can(session.user.role, "estimate:create")}
      canArchive={can(session.user.role, "estimate:archive")}
    />
  );
}
