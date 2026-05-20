import { prisma } from "@/lib/prisma";

function itemSalePrice(item: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }): number {
  const qty = Number(item.defaultQty ?? 0);
  const cost = Number(item.defaultUnitCost ?? 0);
  const markup = Number(item.defaultMarkupPct ?? 0);
  return qty * cost * (1 + markup / 100);
}

export type RawInvoiceLine = {
  estimateItemId: string | null;
  sortOrder: number;
  itemNumber: string;
  description: string;
  scheduledValue: number;
  fromPrevious: number;
  pctThisInvoice: number;
  thisInvoice: number;
};

/**
 * Builds InvoiceLines for a new invoice from the estimate's divisions/items.
 * Automatically computes fromPrevious by summing thisInvoice from previous invoices
 * for the same estimate.
 */
export async function buildInvoiceLines(
  estimateId: string,
  newInvoiceId: string,
  pct: number
): Promise<RawInvoiceLine[]> {
  // Fetch estimate divisions + items
  const divisions = await prisma.estimateTemplateDivision.findMany({
    where: { templateId: estimateId, archivedAt: null },
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
        select: { id: true, name: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true, sortOrder: true },
      },
      groups: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true, sortOrder: true },
          },
        },
      },
    },
  });

  // Fetch fromPrevious: sum thisInvoice per estimateItemId from all prior invoices
  const previousLines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { estimateId, id: { not: newInvoiceId } },
      estimateItemId: { not: null },
    },
    select: { estimateItemId: true, thisInvoice: true },
  });
  const prevMap = new Map<string, number>();
  for (const l of previousLines) {
    if (!l.estimateItemId) continue;
    prevMap.set(l.estimateItemId, (prevMap.get(l.estimateItemId) ?? 0) + Number(l.thisInvoice));
  }

  const lines: RawInvoiceLine[] = [];
  let globalSort = 0;

  divisions.forEach((div, divIdx) => {
    const divCode = div.csiCode ? div.csiCode.slice(0, 2).padStart(2, "0") : String(divIdx + 1).padStart(2, "0");

    // Collect all items in the division (direct + group items)
    const allItems: { id: string; name: string; defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown; sortOrder: number; groupName?: string }[] = [
      ...div.items.map(i => ({ ...i, groupName: undefined })),
      ...div.groups.flatMap(g => g.items.map(i => ({ ...i, groupName: g.name }))),
    ];

    if (allItems.length === 0) {
      // Division with manualTotal — treat entire division as one line
      const scheduled = div.manualTotal !== null ? Number(div.manualTotal) : 0;
      if (scheduled <= 0) return;
      const fromPrevious = prevMap.get(div.id) ?? 0;
      const thisInv = Math.round(scheduled * pct / 100 * 100) / 100;
      lines.push({
        estimateItemId: div.id,
        sortOrder: globalSort++,
        itemNumber: `${divCode}`,
        description: div.name,
        scheduledValue: scheduled,
        fromPrevious,
        pctThisInvoice: pct,
        thisInvoice: thisInv,
      });
    } else {
      // Individual items
      allItems.forEach((item, itemIdx) => {
        const price = itemSalePrice(item);
        if (price <= 0) return;
        const fromPrevious = prevMap.get(item.id) ?? 0;
        const thisInv = Math.round(price * pct / 100 * 100) / 100;
        lines.push({
          estimateItemId: item.id,
          sortOrder: globalSort++,
          itemNumber: `${divCode}.${String(itemIdx + 1).padStart(2, "0")}`,
          description: item.groupName ? `${div.name} — ${item.name}` : item.name,
          scheduledValue: price,
          fromPrevious,
          pctThisInvoice: pct,
          thisInvoice: thisInv,
        });
      });
    }
  });

  return lines;
}
