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

  const bids = await prisma.subBid.findMany({
    where: { companyId: params.companyId, status: "TRIAGE" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bids.map(b => ({
    id: b.id,
    contractorName: b.contractorName,
    divisionCode: b.divisionCode,
    divisionName: b.divisionName,
    amount: b.amount ? Number(b.amount) : null,
    notes: b.notes,
    emailSource: b.emailSource,
    fileName: b.fileName,
    fileUrl: b.fileUrl,
    createdAt: b.createdAt.toISOString(),
  })));
}
