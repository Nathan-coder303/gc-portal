import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf, InvoicePdfLine } from "@/lib/invoicePdf";
import { buildInvoiceHtml, InvoiceDivisionLine } from "@/lib/invoiceHtml";

export const runtime = "nodejs";
export const maxDuration = 30;

function itemTotal(item: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }): number {
  const qty = Number(item.defaultQty ?? 0);
  const cost = Number(item.defaultUnitCost ?? 0);
  const markup = Number(item.defaultMarkupPct ?? 0);
  return qty * cost * (1 + markup / 100);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  const [invoice, company] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: params.invoiceId, companyId: params.companyId },
      include: {
        client: true,
        estimate: {
          include: {
            divisions: {
              where: { archivedAt: null },
              orderBy: { sortOrder: "asc" },
              include: {
                groups: {
                  where: { archivedAt: null },
                  orderBy: { sortOrder: "asc" },
                  include: { items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
                },
                items: { where: { archivedAt: null, groupId: null }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        payments: { orderBy: { paidDate: "asc" } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!invoice || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientAddress = [
    invoice.client.address,
    invoice.client.city && invoice.client.state
      ? `${invoice.client.city}, ${invoice.client.state} ${invoice.client.zip ?? ""}`.trim()
      : null,
  ].filter(Boolean).join("\n");

  let divisions: InvoicePdfLine[];
  let gcFeeScheduledValue = 0;

  if (invoice.lines.length > 0) {
    const divMap = new Map<string, string>();
    invoice.estimate.divisions.forEach((d, i) => {
      const code = d.csiCode ? d.csiCode.slice(0, 2).padStart(2, "0") : String(i + 1).padStart(2, "0");
      divMap.set(code, d.name);
    });
    const withHeaders: InvoicePdfLine[] = [];
    let lastDivCode: string | null = null;
    for (const l of invoice.lines) {
      const rawNum = l.itemNumber;
      const divCode = rawNum.includes(".") ? rawNum.split(".")[0].padStart(2, "0") : null;
      if (divCode && divCode !== lastDivCode && divMap.has(divCode)) {
        withHeaders.push({ isDivisionHeader: true, itemNumber: `DIV ${divCode}`, description: divMap.get(divCode)!, scheduledValue: 0 });
        lastDivCode = divCode;
      }
      withHeaders.push({
        itemNumber: rawNum,
        description: l.description,
        scheduledValue: Number(l.scheduledValue),
        fromPrevious: Number(l.fromPrevious),
        thisInvoice: Number(l.thisInvoice),
        pctThisInvoice: Number(l.pctThisInvoice),
      });
    }
    divisions = withHeaders;
  } else {
    const rawDivisions = invoice.estimate.divisions.map((d, i) => {
      const rawCode = d.csiCode ? d.csiCode.slice(0, 2).trim() : null;
      const itemNumber = rawCode ? `Div ${rawCode}` : `Div ${i + 1}`;
      const total = d.manualTotal !== null && d.manualTotal !== undefined
        ? Number(d.manualTotal)
        : [...d.items, ...d.groups.flatMap(g => g.items)].reduce((s, it) => s + itemTotal(it), 0);
      return { itemNumber, description: d.name, scheduledValue: total };
    }).filter(l => l.scheduledValue > 0);
    if (invoice.estimate.gcFeePercent) {
      const rawTotal = rawDivisions.reduce((s, l) => s + l.scheduledValue, 0);
      gcFeeScheduledValue = Math.round(rawTotal * Number(invoice.estimate.gcFeePercent) / 100 * 100) / 100;
    }
    divisions = rawDivisions;
  }

  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    phase: invoice.phase,
    trigger: invoice.trigger,
    pct: Number(invoice.pct),
    amount: Number(invoice.amount),
    estimateName: invoice.estimate.name,
    clientName: invoice.client.name,
    clientAddress: clientAddress || null,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    payments: invoice.payments.map(p => ({ amount: Number(p.amount), method: p.method, paidDate: p.paidDate, notes: p.notes })),
    divisions,
    gcFeeScheduledValue,
    fromAddress: company.address ?? undefined,
  });

  const clientSlug = invoice.client.name.replace(/[^a-z0-9]/gi, "-");
  const phaseSlug = invoice.phase.replace(/[^a-z0-9]/gi, "-");
  const filename = `Invoice-${invoice.invoiceNumber}-${phaseSlug}-${invoice.pct}pct-${clientSlug}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
