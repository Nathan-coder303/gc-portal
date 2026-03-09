import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import TemplateEditor from "@/components/estimates/TemplateEditor";

export default async function TemplateEditorPage({
  params,
}: {
  params: { companyId: string; templateId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}`);

  const template = await prisma.estimateTemplate.findFirst({
    where: { id: params.templateId, companyId: params.companyId, archivedAt: null },
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

  if (!template) redirect(`/${params.companyId}/estimates`);

  const divisions = template.divisions.map((d) => ({
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
        defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
        defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
        defaultLaborCost: i.defaultLaborCost ? Number(i.defaultLaborCost) : null,
        defaultMaterialCost: i.defaultMaterialCost ? Number(i.defaultMaterialCost) : null,
        defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
        notes: i.notes,
        visibleInPdf: i.visibleInPdf,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultLaborCost: i.defaultLaborCost ? Number(i.defaultLaborCost) : null,
      defaultMaterialCost: i.defaultMaterialCost ? Number(i.defaultMaterialCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      notes: i.notes,
      visibleInPdf: i.visibleInPdf,
    })),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <a href={`/${params.companyId}`} className="font-bold text-slate-900 hover:text-blue-600">GC Portal</a>
            <span className="text-slate-300">|</span>
            <a href={`/${params.companyId}/estimates`} className="text-sm text-slate-600 hover:text-blue-600">Templates</a>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-800 font-medium">{template.name}</span>
          </div>
          <a href={`/${params.companyId}/estimates`} className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to Templates
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <TemplateEditor
          template={{ id: template.id, name: template.name, description: template.description, companyId: params.companyId }}
          divisions={divisions}
          canEdit={can(session.user.role, "estimateTemplate:edit")}
        />
      </main>
    </div>
  );
}
