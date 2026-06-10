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

  // Only look at actual client estimates (not master templates)
  // Prefer signed/approved, then most recently sent, then most recently updated
  const baseWhere = { companyId: params.companyId, clientId: params.clientId, archivedAt: null, type: "CLIENT_ESTIMATE" };

  const chosenTemplate =
    await prisma.estimateTemplate.findFirst({ where: { ...baseWhere, signedAt: { not: null } }, orderBy: { signedAt: "desc" }, select: { id: true } }) ??
    await prisma.estimateTemplate.findFirst({ where: { ...baseWhere, lastSentAt: { not: null } }, orderBy: { lastSentAt: "desc" }, select: { id: true } }) ??
    await prisma.estimateTemplate.findFirst({ where: baseWhere, orderBy: { updatedAt: "desc" }, select: { id: true } });

  if (!chosenTemplate) return NextResponse.json([]);

  const divisions = await prisma.estimateTemplateDivision.findMany({
    where: {
      archivedAt: null,
      templateId: chosenTemplate.id,
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
          detail: true,
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
      items: d.items
        // Excluded items shouldn't appear in Scope Remaining — they're explicitly not in scope
        .filter(i => i.detail !== "Excluded" && i.name)
        .map(i => {
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
        }),
    }))
    .filter(d => d.items.length > 0);

  return NextResponse.json(result);
}
