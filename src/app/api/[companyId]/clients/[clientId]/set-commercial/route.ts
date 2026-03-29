import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STANDARD_DIVISIONS, COMMERCIAL_ONLY_DIVISIONS } from "@/lib/divisions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isCommercial } = await req.json() as { isCommercial: boolean };

  await prisma.client.update({
    where: { id: params.clientId },
    data: { isCommercial },
  });

  // Create missing division placeholders immediately
  const allDivs = isCommercial
    ? [...STANDARD_DIVISIONS, ...COMMERCIAL_ONLY_DIVISIONS].sort((a, b) => a.code.localeCompare(b.code))
    : STANDARD_DIVISIONS;

  const existing = await prisma.subBid.findMany({
    where: { clientId: params.clientId, isPlaceholder: true },
    select: { divisionCode: true },
  });
  const existingCodes = new Set(existing.map((b) => b.divisionCode));

  for (const div of allDivs) {
    if (!existingCodes.has(div.code)) {
      await prisma.subBid.create({
        data: {
          clientId: params.clientId,
          companyId: params.companyId,
          divisionCode: div.code,
          divisionName: div.name,
          status: "MISSING",
          isPlaceholder: true,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, isCommercial });
}
