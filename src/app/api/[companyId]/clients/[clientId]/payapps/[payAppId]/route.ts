import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string; payAppId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = await prisma.payApp.findUnique({
    where: { id: params.payAppId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: p.id,
    payAppNumber: p.payAppNumber,
    invoiceNumber: p.invoiceNumber ?? "",
    projectName: p.projectName ?? "",
    projectNumber: p.projectNumber ?? "",
    invoiceDate: p.invoiceDate ?? "",
    paymentDue: p.paymentDue ?? "",
    periodStart: p.periodStart ?? "",
    periodEnd: p.periodEnd ?? "",
    fromName: p.fromName ?? "MIBH Construction",
    fromContact: p.fromContact ?? "Mike Baruh",
    fromAddress: p.fromAddress ?? "",
    toName: p.toName ?? "",
    toContact: p.toContact ?? "",
    toAddress: p.toAddress ?? "",
    originalContractSum: Number(p.originalContractSum),
    lessPreviousInvoices: Number(p.lessPreviousInvoices),
    depositPriorBalance: Number(p.depositPriorBalance),
    depositReductionThis: Number(p.depositReductionThis),
    coAdditionsPrev: Number(p.coAdditionsPrev),
    coDeductionsPrev: Number(p.coDeductionsPrev),
    coAdditionsThis: Number(p.coAdditionsThis),
    coDeductionsThis: Number(p.coDeductionsThis),
    gcFeeScheduledValue: Number(p.gcFeeScheduledValue),
    distributeOwner: p.distributeOwner,
    distributeArchitect: p.distributeArchitect,
    distributeContractor: p.distributeContractor,
    certifiedBy: p.certifiedBy ?? "",
    certState: p.certState ?? "",
    certCounty: p.certCounty ?? "",
    notaryName: p.notaryName ?? "",
    lines: p.lines.map(l => ({
      id: l.id,
      sortOrder: l.sortOrder,
      itemNumber: l.itemNumber,
      description: l.description,
      scheduledValue: Number(l.scheduledValue),
      fromPrevious: Number(l.fromPrevious),
      thisInvoice: Number(l.thisInvoice),
      retainageThis: Number(l.retainageThis),
      retainageTotal: Number(l.retainageTotal),
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { companyId: string; clientId: string; payAppId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const dec = (v: unknown) => v !== undefined && v !== null ? Number(v) : undefined;

  await prisma.payApp.update({
    where: { id: params.payAppId },
    data: {
      payAppNumber: body.payAppNumber !== undefined ? Number(body.payAppNumber) : undefined,
      invoiceNumber: body.invoiceNumber,
      projectName: body.projectName,
      projectNumber: body.projectNumber,
      invoiceDate: body.invoiceDate,
      paymentDue: body.paymentDue,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      fromName: body.fromName,
      fromContact: body.fromContact,
      fromAddress: body.fromAddress,
      toName: body.toName,
      toContact: body.toContact,
      toAddress: body.toAddress,
      originalContractSum: dec(body.originalContractSum),
      lessPreviousInvoices: dec(body.lessPreviousInvoices),
      depositPriorBalance: dec(body.depositPriorBalance),
      depositReductionThis: dec(body.depositReductionThis),
      coAdditionsPrev: dec(body.coAdditionsPrev),
      coDeductionsPrev: dec(body.coDeductionsPrev),
      coAdditionsThis: dec(body.coAdditionsThis),
      coDeductionsThis: dec(body.coDeductionsThis),
      gcFeeScheduledValue: dec(body.gcFeeScheduledValue),
      distributeOwner: body.distributeOwner,
      distributeArchitect: body.distributeArchitect,
      distributeContractor: body.distributeContractor,
      certifiedBy: body.certifiedBy,
      certState: body.certState,
      certCounty: body.certCounty,
      notaryName: body.notaryName,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { companyId: string; clientId: string; payAppId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.payApp.update({
    where: { id: params.payAppId },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
