import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";
import React from "react";

Font.registerHyphenationCallback((word) => [word]);

const GOLD = "#C9A84C";
const DARK = "#111111";
const GRAY = "#555555";
const LGRAY = "#888888";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export type InvoicePdfLine = {
  itemNumber: string;
  description: string;
  scheduledValue: number;
  fromPrevious?: number;
  thisInvoice?: number;
  pctThisInvoice?: number;
  isDivisionHeader?: boolean;
};

type PaymentEntry = { amount: number; method: string; paidDate: Date | string; notes?: string | null };

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: DARK, padding: "24pt 28pt" },
  row: { flexDirection: "row" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2pt solid ${GOLD}`, paddingBottom: 8, marginBottom: 12 },
  invoiceNum: { fontSize: 16, fontFamily: "Helvetica-Bold", color: GOLD },
  subheader: { fontSize: 10, color: GRAY, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  grid4: { flexDirection: "row", border: `1pt solid #cccccc`, marginBottom: 12 },
  cell: { flex: 1, padding: "7pt 8pt", borderRight: `1pt solid #cccccc` },
  cellLast: { flex: 1, padding: "7pt 8pt" },
  cellLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: LGRAY, textTransform: "uppercase", marginBottom: 2 },
  cellValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  cellSub: { fontSize: 9, color: GRAY, marginTop: 1 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", borderBottom: `1pt solid #dddddd`, paddingBottom: 3, marginBottom: 6 },
  tableHead: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottom: `1pt solid #dddddd`, borderTop: `1pt solid #dddddd` },
  th: { padding: "4pt 5pt", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "right", borderRight: `1pt solid #dddddd` },
  thFirst: { padding: "4pt 5pt", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "left", borderRight: `1pt solid #dddddd` },
  thDesc: { padding: "4pt 5pt", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "left", borderRight: `1pt solid #dddddd`, flex: 1 },
  td: { padding: "3pt 5pt", fontSize: 8.5, textAlign: "right", borderRight: `1pt solid #eeeeee` },
  tdLeft: { padding: "3pt 5pt", fontSize: 8.5, textAlign: "left", borderRight: `1pt solid #eeeeee` },
  tdDesc: { padding: "3pt 5pt", fontSize: 8.5, textAlign: "left", borderRight: `1pt solid #eeeeee`, flex: 1 },
  evenRow: { backgroundColor: "#fafafa" },
  divRow: { backgroundColor: "#efefef", flexDirection: "row" },
  divText: { padding: "4pt 5pt", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#444444" },
  gcRow: { backgroundColor: "#e8e8e8", flexDirection: "row" },
  tfoot: { flexDirection: "row", backgroundColor: "#f0f0f0", borderTop: `2pt solid #cccccc` },
  tfootTd: { padding: "4pt 5pt", fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right", borderRight: `1pt solid #dddddd` },
  tfootTdLeft: { padding: "4pt 5pt", fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "left", borderRight: `1pt solid #dddddd` },
  phRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "3pt 5pt", backgroundColor: "#f9fafb", borderRadius: 3, marginBottom: 2 },
  phAmount: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  phMethod: { fontSize: 8, color: "#6b7280", marginLeft: 4 },
  phDate: { fontSize: 8, color: "#6b7280" },
  payBox: { backgroundColor: "#fff8ed", border: `1pt solid #f59e0b55`, borderRadius: 3, padding: "8pt 10pt", marginTop: 10 },
  payLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#92400e", marginBottom: 5 },
  payRow: { flexDirection: "row", marginBottom: 2 },
  payKey: { fontSize: 9, color: GRAY, width: 55 },
  payVal: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  footer: { fontSize: 8, color: "#9ca3af", borderTop: `1pt solid #f3f4f6`, paddingTop: 6, marginTop: 10, textAlign: "center" },
});

// Column widths (points)
const W = { num: 36, desc: 0 /* flex */, sched: 62, prev: 52, pct: 40, thisinv: 62, bal: 62 };

function TableHeader({ perLine }: { perLine: boolean }) {
  return (
    <View style={S.tableHead}>
      <Text style={[S.th, { width: W.num, textAlign: "left" }]}>Item #</Text>
      <Text style={[S.th, { flex: 1, textAlign: "left" }]}>Description</Text>
      <Text style={[S.th, { width: W.sched }]}>Scheduled{"\n"}Value</Text>
      {perLine && <Text style={[S.th, { width: W.prev }]}>From{"\n"}Previous</Text>}
      <Text style={[S.th, { width: W.pct }]}>%{"\n"}This Inv</Text>
      <Text style={[S.th, { width: W.thisinv }]}>This{"\n"}Invoice</Text>
      <Text style={[S.th, { width: W.bal, borderRight: 0 }]}>Balance{"\n"}to Finish</Text>
    </View>
  );
}

export async function renderInvoicePdf(opts: {
  invoiceNumber: string;
  phase: string;
  trigger: string | null;
  pct: number;
  amount: number;
  estimateName: string;
  clientName: string;
  clientAddress?: string | null;
  dueDate: Date | null;
  notes: string | null;
  payments?: PaymentEntry[];
  divisions?: InvoicePdfLine[];
  gcFeeScheduledValue?: number;
  fromName?: string;
  fromAddress?: string;
}): Promise<Buffer> {
  const payments = opts.payments ?? [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = opts.amount - totalPaid;
  const divisions = opts.divisions ?? [];
  const gcFeeScheduledValue = opts.gcFeeScheduledValue ?? 0;
  const pct = Number(opts.pct);

  const fromName = opts.fromName ?? "MIBH Construction";
  const fromAddress = opts.fromAddress ?? "2950 N 28 Terr, Hollywood, FL 33020";

  const dataLines = divisions.filter(l => !l.isDivisionHeader);
  const perLine = dataLines.some(l => l.thisInvoice !== undefined);
  const totalScheduled = dataLines.reduce((s, l) => s + l.scheduledValue, 0);
  const grandScheduled = totalScheduled + gcFeeScheduledValue;
  const totalThisInvoice = perLine
    ? dataLines.reduce((s, l) => s + (l.thisInvoice ?? 0), 0)
    : totalScheduled * pct / 100;
  const avgPct = grandScheduled > 0 ? totalThisInvoice / totalScheduled : pct / 100;
  const gcFeeThisInvoice = gcFeeScheduledValue * avgPct;
  const gcFeeBalance = gcFeeScheduledValue - gcFeeThisInvoice;

  const hasTable = divisions.length > 0;

  const doc = (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* Header */}
        <View style={S.headerBar}>
          <View>
            <Text style={S.invoiceNum}>Invoice #{opts.invoiceNumber}</Text>
            <Text style={S.subheader}>{opts.estimateName}{opts.phase ? ` · ${opts.phase}` : ""}</Text>
          </View>
          <View style={S.headerRight}>
            {opts.dueDate ? <Text style={{ fontSize: 9, color: GRAY }}>Due: <Text style={{ fontFamily: "Helvetica-Bold" }}>{fmtDate(opts.dueDate)}</Text></Text> : null}
            <Text style={{ fontSize: 8, color: LGRAY, marginTop: 3 }}>CGC 1527069 · CCC 1336817</Text>
          </View>
        </View>

        {/* 4-column info grid */}
        <View style={S.grid4}>
          <View style={S.cell}>
            <Text style={S.cellLabel}>Bill To</Text>
            <Text style={S.cellValue}>{opts.clientName}</Text>
            {opts.clientAddress ? <Text style={S.cellSub}>{opts.clientAddress}</Text> : null}
          </View>
          <View style={S.cell}>
            <Text style={S.cellLabel}>From</Text>
            <Text style={S.cellValue}>{fromName}</Text>
            <Text style={S.cellSub}>{fromAddress}</Text>
          </View>
          <View style={S.cell}>
            <Text style={S.cellLabel}>Phase</Text>
            <Text style={S.cellValue}>{opts.phase}</Text>
            {opts.trigger ? <Text style={S.cellSub}>{opts.trigger}</Text> : null}
            {hasTable ? <Text style={{ fontSize: 8, color: LGRAY, marginTop: 3 }}>{pct}% of scheduled values</Text> : null}
          </View>
          <View style={S.cellLast}>
            <Text style={S.cellLabel}>{balance <= 0 ? "Paid in Full" : "Amount Due"}</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: balance <= 0 ? "#16a34a" : GOLD }}>
              ${fmt(balance <= 0 ? 0 : balance)}
            </Text>
            <Text style={{ fontSize: 8, color: LGRAY, marginTop: 2 }}>Invoice Total: ${fmt(opts.amount)}</Text>
            {totalPaid > 0 ? <Text style={{ fontSize: 8, color: "#16a34a", marginTop: 1 }}>Paid: ${fmt(totalPaid)}</Text> : null}
          </View>
        </View>

        {/* Schedule of Values table */}
        {hasTable && (
          <View style={{ marginBottom: 12 }}>
            <Text style={S.sectionTitle}>Schedule of Values — This Invoice</Text>
            <TableHeader perLine={perLine} />
            {divisions.map((l, i) => {
              if (l.isDivisionHeader) {
                return (
                  <View key={i} style={S.divRow}>
                    <Text style={[S.divText, { flex: 1 }]}>{l.itemNumber} — {l.description}</Text>
                  </View>
                );
              }
              const prevAmt = l.fromPrevious ?? 0;
              const thisInv = l.thisInvoice !== undefined ? l.thisInvoice : Math.round(l.scheduledValue * pct / 100 * 100) / 100;
              const linePct = l.pctThisInvoice !== undefined ? l.pctThisInvoice : pct;
              const bal = l.scheduledValue - prevAmt - thisInv;
              const isGC = l.itemNumber === "GC";
              const rowStyle = isGC ? S.gcRow : (i % 2 === 0 ? { flexDirection: "row" as const } : [{ flexDirection: "row" as const }, S.evenRow]);
              return (
                <View key={i} style={rowStyle}>
                  <Text style={[S.tdLeft, { width: W.num, fontFamily: isGC ? "Helvetica-Bold" : "Helvetica", fontSize: 8, color: isGC ? "#555" : DARK }]}>{l.itemNumber}</Text>
                  <Text style={[S.tdDesc, { fontFamily: isGC ? "Helvetica-Bold" : "Helvetica", fontSize: 8, color: isGC ? "#555" : DARK }]}>{l.description}</Text>
                  <Text style={[S.td, { width: W.sched }]}>${fmt(l.scheduledValue)}</Text>
                  {perLine && <Text style={[S.td, { width: W.prev }]}>{prevAmt > 0 ? `$${fmt(prevAmt)}` : "—"}</Text>}
                  <Text style={[S.td, { width: W.pct, color: GOLD, fontFamily: "Helvetica-Bold" }]}>{linePct}%</Text>
                  <Text style={[S.td, { width: W.thisinv, color: GOLD, fontFamily: "Helvetica-Bold" }]}>${fmt(thisInv)}</Text>
                  <Text style={[S.td, { width: W.bal, borderRight: 0 }]}>${fmt(bal)}</Text>
                </View>
              );
            })}
            {gcFeeScheduledValue > 0 && (
              <View style={S.gcRow}>
                <Text style={[S.tdLeft, { width: W.num, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" }]}>GC</Text>
                <Text style={[S.tdDesc, { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" }]}>GC Fee</Text>
                <Text style={[S.td, { width: W.sched }]}>${fmt(gcFeeScheduledValue)}</Text>
                {perLine && <Text style={[S.td, { width: W.prev }]}>—</Text>}
                <Text style={[S.td, { width: W.pct, color: GOLD, fontFamily: "Helvetica-Bold" }]}>{(avgPct * 100).toFixed(1)}%</Text>
                <Text style={[S.td, { width: W.thisinv, color: GOLD, fontFamily: "Helvetica-Bold" }]}>${fmt(gcFeeThisInvoice)}</Text>
                <Text style={[S.td, { width: W.bal, borderRight: 0 }]}>${fmt(gcFeeBalance)}</Text>
              </View>
            )}
            {/* Totals footer */}
            <View style={S.tfoot}>
              <Text style={[S.tfootTdLeft, { width: W.num }]}>TOTALS</Text>
              <Text style={[S.tfootTdLeft, { flex: 1 }]}></Text>
              <Text style={[S.tfootTd, { width: W.sched }]}>${fmt(grandScheduled)}</Text>
              {perLine && <Text style={[S.tfootTd, { width: W.prev }]}>—</Text>}
              <Text style={[S.tfootTd, { width: W.pct }]}>—</Text>
              <Text style={[S.tfootTd, { width: W.thisinv, color: GOLD }]}>${fmt(opts.amount)}</Text>
              <Text style={[S.tfootTd, { width: W.bal, borderRight: 0 }]}>${fmt(grandScheduled - opts.amount)}</Text>
            </View>
          </View>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={S.sectionTitle}>Payment History</Text>
            {payments.map((p, i) => (
              <View key={i} style={S.phRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={S.phAmount}>${fmt(p.amount)}</Text>
                  <Text style={S.phMethod}>via {p.method}{p.notes ? ` · ${p.notes}` : ""}</Text>
                </View>
                <Text style={S.phDate}>{fmtDate(p.paidDate)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: "5pt 6pt", borderRadius: 3, backgroundColor: balance <= 0 ? "#f0fdf4" : "#fef2f2", marginTop: 3 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: balance <= 0 ? "#16a34a" : "#dc2626" }}>{balance <= 0 ? "✓ Paid in Full" : "Balance Due"}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: balance <= 0 ? "#16a34a" : "#dc2626" }}>{balance <= 0 ? "$0.00" : `$${fmt(balance)}`}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {opts.notes ? (
          <View style={{ backgroundColor: "#f9fafb", padding: "6pt 8pt", borderRadius: 3, marginBottom: 10 }}>
            <Text style={{ fontSize: 9 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Notes: </Text>{opts.notes}</Text>
          </View>
        ) : null}

        {/* Payment Instructions */}
        <View style={S.payBox}>
          <Text style={S.payLabel}>Payment Instructions</Text>
          <View style={S.payRow}><Text style={S.payKey}>Zelle</Text><Text style={S.payVal}>mikebaruh@gmail.com</Text></View>
          <View style={S.payRow}><Text style={S.payKey}>Phone</Text><Text style={S.payVal}>305-746-7307</Text></View>
          <View style={S.payRow}><Text style={S.payKey}>Check</Text><Text style={S.payVal}>Payable to MIBH Construction</Text></View>
          <Text style={{ fontSize: 8, color: "#92400e", marginTop: 5 }}>Please include Invoice #{opts.invoiceNumber} in the payment memo.</Text>
        </View>

        {/* Footer */}
        <Text style={S.footer}>MIBH Construction · CGC 1527069 | CCC 1336817 · Licensed & Insured · State of Florida</Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc) as Promise<Buffer>;
}
