import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { computeItemTotal, computeGroupTotal, computeDivisionTotal, computeEstimateTotal, fmt } from "./totals";

// Use built-in Helvetica — no font registration needed

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
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
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 36, textAlign: "center" },
  colCost: { width: 60, textAlign: "right" },
  colMarkup: { width: 40, textAlign: "right" },
  colTotal: { width: 70, textAlign: "right" },
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
});

type Item = {
  id: string;
  name: string;
  unit: string | null;
  qty: number;
  unitCost: number;
  laborCost: number;
  materialCost: number;
  markupPct: number;
  manualTotal: number | null;
};
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };

type EstimatePdfProps = {
  companyName: string;
  projectName: string;
  estimate: { name: string; description: string | null; status: string; createdAt: Date };
  divisions: Division[];
};

function ItemTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colCost]}>Cost</Text>
      <Text style={[styles.headerText, styles.colMarkup]}>Markup</Text>
      <Text style={[styles.headerText, styles.colTotal]}>TOTAL</Text>
    </View>
  );
}

function ItemRow({ item, index }: { item: Item; index: number }) {
  const total = computeItemTotal(item);
  const style = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  return (
    <View style={style}>
      <Text style={[styles.cellText, styles.colName]}>{item.name}</Text>
      <Text style={[styles.cellText, styles.colQty]}>{item.qty}</Text>
      <Text style={[styles.cellTextMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
      <Text style={[styles.cellText, styles.colCost]}>{item.unitCost > 0 ? `$${fmt(item.unitCost)}` : "—"}</Text>
      <Text style={[styles.cellTextMuted, styles.colMarkup]}>{item.markupPct > 0 ? `${item.markupPct}%` : "—"}</Text>
      <Text style={[styles.cellTextBold, styles.colTotal]}>${fmt(total)}</Text>
    </View>
  );
}

export function EstimatePdfDocument({ companyName, projectName, estimate, divisions }: EstimatePdfProps) {
  const grandTotal = computeEstimateTotal(divisions);
  const divisionCount = divisions.length;
  const itemCount = divisions.reduce(
    (s, d) => s + d.items.length + d.groups.reduce((gs, g) => gs + g.items.length, 0),
    0
  );

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

        {/* Division breakdown summary */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerText, { flex: 1 }]}>Division</Text>
          <Text style={[styles.headerText, { width: 80, textAlign: "right" }]}>Subtotal</Text>
          <Text style={[styles.headerText, { width: 60, textAlign: "right" }]}>% of Total</Text>
        </View>
        {divisions.map((div) => {
          const divTotal = computeDivisionTotal(div.groups, div.items);
          if (divTotal === 0) return null;
          const pct = grandTotal > 0 ? (divTotal / grandTotal) * 100 : 0;
          return (
            <View key={div.id} style={styles.divisionSummaryRow}>
              <Text style={[styles.cellText, { flex: 1 }]}>
                {div.csiCode ? `${div.csiCode} — ` : ""}{div.name}
              </Text>
              <Text style={[styles.cellTextBold, { width: 80, textAlign: "right" }]}>${fmt(divTotal)}</Text>
              <Text style={[styles.cellTextMuted, { width: 60, textAlign: "right" }]}>{fmt(pct)}%</Text>
            </View>
          );
        })}

        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>ESTIMATE TOTAL</Text>
          <Text style={styles.grandTotalValue}>${fmt(grandTotal)}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* Detail pages — one per division (skip empty divisions) */}
      {divisions.map((div) => {
        const filledItems = div.items.filter(i => computeItemTotal(i) > 0);
        const filledGroups = div.groups
          .map(g => ({ ...g, items: g.items.filter(i => computeItemTotal(i) > 0) }))
          .filter(g => g.items.length > 0);
        if (filledItems.length === 0 && filledGroups.length === 0) return null;

        const divTotal = computeDivisionTotal(
          filledGroups,
          filledItems,
        );
        return (
          <Page key={div.id} size="LETTER" style={styles.page}>
            {/* Division header */}
            <View style={styles.divisionHeader}>
              <View style={styles.divisionLeft}>
                {div.csiCode && <Text style={styles.divisionCsi}>{div.csiCode}</Text>}
                <Text style={styles.divisionName}>{div.name}</Text>
              </View>
              <Text style={styles.divisionTotal}>${fmt(divTotal)}</Text>
            </View>

            {/* Groups */}
            {filledGroups.map((grp) => {
              const grpTotal = computeGroupTotal(grp.items);
              return (
                <View key={grp.id}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{grp.name}</Text>
                    <Text style={styles.groupTotal}>${fmt(grpTotal)}</Text>
                  </View>
                  <ItemTableHeader />
                  {grp.items.map((item, idx) => (
                    <ItemRow key={item.id} item={item} index={idx} />
                  ))}
                </View>
              );
            })}

            {/* Ungrouped items */}
            {filledItems.length > 0 && (
              <View>
                <ItemTableHeader />
                {filledItems.map((item, idx) => (
                  <ItemRow key={item.id} item={item} index={idx} />
                ))}
              </View>
            )}

            {/* Division subtotal */}
            <View style={[styles.grandTotal, { marginTop: 8 }]}>
              <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>
                {div.csiCode ? `${div.csiCode} — ` : ""}{div.name} Subtotal
              </Text>
              <Text style={[styles.grandTotalValue, { fontSize: 12 }]}>${fmt(divTotal)}</Text>
            </View>

            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              fixed
            />
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
