import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.companyId },
    select: { leadsLastSyncedAt: true },
  });

  return NextResponse.json({ leadsLastSyncedAt: company?.leadsLastSyncedAt ?? null });
}
