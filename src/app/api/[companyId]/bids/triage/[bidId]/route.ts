import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/[companyId]/bids/triage/[bidId] — assign bid to a project or lead
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; bidId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { clientId?: string | null; leadId?: string | null; divisionCode?: string; divisionName?: string };
  if (!body.clientId && !body.leadId) return NextResponse.json({ error: "clientId or leadId required" }, { status: 400 });

  const data: Record<string, unknown> = { status: "RECEIVED" };
  if (body.clientId) {
    data.clientId = body.clientId;
    data.leadId = null;
  } else if (body.leadId) {
    data.leadId = body.leadId;
    data.clientId = null;
  }
  if (body.divisionCode) data.divisionCode = body.divisionCode;
  if (body.divisionName) data.divisionName = body.divisionName;

  const bid = await prisma.subBid.update({
    where: { id: params.bidId },
    data,
  });

  return NextResponse.json({ id: bid.id, clientId: bid.clientId, leadId: bid.leadId, status: bid.status });
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
