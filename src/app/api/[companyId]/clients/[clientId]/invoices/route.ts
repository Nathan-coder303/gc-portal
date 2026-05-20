import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceLines } from "@/lib/invoiceLines";

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

// POST — create a new invoice and auto-populate lines from estimate
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

  // Auto-populate lines from estimate items
  try {
    const lines = await buildInvoiceLines(estimateId, invoice.id, Number(pct));
    if (lines.length > 0) {
      await prisma.invoiceLine.createMany({
        data: lines.map(l => ({ ...l, invoiceId: invoice.id })),
      });
      // Update invoice amount to sum of line thisInvoice
      const lineTotal = lines.reduce((s, l) => s + l.thisInvoice, 0);
      if (Math.abs(lineTotal - Number(amount)) > 0.01) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { amount: lineTotal } });
      }
    }
  } catch {
    // Lines are optional — invoice still created
  }

  return NextResponse.json(invoice);
}
