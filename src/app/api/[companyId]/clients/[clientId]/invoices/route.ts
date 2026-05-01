import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list all invoices for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { companyId: params.companyId, clientId: params.clientId },
    orderBy: { createdAt: "asc" },
    include: { payments: { orderBy: { paidDate: "asc" } } },
  });
  return NextResponse.json(invoices);
}

// POST — create a new invoice for a phase
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { estimateId, phase, trigger, pct, amount, dueDate, notes } = body;

  if (!estimateId || phase == null || pct == null || amount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Build invoice number: "{estimateNumber}-{n}"
  const estimate = await prisma.estimateTemplate.findFirst({
    where: { id: estimateId, companyId: params.companyId },
    select: { estimateNumber: true },
  });
  if (!estimate) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });

  const existing = await prisma.invoice.count({ where: { estimateId } });
  const invoiceNumber = `${estimate.estimateNumber ?? estimateId.slice(-4)}-${existing + 1}`;

  const invoice = await prisma.invoice.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      estimateId,
      invoiceNumber,
      phase,
      trigger: trigger ?? null,
      pct,
      amount,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ?? null,
      status: "DRAFT",
    },
  });

  return NextResponse.json(invoice);
}
