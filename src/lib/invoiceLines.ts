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
 * Builds a fromPrevious map for each estimateItemId.
 * - Prior invoices WITH per-line data: sum their thisInvoice per item.
 * - Prior invoices WITHOUT lines (old invoices): distribute via uniform pct × scheduledValue.
 */
export async function computeFromPreviousMap(
  estimateId: string,
  excludeInvoiceId: string,
  schedMap: Map<string, number>  // estimateItemId → scheduledValue
): Promise<Map<string, number>> {
  const otherInvoices = await prisma.invoice.findMany({
    where: { estimateId, id: { not: excludeInvoiceId } },
    select: {
      pct: true,
      lines: {
        where: { estimateItemId: { not: null } },
        select: { estimateItemId: true, thisInvoice: true },
      },
    },
  });

  const prevMap = new Map<string, number>();

  for (const inv of otherInvoices) {
    if (inv.lines.length > 0) {
      for (const line of inv.lines) {
        if (!line.estimateItemId) continue;
        prevMap.set(line.estimateItemId, (prevMap.get(line.estimateItemId) ?? 0) + Number(line.thisInvoice));
      }
    } else {
      // Old invoice without lines — distribute uniformly by pct
      const invPct = Number(inv.pct) / 100;
      schedMap.forEach((scheduled, itemId) => {
        const contribution = Math.round(scheduled * invPct * 100) / 100;
        prevMap.set(itemId, (prevMap.get(itemId) ?? 0) + contribution);
      });
    }
  }

  return prevMap;
}

/**
 * Builds InvoiceLines for a new invoice from the estimate's divisions/items.
 */
export async function buildInvoiceLines(
  estimateId: string,
  newInvoiceId: string,
  pct: number
): Promise<RawInvoiceLine[]> {
  const [divisions, estimateMeta] = await Promise.all([
  prisma.estimateTemplateDivision.findMany({
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
  }),
  prisma.estimateTemplate.findUnique({
    where: { id: estimateId },
    select: { gcFeePercent: true },
  }),
  ]);

  // Build scheduled value map for all items first (needed for fromPrevious computation)
  const tempLines: { estimateItemId: string; scheduledValue: number }[] = [];
  divisions.forEach((div) => {
    const allItems = [
      ...div.items.map(i => ({ ...i, groupName: undefined as string | undefined })),
      ...div.groups.flatMap(g => g.items.map(i => ({ ...i, groupName: g.name }))),
    ];
    if (allItems.length === 0) {
      const scheduled = div.manualTotal !== null ? Number(div.manualTotal) : 0;
      if (scheduled > 0) tempLines.push({ estimateItemId: div.id, scheduledValue: scheduled });
    } else {
      allItems.forEach(item => {
        const price = itemSalePrice(item);
        if (price > 0) tempLines.push({ estimateItemId: item.id, scheduledValue: price });
      });
    }
  });

  // Add synthetic GC fee entry to schedMap for fromPrevious tracking
  if (estimateMeta?.gcFeePercent) {
    const rawTotal = tempLines.reduce((s, l) => s + l.scheduledValue, 0);
    const gcFeeScheduled = Math.round(rawTotal * Number(estimateMeta.gcFeePercent) / 100 * 100) / 100;
    if (gcFeeScheduled > 0) {
      tempLines.push({ estimateItemId: `${estimateId}:gc`, scheduledValue: gcFeeScheduled });
    }
  }

  const schedMap = new Map(tempLines.map(l => [l.estimateItemId, l.scheduledValue]));
  const prevMap = await computeFromPreviousMap(estimateId, newInvoiceId, schedMap);

  const lines: RawInvoiceLine[] = [];
  let globalSort = 0;

  divisions.forEach((div, divIdx) => {
    const divCode = div.csiCode ? div.csiCode.slice(0, 2).padStart(2, "0") : String(divIdx + 1).padStart(2, "0");

    const allItems: { id: string; name: string; defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown; sortOrder: number; groupName?: string }[] = [
      ...div.items.map(i => ({ ...i, groupName: undefined })),
      ...div.groups.flatMap(g => g.items.map(i => ({ ...i, groupName: g.name }))),
    ];

    if (allItems.length === 0) {
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
      allItems.forEach((item, itemIdx) => {
        const price = itemSalePrice(item);
        if (price <= 0) return;
        const fromPrevious = prevMap.get(item.id) ?? 0;
        const thisInv = Math.round(price * pct / 100 * 100) / 100;
        lines.push({
          estimateItemId: item.id,
          sortOrder: globalSort++,
          itemNumber: `${divCode}.${String(itemIdx + 1).padStart(2, "0")}.00`,
          description: item.groupName ? `${div.name} — ${item.name}` : item.name,
          scheduledValue: price,
          fromPrevious,
          pctThisInvoice: pct,
          thisInvoice: thisInv,
        });
      });
    }
  });

  // Append GC Fee as an actual line item
  if (estimateMeta?.gcFeePercent) {
    const rawTotal = lines.reduce((s, l) => s + l.scheduledValue, 0);
    const gcFeeScheduled = Math.round(rawTotal * Number(estimateMeta.gcFeePercent) / 100 * 100) / 100;
    if (gcFeeScheduled > 0) {
      const gcItemId = `${estimateId}:gc`;
      const fromPrevious = prevMap.get(gcItemId) ?? 0;
      const thisInv = Math.round(gcFeeScheduled * pct / 100 * 100) / 100;
      lines.push({
        estimateItemId: gcItemId,
        sortOrder: globalSort++,
        itemNumber: "GC",
        description: "GC Fee",
        scheduledValue: gcFeeScheduled,
        fromPrevious,
        pctThisInvoice: pct,
        thisInvoice: thisInv,
      });
    }
  }

  return lines;
}
