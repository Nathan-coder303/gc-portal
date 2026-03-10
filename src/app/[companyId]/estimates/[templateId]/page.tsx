import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import TemplateEditor from "@/components/estimates/TemplateEditor";
import Link from "next/link";

export default async function TemplateEditorPage({
  params,
}: {
  params: { companyId: string; templateId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}`);

  const [template, clients] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: params.templateId, companyId: params.companyId, archivedAt: null },
      include: {
        client: true,
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
    }),
    prisma.client.findMany({ where: { companyId: params.companyId }, orderBy: { name: "asc" } }),
  ]);

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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${params.companyId}/estimates`}
        className="inline-flex items-center gap-1 text-sm mb-4 font-medium"
        style={{ color: "#8b949e" }}
      >
        ← Estimates
      </Link>
      <TemplateEditor
          template={{ id: template.id, name: template.name, description: template.description, companyId: params.companyId, estimateNumber: template.estimateNumber, estimateDate: template.estimateDate, paymentSchedule: template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null, showTerms: template.showTerms, termsContent: template.termsContent }}
          divisions={divisions}
          canEdit={can(session.user.role, "estimateTemplate:edit")}
          currentClient={template.client ? {
            id: template.client.id,
            name: template.client.name,
            address: template.client.address,
            city: template.client.city,
            state: template.client.state,
            zip: template.client.zip,
            email: template.client.email,
            phone: template.client.phone,
          } : null}
          allClients={clients.map(c => ({ id: c.id, name: c.name, address: c.address, city: c.city, state: c.state, zip: c.zip, email: c.email, phone: c.phone }))}
        />
    </div>
  );
}
