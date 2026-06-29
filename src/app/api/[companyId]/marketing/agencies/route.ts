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
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agencies = await prisma.marketingAgency.findMany({
    where: { companyId: params.companyId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(agencies);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.contractStartDate) return NextResponse.json({ error: "Contract start date is required" }, { status: 400 });
  if (body.payAmount == null || isNaN(Number(body.payAmount))) return NextResponse.json({ error: "Pay amount is required" }, { status: 400 });
  if (!body.payFrequency) return NextResponse.json({ error: "Pay frequency is required" }, { status: 400 });

  const agency = await prisma.marketingAgency.create({
    data: {
      companyId: params.companyId,
      name: body.name.trim(),
      contractStartDate: new Date(body.contractStartDate),
      payAmount: Number(body.payAmount),
      payFrequency: body.payFrequency,
      upfrontFee: body.upfrontFee != null && body.upfrontFee !== "" ? Number(body.upfrontFee) : null,
      commitment: body.commitment?.trim() || null,
      facebookFees: body.facebookFees != null && body.facebookFees !== "" ? Number(body.facebookFees) : null,
      appointmentsBooked: body.appointmentsBooked != null && body.appointmentsBooked !== "" ? Number(body.appointmentsBooked) : 0,
      adSpendAmount: body.adSpendAmount != null && body.adSpendAmount !== "" ? Number(body.adSpendAmount) : null,
      adSpendSinceDate: body.adSpendSinceDate ? new Date(body.adSpendSinceDate) : null,
      expectedSaleValue: body.expectedSaleValue != null && body.expectedSaleValue !== "" ? Number(body.expectedSaleValue) : null,
      loginUrl: body.loginUrl?.trim() || null,
      loginEmail: body.loginEmail?.trim() || null,
      loginPassword: body.loginPassword?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json(agency);
}
