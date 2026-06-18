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

  // Note: we used to filter out bids whose contractor already exists in the subs DB,
  // but that hid pills for divisions where every triage bid happened to be a returning
  // contractor (e.g. HVAC). The bid still needs to be routed to a client / project, so
  // show them all. The "add sub" step in the assign flow already handles existing subs.
  return NextResponse.json(bids.map(b => ({
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
