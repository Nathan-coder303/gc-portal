import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import TemplateEditor from "@/components/estimates/TemplateEditor";
import Link from "next/link";
import { getCorrectCsiCode, lookupItemCsiCode } from "@/lib/divisions";
import { getFileTermsPresets } from "@/lib/fileTerms";

export const dynamic = "force-dynamic";

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
  const termsTemplates = getFileTermsPresets();

  if (!template) redirect(`/${params.companyId}/estimates`);

  // Auto-apply / upgrade CSI codes for divisions missing or using old short codes
  const needsCsiUpdate = template.divisions
    .map(d => ({ d, code: getCorrectCsiCode(d.name, d.csiCode) }))
    .filter(({ code }) => code !== undefined);
  if (needsCsiUpdate.length > 0) {
    await Promise.all(needsCsiUpdate.map(({ d, code }) =>
      prisma.estimateTemplateDivision.update({ where: { id: d.id }, data: { csiCode: code } })
    ));
    needsCsiUpdate.forEach(({ d, code }) => { d.csiCode = code ?? null; });
  }

  // Auto-populate item CSI codes for items that have none
  const allItems = template.divisions.flatMap(d => [...d.items, ...d.groups.flatMap(g => g.items)]);
  const itemsNeedingCsi = allItems.filter(i => !i.csiCode).map(i => ({ i, code: lookupItemCsiCode(i.name) })).filter(({ code }) => code !== undefined);
  if (itemsNeedingCsi.length > 0) {
    await Promise.all(itemsNeedingCsi.map(({ i, code }) =>
      prisma.estimateTemplateItem.update({ where: { id: i.id }, data: { csiCode: code } })
    ));
    itemsNeedingCsi.forEach(({ i, code }) => { i.csiCode = code ?? null; });
  }

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
        csiCode: i.csiCode,
        detail: i.detail,
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
      csiCode: i.csiCode,
      detail: i.detail,
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

  const backHref = template.client
    ? `/${params.companyId}/clients/${template.client.id}`
    : `/${params.companyId}/estimates`;
  const backLabel = template.client ? template.client.name : "Estimates";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
        style={{ background: "#1e2736", border: "1px solid #30373f", color: "#C9A84C" }}
      >
        <span style={{ fontSize: 16 }}>←</span>
        {template.client && <span style={{ color: "#8b949e", fontSize: 12 }}>Client:</span>}
        {backLabel}
      </Link>
      <TemplateEditor
          template={{ id: template.id, name: template.name, description: template.description, companyId: params.companyId, estimateNumber: template.estimateNumber, estimateDate: template.estimateDate, paymentSchedule: template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null, showTerms: template.showTerms, termsContent: template.termsContent, type: template.type, gcFeePercent: template.gcFeePercent ? Number(template.gcFeePercent) : null, sqFt: template.sqFt ? Number(template.sqFt) : null, durationMonths: template.durationMonths ? Number(template.durationMonths) : null, hasSkylights: template.hasSkylights, hasRoofDrains: template.hasRoofDrains, insulationType: template.insulationType ?? "ISO", combinationType: template.combinationType ?? null }}
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
          termsTemplates={termsTemplates}
          initialSummaryGroups={template.summaryGroups as Record<string, { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null }> | null}
        />
    </div>
  );
}
