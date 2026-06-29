import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; agencyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.contractStartDate !== undefined) data.contractStartDate = new Date(body.contractStartDate);
  if (body.payAmount !== undefined) data.payAmount = Number(body.payAmount);
  if (body.payFrequency !== undefined) data.payFrequency = body.payFrequency;
  if (body.upfrontFee !== undefined) data.upfrontFee = body.upfrontFee == null || body.upfrontFee === "" ? null : Number(body.upfrontFee);
  if (body.commitment !== undefined) data.commitment = body.commitment?.trim() || null;
  if (body.facebookFees !== undefined) data.facebookFees = body.facebookFees == null || body.facebookFees === "" ? null : Number(body.facebookFees);
  if (body.appointmentsBooked !== undefined) data.appointmentsBooked = body.appointmentsBooked == null || body.appointmentsBooked === "" ? 0 : Number(body.appointmentsBooked);
  if (body.adSpendAmount !== undefined) data.adSpendAmount = body.adSpendAmount == null || body.adSpendAmount === "" ? null : Number(body.adSpendAmount);
  if (body.adSpendSinceDate !== undefined) data.adSpendSinceDate = body.adSpendSinceDate ? new Date(body.adSpendSinceDate) : null;
  if (body.expectedSaleValue !== undefined) data.expectedSaleValue = body.expectedSaleValue == null || body.expectedSaleValue === "" ? null : Number(body.expectedSaleValue);
  if (body.loginUrl !== undefined) data.loginUrl = body.loginUrl?.trim() || null;
  if (body.loginEmail !== undefined) data.loginEmail = body.loginEmail?.trim() || null;
  if (body.loginPassword !== undefined) data.loginPassword = body.loginPassword?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  const agency = await prisma.marketingAgency.update({
    where: { id: params.agencyId, companyId: params.companyId },
    data,
  });
  return NextResponse.json(agency);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; agencyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.marketingAgency.update({
    where: { id: params.agencyId, companyId: params.companyId },
    data: { archivedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
