import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { renderEstimatePdf } from "@/lib/estimates/estimatePdf";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string; estimateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "estimate:read"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [estimate, project, company] = await Promise.all([
    prisma.projectEstimate.findFirst({
      where: { id: params.estimateId, projectId: params.projectId, archivedAt: null },
      include: {
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
    prisma.project.findFirst({ where: { id: params.projectId, companyId: params.companyId } }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!estimate || !project || !company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        detail: i.detail,
        unit: i.unit,
        qty: Number(i.qty),
        unitCost: Number(i.unitCost),
        laborCost: Number(i.laborCost),
        materialCost: Number(i.materialCost),
        markupPct: Number(i.markupPct),
        manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      detail: i.detail,
      unit: i.unit,
      qty: Number(i.qty),
      unitCost: Number(i.unitCost),
      laborCost: Number(i.laborCost),
      materialCost: Number(i.materialCost),
      markupPct: Number(i.markupPct),
      manualTotal: i.manualTotal ? Number(i.manualTotal) : null,
    })),
  }));

  const buffer = await renderEstimatePdf({
    companyName: company.name,
    projectName: project.name,
    estimate: {
      name: estimate.name,
      description: estimate.description,
      status: estimate.status,
      createdAt: estimate.createdAt,
    },
    divisions,
  });

  const filename = `${estimate.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-estimate.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
