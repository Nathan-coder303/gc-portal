"use client";

const GOLD = "#C9A84C";
const GREEN = "#3fb950";
const RED = "#f85149";
const YELLOW = "#d29922";

type SnapItem = { name: string; qty: number | null; unitCost: number | null; markup: number | null; unit: string | null; detail: string | null; total: number };
type SnapGroup = { name: string; items: SnapItem[] };
type SnapDivision = { name: string; csiCode: string | null; manualTotal: number | null; total: number; groups: SnapGroup[]; items: SnapItem[] };
type Snapshot = { divisions: SnapDivision[]; subtotal: number; gcFee: number; total: number };

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDiff(n: number) {
  const abs = Math.abs(n);
  const prefix = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${prefix}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function diffColor(delta: number) {
  if (delta > 0) return GREEN;
  if (delta < 0) return RED;
  return "#8b949e";
}

function allItems(div: SnapDivision): SnapItem[] {
  return [...div.items, ...div.groups.flatMap(g => g.items)];
}

type ItemChange =
  | { kind: "added"; item: SnapItem }
  | { kind: "removed"; item: SnapItem }
  | { kind: "changed"; name: string; before: SnapItem; after: SnapItem };

type DivChange =
  | { kind: "added"; div: SnapDivision }
  | { kind: "removed"; div: SnapDivision }
  | { kind: "changed"; name: string; before: SnapDivision; after: SnapDivision; itemChanges: ItemChange[]; totalDelta: number };

function computeDiff(before: Snapshot, after: Snapshot): { divChanges: DivChange[]; totalDelta: number; subtotalDelta: number; gcFeeDelta: number } {
  const divChanges: DivChange[] = [];

  const beforeMap = new Map(before.divisions.map(d => [d.name, d]));
  const afterMap = new Map(after.divisions.map(d => [d.name, d]));

  // Removed divisions
  for (const [name, div] of Array.from(beforeMap)) {
    if (!afterMap.has(name)) divChanges.push({ kind: "removed", div });
  }

  // Added divisions
  for (const [name, div] of Array.from(afterMap)) {
    if (!beforeMap.has(name)) divChanges.push({ kind: "added", div });
  }

  // Changed divisions
  for (const [name, bDiv] of Array.from(beforeMap)) {
    const aDiv = afterMap.get(name);
    if (!aDiv) continue;
    const totalDelta = aDiv.total - bDiv.total;
    if (Math.abs(totalDelta) < 0.01) continue; // no change

    // Item-level diff
    const bItems = allItems(bDiv);
    const aItems = allItems(aDiv);
    const bItemMap = new Map(bItems.map(i => [i.name, i]));
    const aItemMap = new Map(aItems.map(i => [i.name, i]));
    const itemChanges: ItemChange[] = [];

    for (const [iName, bItem] of Array.from(bItemMap)) {
      const aItem = aItemMap.get(iName);
      if (!aItem) { itemChanges.push({ kind: "removed", item: bItem }); continue; }
      if (Math.abs(aItem.total - bItem.total) > 0.01 || aItem.qty !== bItem.qty || aItem.unitCost !== bItem.unitCost) {
        itemChanges.push({ kind: "changed", name: iName, before: bItem, after: aItem });
      }
    }
    for (const [iName, aItem] of Array.from(aItemMap)) {
      if (!bItemMap.has(iName)) itemChanges.push({ kind: "added", item: aItem });
    }

    divChanges.push({ kind: "changed", name, before: bDiv, after: aDiv, itemChanges, totalDelta });
  }

  return {
    divChanges,
    totalDelta: after.total - before.total,
    subtotalDelta: after.subtotal - before.subtotal,
    gcFeeDelta: after.gcFee - before.gcFee,
  };
}

export default function EstimateVersionDiff({
  versionA, versionB, labelA, labelB, onClose,
}: {
  versionA: Snapshot;
  versionB: Snapshot;
  labelA: string;
  labelB: string;
  onClose: () => void;
}) {
  const diff = computeDiff(versionA, versionB);
  const hasChanges = diff.divChanges.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #21262d", position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Version Comparison</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#21262d", color: "#8b949e" }}>{labelA}</span>
              <span className="text-xs" style={{ color: "#484f58" }}>→</span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#21262d", color: GOLD }}>{labelB}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: "#484f58" }}>×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Summary bar */}
          <div className="rounded-lg px-4 py-3 flex flex-wrap gap-4" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
            <div>
              <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#484f58" }}>Subtotal</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>${fmt(versionA.subtotal)}</span>
                <span className="text-xs" style={{ color: "#484f58" }}>→</span>
                <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>${fmt(versionB.subtotal)}</span>
                {diff.subtotalDelta !== 0 && <span className="text-xs font-semibold" style={{ color: diffColor(diff.subtotalDelta) }}>{fmtDiff(diff.subtotalDelta)}</span>}
              </div>
            </div>
            {(versionA.gcFee > 0 || versionB.gcFee > 0) && (
              <div>
                <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#484f58" }}>GC Fee</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>${fmt(versionA.gcFee)}</span>
                  <span className="text-xs" style={{ color: "#484f58" }}>→</span>
                  <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>${fmt(versionB.gcFee)}</span>
                  {diff.gcFeeDelta !== 0 && <span className="text-xs font-semibold" style={{ color: diffColor(diff.gcFeeDelta) }}>{fmtDiff(diff.gcFeeDelta)}</span>}
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#484f58" }}>Total</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>${fmt(versionA.total)}</span>
                <span className="text-xs" style={{ color: "#484f58" }}>→</span>
                <span className="text-sm font-bold" style={{ color: GOLD }}>${fmt(versionB.total)}</span>
                {diff.totalDelta !== 0 && <span className="text-sm font-bold" style={{ color: diffColor(diff.totalDelta) }}>{fmtDiff(diff.totalDelta)}</span>}
              </div>
            </div>
          </div>

          {!hasChanges && (
            <div className="text-sm text-center py-6" style={{ color: "#484f58" }}>No changes between these two versions.</div>
          )}

          {/* Division changes */}
          {diff.divChanges.map((dc, i) => (
            <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${dc.kind === "added" ? GREEN + "44" : dc.kind === "removed" ? RED + "44" : YELLOW + "44"}` }}>
              {/* Division header */}
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: dc.kind === "added" ? "#0d2318" : dc.kind === "removed" ? "#2d1b1b" : "#1e1a0e" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.3)", color: dc.kind === "added" ? GREEN : dc.kind === "removed" ? RED : YELLOW }}>
                    {dc.kind === "added" ? "ADDED" : dc.kind === "removed" ? "REMOVED" : "CHANGED"}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                    {dc.kind === "added" ? dc.div.name : dc.kind === "removed" ? dc.div.name : dc.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {dc.kind === "changed" && (
                    <>
                      <span style={{ color: "#8b949e" }}>${fmt(dc.before.total)}</span>
                      <span style={{ color: "#484f58" }}>→</span>
                      <span style={{ color: GOLD }}>${fmt(dc.after.total)}</span>
                      <span className="font-semibold" style={{ color: diffColor(dc.totalDelta) }}>{fmtDiff(dc.totalDelta)}</span>
                    </>
                  )}
                  {dc.kind === "added" && <span style={{ color: GREEN }}>${fmt(dc.div.total)}</span>}
                  {dc.kind === "removed" && <span style={{ color: RED }}>${fmt(dc.div.total)}</span>}
                </div>
              </div>

              {/* Item-level changes */}
              {dc.kind === "changed" && dc.itemChanges.length > 0 && (
                <div>
                  {dc.itemChanges.map((ic, j) => (
                    <div key={j} className="px-4 py-2 flex items-start justify-between gap-3"
                      style={{ borderTop: "1px solid #21262d", background: j % 2 === 0 ? "#0a0f15" : "#0d1117" }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold" style={{ color: ic.kind === "added" ? GREEN : ic.kind === "removed" ? RED : YELLOW }}>
                            {ic.kind === "added" ? "+" : ic.kind === "removed" ? "−" : "~"}
                          </span>
                          <span className="text-xs truncate" style={{ color: "#e6edf3" }}>
                            {ic.kind === "changed" ? ic.name : ic.item.name}
                          </span>
                          {(ic.kind === "added" || ic.kind === "removed") && ic.item.detail === "Allowances" && (
                            <span className="text-[10px] px-1 rounded" style={{ background: "#7c3aed22", color: "#a78bfa" }}>Allowance</span>
                          )}
                        </div>
                        {ic.kind === "changed" && (
                          <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-3" style={{ color: "#484f58" }}>
                            {ic.before.qty !== ic.after.qty && <span>Qty: <span style={{ color: RED }}>{ic.before.qty ?? 0}</span> → <span style={{ color: GREEN }}>{ic.after.qty ?? 0}</span></span>}
                            {ic.before.unitCost !== ic.after.unitCost && <span>Unit cost: <span style={{ color: RED }}>${fmt(ic.before.unitCost ?? 0)}</span> → <span style={{ color: GREEN }}>${fmt(ic.after.unitCost ?? 0)}</span></span>}
                            {ic.before.markup !== ic.after.markup && <span>Markup: <span style={{ color: RED }}>{ic.before.markup ?? 0}%</span> → <span style={{ color: GREEN }}>{ic.after.markup ?? 0}%</span></span>}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-xs font-semibold" style={{ color: ic.kind === "added" ? GREEN : ic.kind === "removed" ? RED : diffColor(ic.after.total - ic.before.total) }}>
                        {ic.kind === "changed" ? fmtDiff(ic.after.total - ic.before.total) : ic.kind === "added" ? `+$${fmt(ic.item.total)}` : `-$${fmt(ic.item.total)}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full items for added/removed divisions */}
              {(dc.kind === "added" || dc.kind === "removed") && allItems(dc.div).length > 0 && (
                <div>
                  {allItems(dc.div).map((item, j) => (
                    <div key={j} className="px-4 py-2 flex items-center justify-between gap-3"
                      style={{ borderTop: "1px solid #21262d", background: j % 2 === 0 ? "#0a0f15" : "#0d1117" }}>
                      <span className="text-xs truncate" style={{ color: "#8b949e" }}>{item.name}</span>
                      <span className="text-xs font-semibold shrink-0" style={{ color: dc.kind === "added" ? GREEN : RED }}>
                        {dc.kind === "added" ? "+" : "−"}${fmt(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
