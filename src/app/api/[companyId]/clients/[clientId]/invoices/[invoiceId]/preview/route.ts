import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml, InvoiceDivisionLine } from "@/lib/invoiceHtml";

export const runtime = "nodejs";

function itemTotal(item: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }): number {
  const qty = Number(item.defaultQty ?? 0);
  const cost = Number(item.defaultUnitCost ?? 0);
  const markup = Number(item.defaultMarkupPct ?? 0);
  return qty * cost * (1 + markup / 100);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, companyId: params.companyId },
    include: {
      client: { select: { name: true, address: true, city: true, state: true, zip: true } },
      estimate: {
        select: {
          name: true,
          estimateNumber: true,
          gcFeePercent: true,
          divisions: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              csiCode: true,
              manualTotal: true,
              sortOrder: true,
              items: {
                where: { archivedAt: null, groupId: null },
                orderBy: { sortOrder: "asc" },
                select: { id: true, name: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true },
              },
              groups: {
                where: { archivedAt: null },
                orderBy: { sortOrder: "asc" },
                select: {
                  name: true,
                  items: {
                    where: { archivedAt: null },
                    orderBy: { sortOrder: "asc" },
                    select: { id: true, name: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true },
                  },
                },
              },
            },
          },
        },
      },
      payments: { orderBy: { paidDate: "asc" } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = invoice.client;
  const clientAddress = [
    client.address,
    client.city && client.state ? `${client.city}, ${client.state} ${client.zip ?? ""}`.trim() : null,
  ].filter(Boolean).join("\n");

  let divisions: InvoiceDivisionLine[];
  let gcFeeScheduledValue = 0;

  if (invoice.lines.length > 0) {
    // Use stored per-line data
    divisions = invoice.lines.map(l => ({
      itemNumber: l.itemNumber,
      description: l.description,
      scheduledValue: Number(l.scheduledValue),
      fromPrevious: Number(l.fromPrevious),
      thisInvoice: Number(l.thisInvoice),
      pctThisInvoice: Number(l.pctThisInvoice),
    }));
    // GC fee: derive from estimate gcFeePercent applied to total scheduled
    if (invoice.estimate.gcFeePercent) {
      const rawTotal = divisions.reduce((s, l) => s + l.scheduledValue, 0);
      gcFeeScheduledValue = Math.round(rawTotal * Number(invoice.estimate.gcFeePercent) / 100 * 100) / 100;
    }
  } else {
    // Fallback: compute from estimate divisions at uniform pct
    const rawDivisions = invoice.estimate.divisions.map((d, i) => {
      const rawCode = d.csiCode ? d.csiCode.slice(0, 2).trim() : null;
      const itemNumber = rawCode ? `Div ${rawCode}` : `Div ${i + 1}`;
      const total = d.manualTotal !== null && d.manualTotal !== undefined
        ? Number(d.manualTotal)
        : [...d.items, ...d.groups.flatMap(g => g.items)].reduce((s, it) => s + itemTotal(it), 0);
      return { itemNumber, description: d.name, scheduledValue: total };
    }).filter(l => l.scheduledValue > 0);

    const rawTotal = rawDivisions.reduce((s, l) => s + l.scheduledValue, 0);
    if (invoice.estimate.gcFeePercent) {
      gcFeeScheduledValue = Math.round(rawTotal * Number(invoice.estimate.gcFeePercent) / 100 * 100) / 100;
    }
    divisions = rawDivisions;
  }

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    phase: invoice.phase,
    trigger: invoice.trigger,
    pct: Number(invoice.pct),
    amount: Number(invoice.amount),
    estimateName: invoice.estimate.name,
    clientName: client.name,
    clientAddress: clientAddress || null,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    payments: invoice.payments.map(p => ({
      amount: Number(p.amount),
      method: p.method,
      paidDate: p.paidDate,
      notes: p.notes,
    })),
    divisions,
    gcFeeScheduledValue,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
