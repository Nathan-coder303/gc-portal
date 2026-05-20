import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — single invoice with lines
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, companyId: params.companyId },
    include: {
      payments: { orderBy: { paidDate: "asc" } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...invoice,
    amount: Number(invoice.amount),
    pct: Number(invoice.pct),
    lines: invoice.lines.map(l => ({
      id: l.id,
      estimateItemId: l.estimateItemId,
      sortOrder: l.sortOrder,
      itemNumber: l.itemNumber,
      description: l.description,
      scheduledValue: Number(l.scheduledValue),
      fromPrevious: Number(l.fromPrevious),
      pctThisInvoice: Number(l.pctThisInvoice),
      thisInvoice: Number(l.thisInvoice),
    })),
  });
}

// PATCH — update invoice fields; if lines provided, replace them and recompute amount
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, dueDate, notes, paidAt, phase, trigger, amount, pct, lines } = body;

  // If lines provided, replace them and compute amount from lines
  if (Array.isArray(lines)) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: params.invoiceId } });
    if (lines.length > 0) {
      await prisma.invoiceLine.createMany({
        data: lines.map((l: {
          estimateItemId?: string | null;
          sortOrder: number; itemNumber: string; description: string;
          scheduledValue: number; fromPrevious: number;
          pctThisInvoice: number; thisInvoice: number;
        }, i: number) => ({
          invoiceId: params.invoiceId,
          estimateItemId: l.estimateItemId ?? null,
          sortOrder: l.sortOrder ?? i,
          itemNumber: l.itemNumber ?? "",
          description: l.description ?? "",
          scheduledValue: Number(l.scheduledValue) || 0,
          fromPrevious: Number(l.fromPrevious) || 0,
          pctThisInvoice: Number(l.pctThisInvoice) || 0,
          thisInvoice: Number(l.thisInvoice) || 0,
        })),
      });
    }
    const lineTotal = lines.reduce((s: number, l: { thisInvoice: number }) => s + Number(l.thisInvoice), 0);
    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: {
        amount: lineTotal,
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(notes !== undefined && { notes }),
        ...(phase !== undefined && { phase }),
        ...(trigger !== undefined && { trigger }),
        ...(pct !== undefined && { pct: parseFloat(pct) }),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.invoiceId },
    data: {
      ...(status !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(notes !== undefined && { notes }),
      ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
      ...(phase !== undefined && { phase }),
      ...(trigger !== undefined && { trigger }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(pct !== undefined && { pct: parseFloat(pct) }),
    },
  });

  return NextResponse.json(invoice);
}

// DELETE — remove invoice
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.invoice.delete({ where: { id: params.invoiceId } });
  return NextResponse.json({ success: true });
}
