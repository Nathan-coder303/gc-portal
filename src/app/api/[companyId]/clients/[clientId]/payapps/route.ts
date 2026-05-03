import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payApps = await prisma.payApp.findMany({
    where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { payAppNumber: "asc" },
  });

  return NextResponse.json(payApps.map(p => ({
    id: p.id,
    payAppNumber: p.payAppNumber,
    invoiceNumber: p.invoiceNumber,
    projectName: p.projectName,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    invoiceDate: p.invoiceDate,
    paymentDue: p.paymentDue,
    fromName: p.fromName,
    fromContact: p.fromContact,
    fromAddress: p.fromAddress,
    toName: p.toName,
    toContact: p.toContact,
    toAddress: p.toAddress,
    projectNumber: p.projectNumber,
    originalContractSum: Number(p.originalContractSum),
    lessPreviousInvoices: Number(p.lessPreviousInvoices),
    depositPriorBalance: Number(p.depositPriorBalance),
    depositReductionThis: Number(p.depositReductionThis),
    coAdditionsPrev: Number(p.coAdditionsPrev),
    coDeductionsPrev: Number(p.coDeductionsPrev),
    coAdditionsThis: Number(p.coAdditionsThis),
    coDeductionsThis: Number(p.coDeductionsThis),
    distributeOwner: p.distributeOwner,
    distributeArchitect: p.distributeArchitect,
    distributeContractor: p.distributeContractor,
    certifiedBy: p.certifiedBy,
    certState: p.certState,
    certCounty: p.certCounty,
    notaryName: p.notaryName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
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
  })));
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Find next pay app number
  const last = await prisma.payApp.findFirst({
    where: { companyId: params.companyId, clientId: params.clientId },
    orderBy: { payAppNumber: "desc" },
    select: { payAppNumber: true },
  });
  const nextNumber = (last?.payAppNumber ?? 0) + 1;

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { name: true, address: true, city: true, state: true, zip: true },
  });

  const toAddress = [client?.address, client?.city && client?.state ? `${client.city}, ${client.state} ${client?.zip ?? ""}` : null]
    .filter(Boolean).join("\n");

  const defaultLines = [
    "General Requirements", "Existing Conditions", "Concrete / Shell",
    "Structural Steel", "Finished & Decorative Metals", "Wood & Plastics",
    "Thermal & Moisture Protection", "Openings & Glazing", "Finishes",
    "Specialties", "Equipment", "Mechanical", "Electrical", "Plumbing", "GC Fee",
  ].map((desc, i) => ({
    sortOrder: i,
    itemNumber: `Div ${i + 1}`,
    description: desc,
    scheduledValue: 0,
    fromPrevious: 0,
    thisInvoice: 0,
    retainageThis: 0,
    retainageTotal: 0,
  }));

  const payApp = await prisma.payApp.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      payAppNumber: nextNumber,
      fromName: body.fromName ?? "MIBH Construction",
      fromContact: body.fromContact ?? "Mike Baruh",
      fromAddress: body.fromAddress ?? "",
      toName: client?.name ?? "",
      toAddress,
      lines: { create: defaultLines },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ id: payApp.id, payAppNumber: payApp.payAppNumber });
}
