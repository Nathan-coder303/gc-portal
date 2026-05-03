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

  const [template, divisions] = await Promise.all([
    prisma.estimateTemplate.findUnique({
      where: { id: params.templateId },
      select: { gcFeePercent: true },
    }),
    prisma.estimateTemplateDivision.findMany({
      where: { templateId: params.templateId, archivedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        csiCode: true,
        manualTotal: true,
        items: {
          where: { archivedAt: null, groupId: null },
          select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true },
        },
        groups: {
          where: { archivedAt: null },
          select: {
            items: {
              where: { archivedAt: null },
              select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true },
            },
          },
        },
      },
    }),
  ]);

  const lines = divisions.map(d => ({
    name: d.name,
    csiCode: d.csiCode ?? null,
    total: d.manualTotal !== null && d.manualTotal !== undefined
      ? Number(d.manualTotal)
      : [...d.items, ...d.groups.flatMap(g => g.items)].reduce((s, i) => s + itemTotal(i), 0),
  }));

  // Append GC Fee line if the estimate has a GC fee percentage
  if (template?.gcFeePercent) {
    const rawTotal = lines.reduce((s, l) => s + l.total, 0);
    const gcFee = rawTotal * Number(template.gcFeePercent) / 100;
    if (gcFee > 0) {
      lines.push({ name: "GC Fee", csiCode: null, total: gcFee });
    }
  }

  return NextResponse.json(lines);
}
