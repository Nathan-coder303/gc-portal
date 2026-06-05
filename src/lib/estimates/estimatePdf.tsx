import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { computeItemTotal, computeGroupTotal, computeDivisionTotal, fmt } from "./totals";

// ─── Summary groupings (super-divisions) ──────────────────────────────────────
const SUMMARY_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "SHELL", prefixes: ["03", "04"] },
];

function getGroupLabel(csiCode: string | null): string | null {
  if (!csiCode) return null;
  const prefix = csiCode.replace(/\s/g, "").substring(0, 2);
  return SUMMARY_GROUPS.find(g => g.prefixes.includes(prefix))?.label ?? null;
}

type Division = { id: string; csiCode: string | null; name: string; manualTotal?: number | null; groups: Group[]; items: Item[] };
type GroupedDivisions = { groupLabel: string | null; divs: Division[] };

function groupDivisions(divisions: Division[]): GroupedDivisions[] {
  const result: GroupedDivisions[] = [];
  for (const div of divisions) {
    const label = getGroupLabel(div.csiCode);
    const last = result[result.length - 1];
    if (last && last.groupLabel === label && label !== null) {
      last.divs.push(div);
    } else {
      result.push({ groupLabel: label, divs: [div] });
    }
  }
  return result;
}

// Use built-in Helvetica — no font registration needed

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 72,
    paddingHorizontal: 40,
    color: "#1e293b",
  },
  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end" },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#2563eb", marginBottom: 2 },
  projectName: { fontSize: 10, color: "#475569" },
  estimateTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 4 },
  metaBadge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 3,
    marginBottom: 4,
    alignSelf: "flex-end",
  },
  metaText: { fontSize: 8, color: "#94a3b8", textAlign: "right" },

  // ─── Summary bar ──────────────────────────────────────────────────────────
  summaryBar: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    marginBottom: 16,
    padding: 10,
    justifyContent: "space-between",
  },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 7, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a" },

  // ─── Division ─────────────────────────────────────────────────────────────
  divisionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
    marginBottom: 0,
    borderRadius: 3,
  },
  divisionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  divisionCsi: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#93c5fd" },

  // ─── Group ────────────────────────────────────────────────────────────────
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  groupName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  groupTotal: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569" },

  // ─── Item table ───────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fafafa",
  },
  colName: { flex: 3 },
  colDetail: { width: 60, textAlign: "center" },
  colQty: { width: 36, textAlign: "right" },
  colUnit: { width: 32, textAlign: "center" },
  colCost: { width: 56, textAlign: "right" },
  colMarkup: { width: 36, textAlign: "right" },
  colTotal: { width: 66, textAlign: "right" },
  headerText: { fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cellText: { fontSize: 8, color: "#334155" },
  cellTextBold: { fontSize: 8, color: "#0f172a", fontFamily: "Helvetica-Bold" },
  cellTextMuted: { fontSize: 8, color: "#94a3b8" },

  // ─── Footer ───────────────────────────────────────────────────────────────
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 10,
    marginTop: 14,
    borderRadius: 3,
  },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  grandTotalValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#93c5fd" },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
  },
  divisionSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  groupSuperHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
    borderRadius: 3,
  },
  groupSuperLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  groupSuperTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#93c5fd" },
  groupSuperSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});

type Item = {
  id: string;
  name: string;
  detail: string | null;
  unit: string | null;
  qty: number;
  unitCost: number;
  laborCost: number;
  materialCost: number;
  markupPct: number;
  manualTotal: number | null;
  notes: string | null;
};
type Group = { id: string; name: string; items: Item[] };

type SummaryGroupOverride = { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null };

function computeOverrideTotal(sg: SummaryGroupOverride): number | null {
  if (sg.manualTotal !== null && sg.manualTotal !== undefined) return sg.manualTotal;
  if (sg.qty !== null || sg.unitCost !== null) {
    return (sg.qty ?? 0) * (sg.unitCost ?? 0) * (1 + (sg.markupPct ?? 0) / 100);
  }
  return null;
}

type EstimatePdfProps = {
  companyName: string;
  projectName: string;
  estimate: { name: string; description: string | null; status: string; createdAt: Date };
  divisions: Division[];
  gcFeePercent?: number | null;
  summaryGroups?: Record<string, SummaryGroupOverride> | null;
};

function ItemTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colDetail]}>Detail</Text>
      <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colCost]}>Cost</Text>
      <Text style={[styles.headerText, styles.colMarkup]}>Markup</Text>
      <Text style={[styles.headerText, styles.colTotal]}>TOTAL</Text>
    </View>
  );
}

function ItemRow({ item, index }: { item: Item; index: number }) {
  const isExcluded = item.detail === "Excluded";
  const total = computeItemTotal(item);
  const style = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  const detailColor = isExcluded ? "#dc2626" : item.detail === "Allowances" ? "#d97706" : "#334155";
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: index % 2 === 0 ? undefined : "#fafafa" }}>
      <View style={[style, { borderBottomWidth: 0 }]}>
        <Text style={[styles.cellText, styles.colName]}>{item.name}</Text>
        <Text style={[{ fontSize: 7, color: detailColor, textAlign: "center" }, styles.colDetail]}>{item.detail?.toUpperCase() ?? ""}</Text>
        {isExcluded ? (
          <>
            <Text style={[styles.cellTextMuted, styles.colQty]}>—</Text>
            <Text style={[styles.cellTextMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellTextMuted, styles.colCost]}>—</Text>
            <Text style={[styles.cellTextMuted, styles.colMarkup]}>—</Text>
            <Text style={[styles.cellTextMuted, styles.colTotal]}>$0.00</Text>
          </>
        ) : (
          <>
            <Text style={[styles.cellText, styles.colQty]}>{item.qty}</Text>
            <Text style={[styles.cellTextMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellText, styles.colCost]}>{item.unitCost > 0 ? `$${fmt(item.unitCost)}` : "—"}</Text>
            <Text style={[styles.cellTextMuted, styles.colMarkup]}>{item.markupPct > 0 ? `${item.markupPct}%` : "—"}</Text>
            <Text style={[styles.cellTextBold, styles.colTotal]}>${fmt(total)}</Text>
          </>
        )}
      </View>
      {item.notes ? (
        <Text style={{ fontSize: 7, color: "#64748b", fontFamily: "Helvetica-Oblique", paddingHorizontal: 8, paddingBottom: 3 }}>{item.notes}</Text>
      ) : null}
    </View>
  );
}

export function EstimatePdfDocument({ companyName, projectName, estimate, divisions, gcFeePercent, summaryGroups }: EstimatePdfProps) {
  const grouped = groupDivisions(divisions);
  // Grand total: use override for labeled groups if set
  const grandTotal = grouped.reduce((sum, { groupLabel, divs }) => {
    if (groupLabel && summaryGroups?.[groupLabel]) {
      const override = computeOverrideTotal(summaryGroups[groupLabel]);
      if (override !== null) return sum + override;
    }
    return sum + divs.reduce((s, d) => s + computeDivisionTotal(d.groups, d.items, d.manualTotal), 0);
  }, 0);
  const divisionCount = divisions.length;
  const itemCount = divisions.reduce(
    (s, d) => s + d.items.length + d.groups.reduce((gs, g) => gs + g.items.length, 0),
    0
  );
  const allowancesTotal = divisions.reduce((sum, div) => {
    return sum + [
      ...div.items.filter(i => i.detail === "Allowances"),
      ...div.groups.flatMap(g => g.items.filter(i => i.detail === "Allowances")),
    ].reduce((s, i) => s + computeItemTotal(i), 0);
  }, 0);

  const gcFee = gcFeePercent && gcFeePercent > 0 ? gcFeePercent : 0;
  const gcFeeAmount = gcFee > 0 ? grandTotal * gcFee / 100 : 0;
  const grandTotalWithGc = grandTotal + gcFeeAmount;

  // ── Auto-fit summary page: count visible rows, scale down to fit one page ──
  let visibleRowUnits = 0;
  for (const { groupLabel, divs } of grouped) {
    const hasGroupContent = divs.some(d => {
      const hasExcluded = [...d.items, ...d.groups.flatMap(g => g.items)].some(i => i.detail === "Excluded");
      return computeDivisionTotal(d.groups, d.items, d.manualTotal) > 0 || hasExcluded;
    });
    if (!hasGroupContent) continue;
    if (groupLabel) visibleRowUnits += 1.3; // group header row is a bit taller
    for (const div of divs) {
      const hasExcluded = [...div.items, ...div.groups.flatMap(g => g.items)].some(i => i.detail === "Excluded");
      const divTotal = computeDivisionTotal(div.groups, div.items, div.manualTotal);
      if (divTotal !== 0 || hasExcluded) visibleRowUnits += 1;
    }
  }
  // Pick a scale so the summary always fits on one Letter page
  const fitScale =
    visibleRowUnits <= 22 ? 1.0 :
    visibleRowUnits <= 28 ? 0.85 :
    visibleRowUnits <= 35 ? 0.72 :
    visibleRowUnits <= 45 ? 0.62 :
    visibleRowUnits <= 55 ? 0.54 :
    0.48;
  const rowPadV = Math.max(1, 3 * fitScale);
  const groupRowPadV = Math.max(1, 4 * fitScale);
  const cellFs = Math.max(6, 8 * fitScale);
  const groupSuperFs = Math.max(6.5, 9 * fitScale);

  return (
    <Document title={`${estimate.name} — Estimate`} author={companyName}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.projectName}>{projectName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.estimateTitle}>{estimate.name}</Text>
            <Text style={styles.metaBadge}>{estimate.status}</Text>
            {estimate.description ? <Text style={styles.metaText}>{estimate.description}</Text> : null}
            <Text style={styles.metaText}>
              Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Estimate Total</Text>
            <Text style={[styles.summaryValue, { color: "#2563eb" }]}>${fmt(grandTotal)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Divisions</Text>
            <Text style={styles.summaryValue}>{divisionCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Line Items</Text>
            <Text style={styles.summaryValue}>{itemCount}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text style={styles.summaryValue}>{estimate.status}</Text>
          </View>
        </View>

        {/* Division breakdown summary — grouped under super-sections */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, { flex: 1 }]}>Division</Text>
          <Text style={[styles.headerText, { width: 80, textAlign: "right" }]}>Subtotal</Text>
          <Text style={[styles.headerText, { width: 60, textAlign: "right" }]}>% of Total</Text>
        </View>
        {grouped.map(({ groupLabel, divs }, gi) => {
          const rawGroupTotal = divs.reduce((s, d) => s + computeDivisionTotal(d.groups, d.items, d.manualTotal), 0);
          const overrideTotal = groupLabel && summaryGroups?.[groupLabel] ? computeOverrideTotal(summaryGroups[groupLabel]) : null;
          const groupTotal = overrideTotal !== null ? overrideTotal : rawGroupTotal;
          const hasContent = divs.some(d => {
            const hasExcluded = [...d.items, ...d.groups.flatMap(g => g.items)].some(i => i.detail === "Excluded");
            return computeDivisionTotal(d.groups, d.items, d.manualTotal) > 0 || hasExcluded;
          });
          if (!hasContent) return null;
          const groupPct = grandTotal > 0 ? (groupTotal / grandTotal) * 100 : 0;
          return (
            <View key={gi}>
              {groupLabel && (
                <View style={[styles.groupSuperSummaryRow, { paddingVertical: groupRowPadV }]}>
                  <Text style={[styles.cellTextBold, { flex: 1, color: "#ffffff", fontSize: groupSuperFs }]}>{groupLabel}</Text>
                  <Text style={[styles.cellTextBold, { width: 80, textAlign: "right", color: "#93c5fd", fontSize: groupSuperFs }]}>${fmt(groupTotal)}</Text>
                  <Text style={[styles.cellTextMuted, { width: 60, textAlign: "right", color: "#94a3b8", fontSize: groupSuperFs }]}>{fmt(groupPct)}%</Text>
                </View>
              )}
              {divs.map((div) => {
                const hasExcluded = [...div.items, ...div.groups.flatMap(g => g.items)].some(i => i.detail === "Excluded");
                const divTotal = computeDivisionTotal(div.groups, div.items, div.manualTotal);
                if (divTotal === 0 && !hasExcluded) return null;
                const pct = grandTotal > 0 ? (divTotal / grandTotal) * 100 : 0;
                return (
                  <View key={div.id} style={[styles.divisionSummaryRow, { paddingVertical: rowPadV }, groupLabel ? { paddingLeft: 16 } : {}]}>
                    <Text style={[styles.cellText, { flex: 1, fontSize: cellFs }]}>
                      {div.csiCode ? `${div.csiCode} — ` : ""}{div.name}
                    </Text>
                    <Text style={[styles.cellTextBold, { width: 80, textAlign: "right", fontSize: cellFs }]}>${fmt(divTotal)}</Text>
                    <Text style={[styles.cellTextMuted, { width: 60, textAlign: "right", fontSize: cellFs }]}>{fmt(pct)}%</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {allowancesTotal > 0 && (
          <View style={[styles.grandTotal, { marginTop: 6, backgroundColor: "#2d2410" }]}>
            <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>TOTAL ALLOWANCES</Text>
            <Text style={[styles.grandTotalValue, { fontSize: 13, color: "#C9A84C" }]}>${fmt(allowancesTotal)}</Text>
          </View>
        )}

        {/* GC Overhead & Profit row */}
        {gcFeeAmount > 0 && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
              <Text style={[styles.headerText, { fontSize: 8, color: "#475569" }]}>SUBTOTAL</Text>
              <Text style={[styles.cellTextBold, { fontSize: 9 }]}>${fmt(grandTotal)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, { flex: 1 }]}>GC Overhead &amp; Profit</Text>
              <Text style={[styles.cellTextBold, styles.colTotal]}>${fmt(gcFeeAmount)}</Text>
            </View>
          </>
        )}

        <View style={[styles.grandTotal, { marginTop: gcFeeAmount > 0 ? 4 : (allowancesTotal > 0 ? 4 : 14) }]}>
          <Text style={styles.grandTotalLabel}>ESTIMATE TOTAL</Text>
          <Text style={styles.grandTotalValue}>${fmt(grandTotalWithGc)}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* Detail pages — one per group (merged divisions share a page) */}
      {grouped.map(({ groupLabel, divs }, gi) => {
        const filteredDivs = divs.map(div => ({
          div,
          filledItems: div.items.filter(i => computeItemTotal(i) > 0 || !!i.detail),
          filledGroups: div.groups
            .map(g => ({ ...g, items: g.items.filter(i => computeItemTotal(i) > 0 || !!i.detail) }))
            .filter(g => g.items.length > 0),
        })).filter(({ filledItems, filledGroups }) => filledItems.length > 0 || filledGroups.length > 0);

        if (filteredDivs.length === 0) return null;

        const rawPageTotal = filteredDivs.reduce((s, { filledItems, filledGroups }) =>
          s + computeDivisionTotal(filledGroups, filledItems), 0);
        const overridePageTotal = groupLabel && summaryGroups?.[groupLabel] ? computeOverrideTotal(summaryGroups[groupLabel]) : null;
        const pageTotal = overridePageTotal !== null ? overridePageTotal : rawPageTotal;

        const pageTitle = groupLabel
          ? groupLabel
          : `${filteredDivs[0].div.csiCode ? filteredDivs[0].div.csiCode + " — " : ""}${filteredDivs[0].div.name}`;

        return (
          <Page key={gi} size="LETTER" style={styles.page}>
            {/* Page super-header */}
            <View style={groupLabel ? styles.groupSuperHeader : styles.divisionHeader}>
              <View style={styles.divisionLeft}>
                <Text style={groupLabel ? styles.groupSuperLabel : styles.divisionName}>{pageTitle}</Text>
              </View>
              <Text style={groupLabel ? styles.groupSuperTotal : styles.divisionTotal}>${fmt(pageTotal)}</Text>
            </View>

            {filteredDivs.map(({ div, filledItems, filledGroups }, di) => {
              return (
                <View key={div.id} minPresenceAhead={220}>
                  {/* Sub-division header (only when grouped under a super-section) */}
                  {groupLabel && (
                    <View style={[styles.divisionHeader, { marginTop: di === 0 ? 8 : 6 }]}>
                      <View style={styles.divisionLeft}>
                        {div.csiCode && <Text style={styles.divisionCsi}>{div.csiCode}</Text>}
                        <Text style={styles.divisionName}>{div.name}</Text>
                      </View>
                    </View>
                  )}

                  {filledGroups.map((grp) => {
                    const grpTotal = computeGroupTotal(grp.items);
                    return (
                      <View key={grp.id} minPresenceAhead={100}>
                        <View style={styles.groupHeader}>
                          <Text style={styles.groupName}>{grp.name}</Text>
                          <Text style={styles.groupTotal}>${fmt(grpTotal)}</Text>
                        </View>
                        <ItemTableHeader />
                        {grp.items.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} />)}
                      </View>
                    );
                  })}

                  {filledItems.length > 0 && (
                    <View>
                      <ItemTableHeader />
                      {filledItems.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} />)}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Page subtotal */}
            <View style={[styles.grandTotal, { marginTop: 8 }]}>
              <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>{pageTitle} Subtotal</Text>
              <Text style={[styles.grandTotalValue, { fontSize: 12 }]}>${fmt(pageTotal)}</Text>
            </View>

            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
          </Page>
        );
      })}
    </Document>
  );
}

export async function renderEstimatePdf(props: EstimatePdfProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(React.createElement(EstimatePdfDocument, props) as any);
  return Buffer.from(buf as unknown as Uint8Array);
}
