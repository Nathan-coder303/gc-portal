import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// DELETE — remove a payment
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string; paymentId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.payment.delete({ where: { id: params.paymentId } });

  // Re-check if invoice should go back to SENT/DRAFT after payment removal
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId },
    include: { payments: true },
  });
  if (invoice && invoice.status === "PAID") {
    const remaining = invoice.payments.reduce((s, p) => s + p.amount, 0);
    if (remaining < invoice.amount) {
      await prisma.invoice.update({
        where: { id: params.invoiceId },
        data: { status: invoice.sentAt ? "SENT" : "DRAFT", paidAt: null },
      });
    }
  }

  return NextResponse.json({ success: true });
}
