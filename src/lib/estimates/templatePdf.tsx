import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#2563eb" },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#2563eb", marginBottom: 2 },
  templateTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 4 },
  metaText: { fontSize: 8, color: "#94a3b8", textAlign: "right" },
  divisionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", paddingHorizontal: 8, paddingVertical: 5, marginTop: 10, borderRadius: 3 },
  divisionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  divisionCsi: { fontSize: 8, color: "#94a3b8" },
  divisionName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  groupName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  tableRowHidden: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 2.5, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", opacity: 0.35 },
  colName: { flex: 3 },
  colUnit: { width: 36, textAlign: "center" },
  colQty: { width: 40, textAlign: "right" },
  colCost: { width: 60, textAlign: "right" },
  colMarkup: { width: 40, textAlign: "right" },
  colVisible: { width: 40, textAlign: "center" },
  headerText: { fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cellText: { fontSize: 8, color: "#334155" },
  cellMuted: { fontSize: 8, color: "#94a3b8" },
  pageNumber: { position: "absolute", bottom: 24, right: 40, fontSize: 8, color: "#94a3b8" },
});

type Item = { id: string; name: string; unit: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };

type TemplatePdfProps = {
  companyName: string;
  template: { name: string; description: string | null };
  divisions: Division[];
};

function ItemTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colQty]}>Def Qty</Text>
      <Text style={[styles.headerText, styles.colCost]}>Def Cost</Text>
      <Text style={[styles.headerText, styles.colMarkup]}>Markup</Text>
      <Text style={[styles.headerText, styles.colVisible]}>In PDF</Text>
    </View>
  );
}

function TemplateItemRow({ item, index }: { item: Item; index: number }) {
  const rowStyle = !item.visibleInPdf ? styles.tableRowHidden : index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  return (
    <View style={rowStyle}>
      <Text style={[styles.cellText, styles.colName]}>{item.name}</Text>
      <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? "—"}</Text>
      <Text style={[styles.cellMuted, styles.colQty]}>{item.defaultQty ?? "—"}</Text>
      <Text style={[styles.cellMuted, styles.colCost]}>{item.defaultUnitCost != null ? `$${item.defaultUnitCost}` : "—"}</Text>
      <Text style={[styles.cellMuted, styles.colMarkup]}>{item.defaultMarkupPct != null ? `${item.defaultMarkupPct}%` : "—"}</Text>
      <Text style={[styles.cellMuted, styles.colVisible]}>{item.visibleInPdf ? "✓" : "✗"}</Text>
    </View>
  );
}

function TemplatePdfDocument({ companyName, template, divisions }: TemplatePdfProps) {
  const totalItems = divisions.reduce((s, d) => s + d.items.length + d.groups.reduce((gs, g) => gs + g.items.length, 0), 0);
  const visibleItems = divisions.reduce((s, d) => s + d.items.filter(i => i.visibleInPdf).length + d.groups.reduce((gs, g) => gs + g.items.filter(i => i.visibleInPdf).length, 0), 0);

  return (
    <Document title={`${template.name} — Template`} author={companyName}>
      <Page size="LETTER" style={styles.page} orientation="landscape">
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={{ fontSize: 9, color: "#475569" }}>Estimate Template</Text>
          </View>
          <View>
            <Text style={styles.templateTitle}>{template.name}</Text>
            {template.description && <Text style={styles.metaText}>{template.description}</Text>}
            <Text style={styles.metaText}>{divisions.length} divisions · {totalItems} items · {visibleItems} visible in PDF</Text>
            <Text style={styles.metaText}>Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
          </View>
        </View>

        {divisions.map((div) => (
          <View key={div.id}>
            <View style={styles.divisionHeader}>
              <View style={styles.divisionLeft}>
                {div.csiCode && <Text style={styles.divisionCsi}>{div.csiCode}</Text>}
                <Text style={styles.divisionName}>{div.name}</Text>
              </View>
              <Text style={{ fontSize: 8, color: "#94a3b8" }}>
                {div.groups.reduce((s, g) => s + g.items.length, 0) + div.items.length} items
              </Text>
            </View>

            {div.groups.map((grp) => (
              <View key={grp.id}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{grp.name}</Text>
                  <Text style={{ fontSize: 7, color: "#94a3b8" }}>{grp.items.length} items</Text>
                </View>
                <ItemTableHeader />
                {grp.items.map((item, idx) => <TemplateItemRow key={item.id} item={item} index={idx} />)}
              </View>
            ))}

            {div.items.length > 0 && (
              <View>
                <ItemTableHeader />
                {div.items.map((item, idx) => <TemplateItemRow key={item.id} item={item} index={idx} />)}
              </View>
            )}
          </View>
        ))}

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
