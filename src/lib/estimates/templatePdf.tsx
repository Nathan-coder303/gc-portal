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

// ─── Summary groupings (super-divisions) ──────────────────────────────────────
const SUMMARY_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "SHELL", prefixes: ["03", "04"] },
];

function getGroupLabel(csiCode: string | null): string | null {
  if (!csiCode) return null;
  const prefix = csiCode.replace(/\s/g, "").substring(0, 2);
  return SUMMARY_GROUPS.find(g => g.prefixes.includes(prefix))?.label ?? null;
}

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
  divisionCsi: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  groupHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  groupName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  groupTotal: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  colName: { flex: 3 },
  colDetail: { width: 60, textAlign: "center" },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 40, textAlign: "center" },
  colTotal: { width: 80, textAlign: "right" },
  headerText: { fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cellText: { fontSize: 8, color: "#334155" },
  cellMuted: { fontSize: 8, color: "#94a3b8" },
  cellBold: { fontSize: 8, color: "#0f172a", fontFamily: "Helvetica-Bold" },

  grandTotalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, padding: 10, marginTop: 14, borderRadius: 3 },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#C9A84C" },

  groupSuperHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 8, paddingVertical: 5, marginTop: 12, borderRadius: 3 },
  groupSuperLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  groupSuperTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
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

  // Signature block
  sigSection: { marginTop: 28 },
  sigRow: { flexDirection: "row", gap: 40, marginTop: 20 },
  sigBlock: { flex: 1 },
  sigPartyLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#475569", marginBottom: 3 },
  sigLineLabel: { fontSize: 7, color: "#94a3b8" },
  sigPrefilled: { fontSize: 9, color: DARK, fontFamily: "Helvetica-Bold", marginBottom: 3 },
});

// Defined outside StyleSheet.create to avoid any style inheritance/override issues
const GRAND_TOTAL_VALUE_STYLE = { fontSize: 16 as const, fontFamily: "Helvetica-Bold" as const, color: "#C9A84C" as const };

type Item = { id: string; name: string; detail: string | null; unit: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };

type PaymentRow = { payment: string; trigger: string; pct: number };

type SummaryGroupOverride = { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null };

function computeOverrideTotal(sg: SummaryGroupOverride): number | null {
  if (sg.manualTotal !== null && sg.manualTotal !== undefined) return sg.manualTotal;
  if (sg.qty !== null || sg.unitCost !== null) {
    return (sg.qty ?? 0) * (sg.unitCost ?? 0) * (1 + (sg.markupPct ?? 0) / 100);
  }
  return null;
}

type TemplatePdfProps = {
  companyName: string;
  template: { name: string; description: string | null; estimateNumber: string | null; estimateDate: string | null };
  client: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null } | null;
  divisions: Division[];
  showTerms?: boolean;
  termsContent?: string | null;
  paymentSchedule?: PaymentRow[] | null;
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
      <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
    </View>
  );
}

function ItemRow({ item, index }: { item: Item; index: number }) {
  const isExcluded = item.detail === "Excluded";
  const total = calcTotal(item.defaultQty, item.defaultUnitCost, item.defaultMarkupPct);
  const rowStyle = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  const detailColor = isExcluded ? "#dc2626" : item.detail === "Allowances" ? "#d97706" : "#334155";
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: index % 2 === 0 ? undefined : "#fafafa" }}>
      <View style={[rowStyle, { borderBottomWidth: 0 }]}>
        <Text style={[styles.cellText, styles.colName]}>{item.name}</Text>
        <Text style={[{ fontSize: 7, color: detailColor, textAlign: "center" }, styles.colDetail]}>{item.detail?.toUpperCase() ?? ""}</Text>
        {isExcluded ? (
          <>
            <Text style={[styles.cellMuted, styles.colQty]}>—</Text>
            <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellMuted, styles.colTotal]}>$0.00</Text>
          </>
        ) : (
          <>
            <Text style={[styles.cellMuted, styles.colQty]}>{item.defaultQty ?? "—"}</Text>
            <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellBold, styles.colTotal]}>{total > 0 ? `$${fmt(total)}` : "—"}</Text>
          </>
        )}
      </View>
      {item.notes ? (
        <Text style={{ fontSize: 7, color: "#64748b", fontFamily: "Helvetica-Oblique", paddingHorizontal: 8, paddingBottom: 3 }}>{item.notes}</Text>
      ) : null}
    </View>
  );
}

function TemplatePdfDocument({ companyName, template, client, divisions, termsContent, paymentSchedule, gcFeePercent, summaryGroups }: Omit<TemplatePdfProps, "showTerms">) {
  const grouped = groupDivisions(divisions);

  // Compute raw totals per group label (or null for ungrouped)
  function rawGroupTotal(divs: Division[]): number {
    return divs.reduce((sum, div) => {
      return sum + [
        ...div.items.filter(isItemFilled),
        ...div.groups.flatMap(g => g.items.filter(isItemFilled)),
      ].reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
    }, 0);
  }

  // Grand total: use override for labeled groups if set
  const grandTotal = grouped.reduce((sum, { groupLabel, divs }) => {
    if (groupLabel && summaryGroups?.[groupLabel]) {
      const override = computeOverrideTotal(summaryGroups[groupLabel]);
      if (override !== null) return sum + override;
    }
    return sum + rawGroupTotal(divs);
  }, 0);

  const allowancesTotal = divisions.reduce((sum, div) => {
    return sum + [
      ...div.items.filter(i => i.detail === "Allowances"),
      ...div.groups.flatMap(g => g.items.filter(i => i.detail === "Allowances")),
    ].reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
  }, 0);

  const gcFee = gcFeePercent && gcFeePercent > 0 ? gcFeePercent : 0;
  const gcFeeAmount = gcFee > 0 ? grandTotal * gcFee / 100 : 0;
  const grandTotalWithGc = grandTotal + gcFeeAmount;

  const dateDisplay = fmtDate(template.estimateDate);

  return (
    <Document title={`${template.name} — Estimate`} author={companyName}>
      <Page size="LETTER" style={styles.page}>
        {/* Header: 3 columns */}
        <View style={styles.header}>
          {/* Left: Logo + company info all bold same size */}
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
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

        {/* Divisions — grouped into super-sections (e.g. SHELL) */}
        {grouped.map(({ groupLabel, divs }, gi) => {
          // Pre-filter each division's items
          const filteredDivs = divs.map(div => ({
            div,
            filledItems: div.items.filter(i => isItemFilled(i) || !!i.detail),
            filledGroups: div.groups.map(g => ({ ...g, items: g.items.filter(i => isItemFilled(i) || !!i.detail) })).filter(g => g.items.length > 0),
          })).filter(({ filledItems, filledGroups }) => filledItems.length > 0 || filledGroups.length > 0);

          if (filteredDivs.length === 0) return null;

          const rawTotal = filteredDivs.reduce((s, { filledItems, filledGroups }) =>
            s + [...filledItems, ...filledGroups.flatMap(g => g.items)].reduce((ss, i) => ss + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0), 0);
          const overrideTotal = groupLabel && summaryGroups?.[groupLabel] ? computeOverrideTotal(summaryGroups[groupLabel]) : null;
          const groupTotal = overrideTotal !== null ? overrideTotal : rawTotal;

          return (
            <View key={gi}>
              {/* Super-group header (e.g. SHELL) */}
              {groupLabel && (
                <View style={styles.groupSuperHeader}>
                  <Text style={styles.groupSuperLabel}>{groupLabel}</Text>
                  <Text style={styles.groupSuperTotal}>${fmt(groupTotal)}</Text>
                </View>
              )}

              {filteredDivs.map(({ div, filledItems, filledGroups }) => {
                const divTotal = [...filledItems, ...filledGroups.flatMap(g => g.items)]
                  .reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);

                return (
                  <View key={div.id}>
                    <View style={[styles.divisionHeader, groupLabel ? { marginTop: 6 } : {}]}>
                      <View style={styles.divisionLeft}>
                        {div.csiCode ? <Text style={styles.divisionCsi}>{div.csiCode}</Text> : null}
                        <Text style={styles.divisionName}>{div.name}</Text>
                      </View>
                      <Text style={styles.divisionTotal}>${fmt(divTotal)}</Text>
                    </View>

                    {filledGroups.map((grp) => {
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

                    {filledItems.length > 0 && (
                      <View>
                        <ItemTableHeader />
                        {filledItems.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} />)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Allowances total */}
        {allowancesTotal > 0 && (
          <View style={[styles.grandTotalBar, { marginTop: 6, backgroundColor: "#2d2410" }]}>
            <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>TOTAL ALLOWANCES</Text>
            <Text style={[GRAND_TOTAL_VALUE_STYLE, { fontSize: 13 }]}>${fmt(allowancesTotal)}</Text>
          </View>
        )}

        {/* GC Overhead & Profit row */}
        {gcFeeAmount > 0 && (
          <>
            {/* Subtotal row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
              <Text style={[styles.headerText, { fontSize: 8, color: "#475569" }]}>SUBTOTAL</Text>
              <Text style={[styles.cellBold, { fontSize: 9 }]}>${fmt(grandTotal)}</Text>
            </View>
            {/* GC line item row */}
            <View style={[styles.tableRow, { marginTop: 0 }]}>
              <Text style={[styles.cellText, styles.colName]}>01 10 00 – GC Overhead &amp; Profit</Text>
              <Text style={[{ fontSize: 7, color: "#475569", textAlign: "center" }, styles.colDetail]}>%</Text>
              <Text style={[styles.cellText, styles.colQty]}>{fmt(gcFee)}</Text>
              <Text style={[styles.cellMuted, styles.colUnit]}>%</Text>
              <Text style={[styles.cellBold, styles.colTotal]}>${fmt(gcFeeAmount)}</Text>
            </View>
          </>
        )}

        {/* Grand total */}
        <View style={[styles.grandTotalBar, { marginTop: gcFeeAmount > 0 ? 4 : (allowancesTotal > 0 ? 4 : 14) }]}>
          <Text style={styles.grandTotalLabel}>ESTIMATE TOTAL</Text>
          <Text style={GRAND_TOTAL_VALUE_STYLE}>${fmt(grandTotalWithGc)}</Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>

      {/* T&C + Payment Schedule — always on a dedicated final page */}
      <Page size="LETTER" style={styles.page}>
        {/* Page header repeat */}
        <View style={[styles.header, { marginBottom: 12 }]}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.logo} src={path.join(process.cwd(), "public", "logo.png")} />
            <Text style={styles.companyInfo}>2950 N 28 Terr, Hollywood, FL 33020</Text>
            <Text style={styles.companyInfo}>Tel: 305-746-7307</Text>
            <Text style={styles.companyInfo}>CGC1527069 | CCC1336817</Text>
          </View>
          <View style={styles.centerSection}>
            <Text style={styles.centerBold}>Scope of Work: {template.name}</Text>
          </View>
          <View />
        </View>

        {/* Payment Schedule */}
        <Text style={styles.sectionTitle}>Payment Schedule</Text>
        <View style={styles.payTable}>
          <View style={styles.payHeaderRow}>
            <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase" }, styles.payColPayment]}>Payment</Text>
            <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase" }, styles.payColTrigger]}>Trigger / Milestone</Text>
            <Text style={[{ fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", textAlign: "right" }, styles.payColPct]}>%</Text>
          </View>
          {(paymentSchedule ?? []).map((row, idx) => (
            <View key={idx} style={idx % 2 === 0 ? styles.payRow : styles.payRowAlt}>
              <Text style={[{ color: "#0f172a", fontFamily: "Helvetica-Bold" }, styles.payColPayment]}>{row.payment}</Text>
              <Text style={[{ color: "#475569" }, styles.payColTrigger]}>{row.trigger}</Text>
              <Text style={[{ color: GOLD, fontFamily: "Helvetica-Bold", textAlign: "right" }, styles.payColPct]}>{row.pct}%</Text>
            </View>
          ))}
        </View>

        {/* T&C inline — gold divider then content, no page break */}
        {termsContent ? (
          <View>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>
            {termsContent.split(/\r?\n\r?\n|\r?\n(?=\d+[\.\)]?\s)/).filter(Boolean).map((para, i) => (
              <Text key={i} style={[styles.termsText, { marginBottom: 6 }]}>{para.trim()}</Text>
            ))}
          </View>
        ) : null}

        {/* Signature Block */}
        <View style={styles.sigSection}>
          <View style={styles.sectionDivider} />
          <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>Agreement &amp; Authorization</Text>
          <Text style={{ fontSize: 8, color: "#475569", marginBottom: 4 }}>
            By signing below, both parties agree to the scope of work, pricing, and terms described in this document.
          </Text>
          <View style={styles.sigRow}>
            {/* Customer */}
            <View style={styles.sigBlock}>
              <Text style={styles.sigPartyLabel}>Customer</Text>
              <View style={[styles.sigLine, { marginBottom: 3, height: 20 }]} />
              <Text style={styles.sigLineLabel}>Signature</Text>
              <View style={{ height: 14 }} />
              <View style={styles.sigLine} />
              <Text style={styles.sigLineLabel}>Name (Print)</Text>
              <View style={{ height: 14 }} />
              <View style={styles.sigLine} />
              <Text style={styles.sigLineLabel}>Date</Text>
            </View>
            {/* Contractor */}
            <View style={styles.sigBlock}>
              <Text style={styles.sigPartyLabel}>Contractor</Text>
              <View style={[styles.sigLine, { marginBottom: 3, height: 20 }]} />
              <Text style={styles.sigLineLabel}>Signature</Text>
              <View style={{ height: 14 }} />
              <View style={styles.sigLine} />
              <Text style={styles.sigPrefilled}>Mike Baruh</Text>
              <Text style={styles.sigLineLabel}>Name (Print)</Text>
              <View style={{ height: 14 }} />
              <View style={styles.sigLine} />
              <Text style={styles.sigLineLabel}>Date</Text>
            </View>
          </View>
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
