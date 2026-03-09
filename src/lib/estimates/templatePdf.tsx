import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

const GOLD = "#C9A84C";
const DARK = "#1e293b";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTotal(qty: number | null, cost: number | null, markup: number | null): number {
  return (qty ?? 0) * (cost ?? 0) * (1 + (markup ?? 0) / 100);
}

function isItemFilled(item: Item): boolean {
  return item.defaultQty !== null || item.defaultUnitCost !== null;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, color: DARK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: GOLD },

  // Left column
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GOLD, marginBottom: 3 },
  companyAddress: { fontSize: 9, color: "#475569" },
  companyPhone: { fontSize: 9, color: "#475569", marginTop: 2 },
  companyLicense: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 5 },

  // Center column
  centerSection: { flex: 1, alignItems: "center", paddingHorizontal: 16, paddingTop: 4 },
  scopeLabel: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "center", marginBottom: 5 },
  estimateMetaText: { fontSize: 9, color: "#475569", textAlign: "center", marginTop: 2 },

  // Right column
  clientName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3, textAlign: "right" },
  clientAddress: { fontSize: 9, color: "#475569", textAlign: "right" },

  // Division header row — text/total both white (not gold)
  divisionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 8, paddingVertical: 5, marginTop: 12, borderRadius: 3 },
  divisionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  divisionCsi: { fontSize: 8, color: "#ffffff" },
  divisionName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  groupHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  groupName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  groupTotal: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  colName: { flex: 3 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 40, textAlign: "center" },
  colTotal: { width: 80, textAlign: "right" },
  headerText: { fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cellText: { fontSize: 8, color: "#334155" },
  cellMuted: { fontSize: 8, color: "#94a3b8" },
  cellBold: { fontSize: 8, color: "#0f172a", fontFamily: "Helvetica-Bold" },

  // Grand total bar — label white, value GOLD
  grandTotalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, padding: 10, marginTop: 14, borderRadius: 3 },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  grandTotalValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: GOLD },

  pageNumber: { position: "absolute", bottom: 24, right: 40, fontSize: 8, color: "#94a3b8" },
});

type Item = { id: string; name: string; unit: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };

type TemplatePdfProps = {
  companyName: string;
  template: { name: string; description: string | null; estimateNumber: string | null; estimateDate: string | null };
  client: { name: string; address: string | null } | null;
  divisions: Division[];
};

function ItemTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
    </View>
  );
}

function ItemRow({ item, index }: { item: Item; index: number }) {
  const total = calcTotal(item.defaultQty, item.defaultUnitCost, item.defaultMarkupPct);
  const style = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  return (
    <View style={style}>
      <Text style={[styles.cellText, styles.colName]}>{item.name}</Text>
      <Text style={[styles.cellMuted, styles.colQty]}>{item.defaultQty ?? "—"}</Text>
      <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
      <Text style={[styles.cellBold, styles.colTotal]}>{total > 0 ? `$${fmt(total)}` : "—"}</Text>
    </View>
  );
}

function TemplatePdfDocument({ companyName, template, client, divisions }: TemplatePdfProps) {
  const grandTotal = divisions.reduce((sum, div) => {
    const divSum = [
      ...div.items.filter(isItemFilled),
      ...div.groups.flatMap(g => g.items.filter(isItemFilled)),
    ].reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
    return sum + divSum;
  }, 0);

  return (
    <Document title={`${template.name} — Estimate`} author={companyName}>
      <Page size="LETTER" style={styles.page} orientation="landscape">
        {/* Header: 3 columns */}
        <View style={styles.header}>
          {/* Left: Company */}
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyAddress}>2950 N 28 Terr, Hollywood, FL 33020</Text>
            <Text style={styles.companyPhone}>Tel: 305-746-7307</Text>
            <Text style={styles.companyLicense}>CGC1527069 | CCC1336817</Text>
          </View>

          {/* Center: Scope of Work, Date, Estimate # */}
          <View style={styles.centerSection}>
            <Text style={styles.scopeLabel}>Scope of Work: {template.name}</Text>
            {template.estimateDate ? (
              <Text style={styles.estimateMetaText}>{template.estimateDate}</Text>
            ) : null}
            {template.estimateNumber ? (
              <Text style={styles.estimateMetaText}>Estimate #{template.estimateNumber}</Text>
            ) : null}
          </View>

          {/* Right: Client */}
          <View>
            {client ? (
              <>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.address ? <Text style={styles.clientAddress}>{client.address}</Text> : null}
              </>
            ) : null}
          </View>
        </View>

        {/* Divisions */}
        {divisions.map((div) => {
          const divFilledItems = div.items.filter(isItemFilled);
          const divGroupsWithItems = div.groups.map(g => ({ ...g, items: g.items.filter(isItemFilled) })).filter(g => g.items.length > 0);
          if (divFilledItems.length === 0 && divGroupsWithItems.length === 0) return null;

          const divTotal = [
            ...divFilledItems,
            ...divGroupsWithItems.flatMap(g => g.items),
          ].reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);

          return (
            <View key={div.id}>
              <View style={styles.divisionHeader}>
                <View style={styles.divisionLeft}>
                  {div.csiCode ? <Text style={styles.divisionCsi}>{div.csiCode}</Text> : null}
                  <Text style={styles.divisionName}>{div.name}</Text>
                </View>
                <Text style={styles.divisionTotal}>${fmt(divTotal)}</Text>
              </View>

              {divGroupsWithItems.map((grp) => {
                const grpTotal = grp.items.reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
                return (
                  <View key={grp.id}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupName}>{grp.name}</Text>
                      <Text style={styles.groupTotal}>{grpTotal > 0 ? `$${fmt(grpTotal)}` : ""}</Text>
                    </View>
                    <ItemTableHeader />
                    {grp.items.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} />)}
                  </View>
                );
              })}

              {divFilledItems.length > 0 && (
                <View>
                  <ItemTableHeader />
                  {divFilledItems.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} />)}
                </View>
              )}
            </View>
          );
        })}

        {/* Grand total — label white, value gold */}
        <View style={styles.grandTotalBar}>
          <Text style={styles.grandTotalLabel}>ESTIMATE TOTAL</Text>
          <Text style={styles.grandTotalValue}>${fmt(grandTotal)}</Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderTemplatePdf(props: TemplatePdfProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(React.createElement(TemplatePdfDocument, props) as any);
  return Buffer.from(buf as unknown as Uint8Array);
}
