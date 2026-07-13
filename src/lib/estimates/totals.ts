export type ItemLike = {
  qty: number;
  unitCost: number;
  laborCost: number;
  materialCost: number;
  markupPct: number;
  manualTotal: number | null;
  detail?: string | null;
};

export function computeItemTotal(item: ItemLike): number {
  // Excluded items never roll into any total — they're informational only
  if (item.detail === "Excluded") return 0;
  if (item.manualTotal !== null && item.manualTotal !== undefined) return item.manualTotal;
  const base = item.qty * item.unitCost;
  return base * (1 + item.markupPct / 100);
}

export function computeGroupTotal(items: ItemLike[], manualTotal?: number | null): number {
  // A group lump-sum overrides the sum of its items (same behavior as divisions)
  if (manualTotal !== null && manualTotal !== undefined) return manualTotal;
  return items.reduce((s, i) => s + computeItemTotal(i), 0);
}

export function computeDivisionTotal(
  groups: { items: ItemLike[]; manualTotal?: number | null }[],
  ungroupedItems: ItemLike[],
  manualTotal?: number | null
): number {
  if (manualTotal !== null && manualTotal !== undefined) return manualTotal;
  const groupSum = groups.reduce((s, g) => s + computeGroupTotal(g.items, g.manualTotal), 0);
  const itemSum = ungroupedItems.reduce((s, i) => s + computeItemTotal(i), 0);
  return groupSum + itemSum;
}

export function computeEstimateTotal(
  divisions: { groups: { items: ItemLike[]; manualTotal?: number | null }[]; items: ItemLike[]; manualTotal?: number | null }[]
): number {
  return divisions.reduce(
    (s, d) => s + computeDivisionTotal(d.groups, d.items, d.manualTotal),
    0
  );
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
