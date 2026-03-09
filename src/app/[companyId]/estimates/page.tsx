import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import TemplateList from "@/components/estimates/TemplateList";

export default async function EstimatesPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}/projects`);

  const templates = await prisma.estimateTemplate.findMany({
    where: { companyId: params.companyId, archivedAt: null, type: "TEMPLATE" },
    orderBy: { sortOrder: "asc" },
    include: {
      divisions: {
        where: { archivedAt: null },
        include: {
          items: { where: { archivedAt: null }, select: { id: true } },
          groups: {
            where: { archivedAt: null },
            include: { items: { where: { archivedAt: null }, select: { id: true } } },
          },
        },
      },
    },
  });

  const formatted = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    divisionCount: t.divisions.length,
    itemCount: t.divisions.reduce(
      (s, d) => s + d.items.length + d.groups.reduce((gs, g) => gs + g.items.length, 0),
      0
    ),
    createdAt: t.createdAt,
  }));

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <TemplateList
          companyId={params.companyId}
          templates={formatted}
          canEdit={can(session.user.role, "estimateTemplate:create")}
          canArchive={can(session.user.role, "estimateTemplate:archive")}
        />
    </div>
  );
}
