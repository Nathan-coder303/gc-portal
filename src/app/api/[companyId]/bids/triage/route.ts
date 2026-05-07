import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/[companyId]/bids/triage — list all TRIAGE bids
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bids, existingSubs] = await Promise.all([
    prisma.subBid.findMany({
      where: { companyId: params.companyId, status: "TRIAGE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subContractor.findMany({
      where: { companyId: params.companyId },
      select: { name: true },
    }),
  ]);

  // Build a normalized set of existing sub names for fast lookup
  const existingNames = new Set(existingSubs.map(s => s.name.toLowerCase().trim()));

  // Filter out bids whose contractor name already exists in the subs database
  const dedupedBids = bids.filter(b => {
    if (!b.contractorName) return true;
    return !existingNames.has(b.contractorName.toLowerCase().trim());
  });

  return NextResponse.json(dedupedBids.map(b => ({
    id: b.id,
    contractorName: b.contractorName,
    divisionCode: b.divisionCode,
    divisionName: b.divisionName,
    amount: b.amount ? Number(b.amount) : null,
    notes: b.notes,
    emailSource: b.emailSource,
    sourceLabel: b.sourceLabel,
    fileName: b.fileName,
    fileUrl: b.fileUrl,
    createdAt: b.createdAt.toISOString(),
  })));
}
