import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function itemTotal(item: {
  defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown;
}): number {
  const qty = Number(item.defaultQty ?? 0);
  const cost = Number(item.defaultUnitCost ?? 0);
  const markup = Number(item.defaultMarkupPct ?? 0);
  return qty * cost * (1 + markup / 100);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const divisions = await prisma.estimateTemplateDivision.findMany({
    where: { templateId: params.templateId, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      manualTotal: true,
      items: {
        where: { archivedAt: null },
        select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true },
      },
    },
  });

  return NextResponse.json(
    divisions.map(d => ({
      name: d.name,
      total: d.manualTotal !== null && d.manualTotal !== undefined
        ? Number(d.manualTotal)
        : d.items.reduce((s, i) => s + itemTotal(i), 0),
    }))
  );
}
