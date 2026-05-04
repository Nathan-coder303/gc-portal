import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH — sync actual net profit from financials tab → internalProfitOverride on primary estimate
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { netProfit, hasExpenses } = await req.json();
  if (typeof netProfit !== "number") {
    return NextResponse.json({ error: "netProfit required" }, { status: 400 });
  }
  // Don't overwrite with 0 if there are no actual expenses entered — the estimate hasn't been tracked yet
  if (netProfit === 0 && !hasExpenses) return NextResponse.json({ ok: true });

  // Find all non-archived CLIENT_ESTIMATE templates for this client, ordered by most recently updated
  const estimates = await prisma.estimateTemplate.findMany({
    where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null, type: "CLIENT_ESTIMATE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (estimates.length === 0) return NextResponse.json({ ok: true });

  // Set netProfit on the primary (most recently updated) estimate
  // Set all others to 0 so the aggregate on the client card is correct
  await prisma.$transaction([
    prisma.estimateTemplate.update({
      where: { id: estimates[0].id },
      data: { internalProfitOverride: netProfit },
    }),
    ...estimates.slice(1).map(e =>
      prisma.estimateTemplate.update({
        where: { id: e.id },
        data: { internalProfitOverride: 0 },
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
