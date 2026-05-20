import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Prefer the approved (signed) estimate; fall back to most recently updated non-archived
  const approvedTemplate = await prisma.estimateTemplate.findFirst({
    where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null, signedAt: { not: null } },
    orderBy: { signedAt: "desc" },
    select: { id: true },
  });

  const latestTemplate = approvedTemplate ?? await prisma.estimateTemplate.findFirst({
    where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!latestTemplate) return NextResponse.json([]);

  const divisions = await prisma.estimateTemplateDivision.findMany({
    where: {
      archivedAt: null,
      templateId: latestTemplate.id,
    },
    select: {
      id: true,
      name: true,
      csiCode: true,
      sortOrder: true,
      items: {
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          csiCode: true,
          defaultQty: true,
          defaultUnitCost: true,
          defaultMarkupPct: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Calculate sale price per item: qty * unitCost * (1 + markup/100)
  const result = divisions
    .filter(d => d.items.length > 0)
    .map(d => ({
      divisionId: d.id,
      divisionName: d.name,
      csiCode: d.csiCode,
      items: d.items.map(i => {
        const qty = Number(i.defaultQty ?? 0);
        const cost = Number(i.defaultUnitCost ?? 0);
        const markup = Number(i.defaultMarkupPct ?? 0);
        const salePrice = qty * cost * (1 + markup / 100);
        return {
          id: i.id,
          name: i.name,
          csiCode: i.csiCode,
          salePrice: Math.round(salePrice * 100) / 100,
        };
      }).filter(i => i.name && i.salePrice > 0),
    }))
    .filter(d => d.items.length > 0);

  return NextResponse.json(result);
}
