import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/[companyId]/bids/triage/[bidId] — assign bid to a project
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; bidId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { clientId: string };
  if (!body.clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const bid = await prisma.subBid.update({
    where: { id: params.bidId },
    data: { clientId: body.clientId, status: "RECEIVED" },
  });

  return NextResponse.json({ id: bid.id, clientId: bid.clientId, status: bid.status });
}

// DELETE /api/[companyId]/bids/triage/[bidId] — discard a triage bid
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; bidId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.subBid.delete({ where: { id: params.bidId } });
  return NextResponse.json({ ok: true });
}
