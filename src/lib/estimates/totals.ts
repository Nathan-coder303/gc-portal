export type ItemLike = {
  qty: number;
  unitCost: number;
  laborCost: number;
  materialCost: number;
  markupPct: number;
  manualTotal: number | null;
};

export function computeItemTotal(item: ItemLike): number {
  if (item.manualTotal !== null && item.manualTotal !== undefined) return item.manualTotal;
  const base = item.qty * item.unitCost;
  return base * (1 + item.markupPct / 100);
}

export function computeGroupTotal(items: ItemLike[]): number {
  return items.reduce((s, i) => s + computeItemTotal(i), 0);
}

export function computeDivisionTotal(
  groups: { items: ItemLike[] }[],
  ungroupedItems: ItemLike[]
): number {
  const groupSum = groups.reduce((s, g) => s + computeGroupTotal(g.items), 0);
  const itemSum = ungroupedItems.reduce((s, i) => s + computeItemTotal(i), 0);
  return groupSum + itemSum;
}

export function computeEstimateTotal(
  divisions: { groups: { items: ItemLike[] }[]; items: ItemLike[] }[]
): number {
  return divisions.reduce(
    (s, d) => s + computeDivisionTotal(d.groups, d.items),
    0
  );
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
