import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml } from "../send/route";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customBody = searchParams.get("body") ?? null;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, companyId: params.companyId },
    include: {
      client: { select: { name: true } },
      estimate: { select: { name: true, estimateNumber: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    phase: invoice.phase,
    trigger: invoice.trigger,
    pct: invoice.pct,
    amount: Number(invoice.amount),
    estimateName: invoice.estimate.name,
    clientName: invoice.client.name,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    customBody,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
