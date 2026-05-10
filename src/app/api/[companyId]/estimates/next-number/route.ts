import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await prisma.estimateTemplate.findMany({
    where: { companyId: params.companyId, estimateNumber: { not: null } },
    select: { estimateNumber: true },
  });

  let max = 0;
  for (const t of all) {
    const n = parseInt(t.estimateNumber ?? "", 10);
    if (!isNaN(n) && n > max) max = n;
  }

  return NextResponse.json({ next: String(max + 1) });
}
