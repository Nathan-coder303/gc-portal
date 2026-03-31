import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH — update invoice (status, dueDate, notes, paidAt)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, dueDate, notes, paidAt } = body;

  const invoice = await prisma.invoice.update({
    where: { id: params.invoiceId },
    data: {
      ...(status !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(notes !== undefined && { notes }),
      ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
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
