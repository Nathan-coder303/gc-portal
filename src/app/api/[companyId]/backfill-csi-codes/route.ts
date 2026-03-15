import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { lookupCsiCode } from "@/lib/divisions";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Backfill template divisions
  const templateDivisions = await prisma.estimateTemplateDivision.findMany({
    where: { archivedAt: null, template: { companyId: params.companyId } },
    select: { id: true, name: true, csiCode: true },
  });

  // Backfill project estimate divisions
  const estimateDivisions = await prisma.projectEstimateDivision.findMany({
    where: { archivedAt: null, estimate: { project: { companyId: params.companyId } } },
    select: { id: true, name: true, csiCode: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const div of templateDivisions) {
    if (div.csiCode) { skipped++; continue; } // already has a code
    const code = lookupCsiCode(div.name);
    if (!code) { skipped++; continue; }
    await prisma.estimateTemplateDivision.update({
      where: { id: div.id },
      data: { csiCode: code },
    });
    updated++;
  }

  for (const div of estimateDivisions) {
    if (div.csiCode) { skipped++; continue; }
    const code = lookupCsiCode(div.name);
    if (!code) { skipped++; continue; }
    await prisma.projectEstimateDivision.update({
      where: { id: div.id },
      data: { csiCode: code },
    });
    updated++;
  }

  return NextResponse.json({ updated, skipped });
}
