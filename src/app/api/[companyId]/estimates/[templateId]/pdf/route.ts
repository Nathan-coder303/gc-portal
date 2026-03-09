import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "estimate:read"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [template, company] = await Promise.all([
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
              include: { items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
            },
            items: { where: { archivedAt: null, groupId: null }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!template || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
        defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
        visibleInPdf: i.visibleInPdf,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      visibleInPdf: i.visibleInPdf,
    })),
  }));

  const buffer = await renderTemplatePdf({
    companyName: company.name,
    template: { name: template.name, description: template.description, estimateNumber: template.estimateNumber, estimateDate: template.estimateDate },
    client: template.client ? { name: template.client.name, address: template.client.address, city: template.client.city, state: template.client.state, zip: template.client.zip } : null,
    divisions,
  });

  const filename = `${template.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-template.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
