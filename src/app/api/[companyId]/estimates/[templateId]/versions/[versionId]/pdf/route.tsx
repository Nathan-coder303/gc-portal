import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export const runtime = "nodejs";
export const maxDuration = 30;

const GOLD = "#C9A84C";
const DARK = "#1e293b";
const GRAY = "#64748b";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SnapItem = { name: string; qty: number | null; unitCost: number | null; markup: number | null; unit: string | null; detail: string | null; total: number };
type SnapGroup = { name: string; items: SnapItem[] };
type SnapDivision = { name: string; csiCode: string | null; manualTotal: number | null; total: number; groups: SnapGroup[]; items: SnapItem[] };
type Snapshot = { divisions: SnapDivision[]; subtotal: number; gcFee: number; total: number };

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: DARK, padding: "40 50 50 50", backgroundColor: "#ffffff" },
  header: { marginBottom: 20, borderBottom: `2 solid ${GOLD}`, paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4 },
  headerMeta: { fontSize: 8, color: GRAY },
  sectionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, marginTop: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: `1 solid #e2e8f0` },
  summaryLabel: { fontSize: 8, color: GRAY },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, marginTop: 4, borderTop: `2 solid ${GOLD}`, backgroundColor: "#fffbf0" },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: GOLD },
  divHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", paddingVertical: 5, paddingHorizontal: 6, marginTop: 10, borderLeft: `3 solid ${GOLD}` },
  divName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: DARK, flex: 1 },
  divTotal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GOLD },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6, borderBottom: `1 solid #f1f5f9` },
  itemName: { fontSize: 8, color: DARK, flex: 1 },
  itemDetail: { fontSize: 7, color: GRAY },
  itemCost: { fontSize: 8, color: DARK, textAlign: "right", minWidth: 60 },
  groupLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 1 },
  lumpRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 6, borderBottom: `1 solid #f1f5f9` },
  lumpLabel: { fontSize: 8, color: GRAY, fontFamily: "Helvetica-Oblique" },
  lumpValue: { fontSize: 8, color: DARK, textAlign: "right" },
});

function ItemRow({ item }: { item: SnapItem }) {
  const costStr = item.total > 0 ? `$${fmt(item.total)}` : "–";
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
      </View>
      <View style={{ minWidth: 120, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        {item.qty != null && item.unitCost != null && item.qty > 0 && item.unitCost > 0 ? (
          <Text style={[styles.itemDetail, { textAlign: "right", marginRight: 4 }]}>
            {item.qty} {item.unit ?? ""} × ${fmt(item.unitCost)}
            {item.markup ? ` +${item.markup}%` : ""}
          </Text>
        ) : null}
        <Text style={styles.itemCost}>{costStr}</Text>
      </View>
    </View>
  );
}

function DivisionSection({ div }: { div: SnapDivision }) {
  const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
  return (
    <View>
      <View style={styles.divHeader}>
        <Text style={styles.divName}>{div.csiCode ? `${div.csiCode} – ` : ""}{div.name}</Text>
        <Text style={styles.divTotal}>${fmt(div.total)}</Text>
      </View>
      {div.manualTotal != null ? (
        <View style={styles.lumpRow}>
          <Text style={styles.lumpLabel}>Lump sum override</Text>
          <Text style={styles.lumpValue}>${fmt(div.manualTotal)}</Text>
        </View>
      ) : (
        <>
          {div.items.map((item, i) => <ItemRow key={i} item={item} />)}
          {div.groups.map((grp, gi) => (
            <View key={gi}>
              <Text style={styles.groupLabel}>{grp.name}</Text>
              {grp.items.map((item, ii) => <ItemRow key={ii} item={item} />)}
            </View>
          ))}
          {allItems.length === 0 && (
            <View style={styles.itemRow}><Text style={styles.itemDetail}>No items</Text></View>
          )}
        </>
      )}
    </View>
  );
}

function VersionPdfDoc({ estimateName, versionLabel, createdAt, snapshot }: { estimateName: string; versionLabel: string; createdAt: string; snapshot: Snapshot }) {
  const dateStr = new Date(createdAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{estimateName}</Text>
          <Text style={styles.headerMeta}>Version: {versionLabel} · Saved {dateStr} ET</Text>
        </View>

        {/* Summary */}
        <Text style={styles.sectionLabel}>Summary</Text>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>${fmt(snapshot.subtotal)}</Text></View>
        {snapshot.gcFee > 0 && <View style={styles.summaryRow}><Text style={styles.summaryLabel}>GC Fee</Text><Text style={styles.summaryValue}>${fmt(snapshot.gcFee)}</Text></View>}
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>${fmt(snapshot.total)}</Text></View>

        {/* Divisions */}
        <Text style={styles.sectionLabel}>Breakdown</Text>
        {snapshot.divisions.map((div, i) => <DivisionSection key={i} div={div} />)}
      </Page>
    </Document>
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string; versionId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [template, rows] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: params.templateId, companyId: params.companyId },
      select: { name: true },
    }),
    prisma.$queryRaw<{ id: string; label: string; created_at: Date; snapshot: unknown }[]>(Prisma.sql`
      SELECT id, label, "createdAt" as created_at, snapshot
      FROM "EstimateVersion"
      WHERE id = ${params.versionId}
        AND "templateId" = ${params.templateId}
        AND "companyId" = ${params.companyId}
    `),
  ]);

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  if (!row.snapshot) return NextResponse.json({ error: "No snapshot for this version" }, { status: 404 });

  const snapshot = row.snapshot as Snapshot;
  const buf = await renderToBuffer(
    React.createElement(VersionPdfDoc, {
      estimateName: template.name,
      versionLabel: row.label,
      createdAt: row.created_at.toISOString(),
      snapshot,
    }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  );

  const safeName = `${template.name.replace(/[^a-z0-9]/gi, "_")}_${row.label.replace(/[^a-z0-9]/gi, "_")}.pdf`;
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
