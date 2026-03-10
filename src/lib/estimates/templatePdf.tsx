import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from "@react-pdf/renderer";
import React from "react";
import path from "path";

const GOLD = "#C9A84C";
const DARK = "#1e293b";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTotal(qty: number | null, cost: number | null, markup: number | null): number {
  return (qty ?? 0) * (cost ?? 0) * (1 + (markup ?? 0) / 100);
}

function isItemFilled(item: Item): boolean {
  return calcTotal(item.defaultQty, item.defaultUnitCost, item.defaultMarkupPct) > 0;
}

// Format ISO date (YYYY-MM-DD) to "March 9, 2026", or pass through free text
function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return dateStr;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: GOLD },

  // Left column
  logo: { width: 90, height: 90, marginBottom: 4 },
  companyInfo: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 2 },

  // Center column
  centerSection: { flex: 1, alignItems: "center", paddingHorizontal: 16, paddingTop: 4 },
  centerBold: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "center", marginBottom: 4 },

  // Right column
  clientName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3, textAlign: "right" },

  // Division header row — text/total both white
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

  grandTotalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, padding: 10, marginTop: 14, borderRadius: 3 },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#C9A84C" },

  sectionDivider: { borderBottomWidth: 2, borderBottomColor: GOLD, marginTop: 20, marginBottom: 0 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 8, paddingTop: 12 },

  // T&C
  termsText: { fontSize: 8, color: "#475569", lineHeight: 1.6 },

  // Payment schedule
  payTable: { marginTop: 4 },
  payHeaderRow: { flexDirection: "row", backgroundColor: DARK, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
  payRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  payRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  payColPayment: { width: 120, fontSize: 8 },
  payColTrigger: { flex: 1, fontSize: 8 },
  payColPct: { width: 40, textAlign: "right", fontSize: 8 },

  pageNumber: { position: "absolute", bottom: 24, right: 40, fontSize: 8, color: "#94a3b8" },
});

// Defined outside StyleSheet.create to avoid any style inheritance/override issues
const GRAND_TOTAL_VALUE_STYLE = { fontSize: 16 as const, fontFamily: "Helvetica-Bold" as const, color: "#C9A84C" as const };

type Item = { id: string; name: string; unit: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };

type PaymentRow = { payment: string; trigger: string; pct: number };

type TemplatePdfProps = {
  companyName: string;
  template: { name: string; description: string | null; estimateNumber: string | null; estimateDate: string | null };
  client: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  divisions: Division[];
  showTerms?: boolean;
  termsContent?: string | null;
  paymentSchedule?: PaymentRow[] | null;
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

function TemplatePdfDocument({ companyName, template, client, divisions, showTerms, termsContent, paymentSchedule }: TemplatePdfProps) {
  const grandTotal = divisions.reduce((sum, div) => {
    const divSum = [
      ...div.items.filter(isItemFilled),
      ...div.groups.flatMap(g => g.items.filter(isItemFilled)),
    ].reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
    return sum + divSum;
  }, 0);

  const dateDisplay = fmtDate(template.estimateDate);

  return (
    <Document title={`${template.name} — Estimate`} author={companyName}>
      <Page size="LETTER" style={styles.page}>
        {/* Header: 3 columns */}
        <View style={styles.header}>
          {/* Left: Logo + company info all bold same size */}
          <View>
            <Image style={styles.logo} src={path.join(process.cwd(), "public", "logo.png")} />
            <Text style={styles.companyInfo}>2950 N 28 Terr, Hollywood, FL 33020</Text>
            <Text style={styles.companyInfo}>Tel: 305-746-7307</Text>
            <Text style={styles.companyInfo}>CGC1527069 | CCC1336817</Text>
          </View>

          {/* Center: Scope of Work, Date, Estimate # — all same bold size */}
          <View style={styles.centerSection}>
            <Text style={styles.centerBold}>Scope of Work: {template.name}</Text>
            {dateDisplay ? <Text style={styles.centerBold}>{dateDisplay}</Text> : null}
            {template.estimateNumber ? <Text style={styles.centerBold}>Estimate #{template.estimateNumber}</Text> : null}
          </View>

          {/* Right: Client */}
          <View>
            {client ? (
              <>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.address ? <Text style={styles.clientName}>{client.address}</Text> : null}
                {(client.city || client.state || client.zip) ? (
                  <Text style={styles.clientName}>{[client.city, client.state, client.zip].filter(Boolean).join(", ")}</Text>
                ) : null}
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

        {/* Grand total */}
        <View style={styles.grandTotalBar}>
          <Text style={styles.grandTotalLabel}>ESTIMATE TOTAL</Text>
          <Text style={GRAND_TOTAL_VALUE_STYLE}>${fmt(grandTotal)}</Text>
        </View>

        {/* T&C section */}
        {showTerms && termsContent ? (
          <View>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>
            <Text style={styles.termsText}>{termsContent}</Text>
          </View>
        ) : null}

        {/* Payment Schedule section */}
        {paymentSchedule && paymentSchedule.length > 0 ? (
          <View>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Payment Schedule</Text>
            <View style={styles.payTable}>
              <View style={styles.payHeaderRow}>
                <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase" }, styles.payColPayment]}>Payment</Text>
                <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase" }, styles.payColTrigger]}>Trigger</Text>
                <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", textAlign: "right" }, styles.payColPct]}>%</Text>
              </View>
              {paymentSchedule.map((row, idx) => (
                <View key={idx} style={idx % 2 === 0 ? styles.payRow : styles.payRowAlt}>
                  <Text style={[{ color: "#0f172a", fontFamily: "Helvetica-Bold" }, styles.payColPayment]}>{row.payment}</Text>
                  <Text style={[{ color: "#475569" }, styles.payColTrigger]}>{row.trigger}</Text>
                  <Text style={[{ color: GOLD, fontFamily: "Helvetica-Bold", textAlign: "right" }, styles.payColPct]}>{row.pct}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
