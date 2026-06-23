import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font, Link } from "@react-pdf/renderer";
import React from "react";

Font.registerHyphenationCallback((word) => [word]);

const GOLD = "#C9A84C";
const DARK = "#0d1117";
const NAVY = "#1e2a3a";
const MID = "#374151";
const BORDER = "#cccccc";
const LIGHT = "#f7f5ef";
const MUTED = "#6b7280";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export type ChangeOrderPdfItem = {
  name: string;
  description?: string | null;
  qty: number;
  unit?: string | null;
  unitCost: number;
  markupPct?: number;
};

export type ChangeOrderPdfAttachment = {
  name: string;
  url: string;
  mimeType?: string | null;
};

export type ChangeOrderPdfInput = {
  orderNumber: string | null;
  createdAt: Date | string;
  title: string;
  notes: string | null;
  status?: string | null;
  signedAt?: Date | string | null;
  signedByName?: string | null;
  signatureData?: string | null;
  items: ChangeOrderPdfItem[];
  attachments: ChangeOrderPdfAttachment[];
  company: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    licenses?: string | null;
    website?: string | null;
    logoSrc?: string | null;
  };
  client: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    projectName?: string | null;
    projectAddress?: string | null;
  } | null;
};

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: DARK, padding: "30pt 32pt 50pt 32pt" },

  // Top header band
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  logo: { height: 56, objectFit: "contain" },
  logoFallback: { fontSize: 18, fontFamily: "Helvetica-Bold", color: GOLD },

  // CO# + Date table
  coTable: { width: 220, border: `1pt solid ${DARK}` },
  coHeaderRow: { flexDirection: "row", backgroundColor: NAVY },
  coHeaderCell: { flex: 1, padding: "5pt 8pt", color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", borderRight: `1pt solid ${DARK}` },
  coHeaderCellLast: { flex: 1, padding: "5pt 8pt", color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center" },
  coValueRow: { flexDirection: "row" },
  coValueCell: { flex: 1, padding: "6pt 8pt", textAlign: "center", borderRight: `1pt solid ${DARK}`, fontSize: 11, fontFamily: "Helvetica-Bold" },
  coValueCellLast: { flex: 1, padding: "6pt 8pt", textAlign: "center", fontSize: 11, fontFamily: "Helvetica-Bold" },

  // Headline strip (Subject / Status / Time Delay)
  headlineWrap: { alignItems: "flex-end", marginBottom: 12 },
  headlineLine: { fontSize: 9.5, color: MID, marginBottom: 1 },
  headlineLabel: { fontFamily: "Helvetica-Bold", color: DARK },

  // Customer/Project two-up
  twoUp: { flexDirection: "row", gap: 0, marginBottom: 12 },
  blockBox: { flex: 1, border: `1pt solid ${DARK}` },
  blockBoxRight: { flex: 1, border: `1pt solid ${DARK}`, borderLeft: "none" },
  blockHeader: { backgroundColor: NAVY, padding: "4pt 8pt", color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  blockBody: { padding: "8pt 10pt", minHeight: 70 },
  blockLine: { fontSize: 9.5, marginBottom: 1.5 },
  blockNameLine: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 1.5 },

  // Description block (full width)
  descBlock: { border: `1pt solid ${DARK}`, marginBottom: 12 },

  // Items table
  itemsBox: { border: `1pt solid ${DARK}`, marginBottom: 12 },
  itemsHeadRow: { flexDirection: "row", backgroundColor: LIGHT, borderBottom: `1pt solid ${DARK}` },
  itemsHeadCell: { flex: 1, padding: "5pt 10pt", fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  itemsHeadCellRight: { width: 90, padding: "5pt 10pt", fontSize: 9.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
  itemRow: { flexDirection: "row", borderBottom: `1pt solid #e5e7eb`, alignItems: "flex-start" },
  itemRowLast: { flexDirection: "row", alignItems: "flex-start" },
  itemNameCell: { flex: 1, padding: "8pt 10pt" },
  itemTotalCell: { width: 90, padding: "8pt 10pt", textAlign: "right", fontSize: 10 },
  itemName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  itemDesc: { fontSize: 8.5, color: MUTED, marginLeft: 8, marginBottom: 1, fontStyle: "italic" },

  // Total row outside the box (right-aligned)
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", marginRight: 26 },
  totalAmount: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, minWidth: 90, textAlign: "right" },

  // Footer (page 1 bottom)
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, textAlign: "center", borderTop: `1pt solid ${BORDER}`, paddingTop: 6 },
  footerText: { fontSize: 8, color: MUTED, marginBottom: 1 },
  pageNum: { fontSize: 8, color: MUTED, position: "absolute", bottom: 8, left: 32 },

  // Page 2 — Approval
  approvalBox: { border: `1pt solid ${DARK}`, marginBottom: 14 },
  approvalBody: { padding: "12pt 14pt" },
  approvalText: { fontSize: 10, marginBottom: 10 },
  sigRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  sigLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", marginRight: 8 },
  sigImg: { height: 50, width: 220, objectFit: "contain" },
  sigLine: { borderBottom: `1pt solid ${DARK}`, width: 220, height: 24 },

  // Files / attachments
  filesBox: { border: `1pt solid ${DARK}` },
  filesGrid: { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 14 },
  fileTile: { width: 100, alignItems: "center" },
  fileIconBox: { width: 64, height: 80, borderRadius: 4, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  fileIconText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#fff" },
  fileName: { fontSize: 8, color: DARK, textAlign: "center" },
  fileLink: { fontSize: 8, color: NAVY, textDecoration: "underline", marginTop: 1, textAlign: "center" },
});

function fileIconColor(mime?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "#dc2626"; // red
  if (m.startsWith("image/")) return "#0ea5e9"; // sky
  if (m.includes("word") || m.includes("doc")) return "#2563eb"; // blue
  if (m.includes("sheet") || m.includes("excel")) return "#16a34a"; // green
  return MUTED;
}

function fileIconLabel(mime?: string | null, name?: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.startsWith("image/")) return "IMG";
  if (m.includes("word") || m.includes("doc")) return "DOC";
  if (m.includes("sheet") || m.includes("excel")) return "XLS";
  const ext = (name ?? "").split(".").pop()?.toUpperCase();
  return ext && ext.length <= 4 ? ext : "FILE";
}

function itemSale(it: ChangeOrderPdfItem): number {
  const m = (it.markupPct ?? 0) / 100;
  return it.qty * it.unitCost * (1 + m);
}

export async function renderChangeOrderPdfBuffer(input: ChangeOrderPdfInput): Promise<Buffer> {
  const total = input.items.reduce((s, it) => s + itemSale(it), 0);
  const co = input.orderNumber ?? "—";
  const date = fmtDate(input.createdAt);
  const hasSig = !!input.signatureData || !!input.signedAt;
  const hasFiles = (input.attachments?.length ?? 0) > 0;
  const showSecondPage = hasSig || hasFiles;

  const TopHeader = () => (
    <>
      <View style={S.topRow}>
        <View>
          {input.company.logoSrc
            ? <Image src={input.company.logoSrc} style={S.logo} />
            : <Text style={S.logoFallback}>{input.company.name}</Text>}
        </View>
        <View style={S.coTable}>
          <View style={S.coHeaderRow}>
            <Text style={S.coHeaderCell}>CO #</Text>
            <Text style={S.coHeaderCellLast}>DATE</Text>
          </View>
          <View style={S.coValueRow}>
            <Text style={S.coValueCell}>{co}</Text>
            <Text style={S.coValueCellLast}>{date}</Text>
          </View>
        </View>
      </View>
    </>
  );

  const status = (input.status ?? "").replace(/_/g, " ");
  const statusLabel = status.length > 0
    ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    : null;

  return await renderToBuffer(
    <Document>
      {/* ── Page 1 ─────────────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={S.page}>
        <TopHeader />

        {/* Subject / Status (right-aligned headline) */}
        <View style={S.headlineWrap}>
          <Text style={S.headlineLine}>
            <Text style={S.headlineLabel}>Subject: </Text>{input.title}
          </Text>
          {statusLabel && (
            <Text style={S.headlineLine}>
              <Text style={S.headlineLabel}>Status: </Text>{statusLabel}
            </Text>
          )}
        </View>

        {/* Customer / Project two-up */}
        <View style={S.twoUp}>
          <View style={S.blockBox}>
            <Text style={S.blockHeader}>CUSTOMER</Text>
            <View style={S.blockBody}>
              {input.client ? (
                <>
                  {input.client.projectName && (
                    <Text style={S.blockNameLine}>{input.client.projectName}</Text>
                  )}
                  <Text style={S.blockLine}>{input.client.name}</Text>
                  {input.client.address && <Text style={S.blockLine}>{input.client.address}</Text>}
                  {(input.client.city || input.client.state || input.client.zip) && (
                    <Text style={S.blockLine}>
                      {[input.client.city, input.client.state].filter(Boolean).join(", ")}
                      {input.client.zip ? ` ${input.client.zip}` : ""}
                    </Text>
                  )}
                </>
              ) : <Text style={S.blockLine}>—</Text>}
            </View>
          </View>
          <View style={S.blockBoxRight}>
            <Text style={S.blockHeader}>PROJECT</Text>
            <View style={S.blockBody}>
              {input.client?.projectName && <Text style={S.blockNameLine}>{input.client.projectName}</Text>}
              {input.client?.projectAddress
                ? <Text style={S.blockLine}>{input.client.projectAddress}</Text>
                : input.client?.address
                  ? <>
                      <Text style={S.blockLine}>{input.client.address}</Text>
                      {(input.client.city || input.client.state || input.client.zip) && (
                        <Text style={S.blockLine}>
                          {[input.client.city, input.client.state].filter(Boolean).join(", ")}
                          {input.client.zip ? ` ${input.client.zip}` : ""}
                        </Text>
                      )}
                    </>
                  : <Text style={S.blockLine}>—</Text>}
            </View>
          </View>
        </View>

        {/* Description block */}
        <View style={S.descBlock}>
          <Text style={S.blockHeader}>DESCRIPTION</Text>
          <View style={{ padding: "8pt 10pt" }}>
            <Text style={S.blockLine}>{input.notes?.trim() ? input.notes : "—"}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={S.itemsBox}>
          <View style={S.itemsHeadRow}>
            <Text style={S.itemsHeadCell}>Item</Text>
            <Text style={S.itemsHeadCellRight}>Total</Text>
          </View>
          {input.items.length === 0 ? (
            <View style={S.itemRowLast}>
              <Text style={[S.itemNameCell, { color: MUTED, fontStyle: "italic" }]}>No items.</Text>
              <Text style={S.itemTotalCell}>$0.00</Text>
            </View>
          ) : (
            input.items.map((it, idx) => {
              const isLast = idx === input.items.length - 1;
              return (
                <View key={idx} style={isLast ? S.itemRowLast : S.itemRow}>
                  <View style={S.itemNameCell}>
                    <Text style={S.itemName}>{it.name || "Item"}</Text>
                    {it.description && it.description.trim().length > 0 && (
                      <Text style={S.itemDesc}>{it.description}</Text>
                    )}
                  </View>
                  <Text style={S.itemTotalCell}>${fmt(itemSale(it))}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Total row */}
        <View style={S.totalRow}>
          <Text style={S.totalLabel}>Total</Text>
          <Text style={S.totalAmount}>${fmt(total)}</Text>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {input.company.name}
            {input.company.phone ? ` · Phone: ${input.company.phone}` : ""}
            {input.company.email ? ` · ${input.company.email}` : ""}
          </Text>
          {(input.company.address || input.company.licenses || input.company.website) && (
            <Text style={S.footerText}>
              {input.company.address ?? ""}
              {input.company.licenses ? `${input.company.address ? " · " : ""}License ${input.company.licenses}` : ""}
              {input.company.website ? `${(input.company.address || input.company.licenses) ? " · " : ""}${input.company.website}` : ""}
            </Text>
          )}
        </View>
        <Text style={S.pageNum} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
      </Page>

      {/* ── Page 2 — Approval + Attachments ───────────────────────────────────── */}
      {showSecondPage && (
        <Page size="LETTER" style={S.page}>
          <TopHeader />

          {hasSig && (
            <View style={S.approvalBox}>
              <Text style={S.blockHeader}>APPROVAL</Text>
              <View style={S.approvalBody}>
                <Text style={S.approvalText}>
                  This Change Order has been accepted
                  {input.signedAt ? ` on ${fmtDate(input.signedAt)}` : ""}
                  {input.signedByName ? ` by ${input.signedByName}` : ""}
                  {input.client?.name && !input.signedByName ? ` by ${input.client.name}` : ""}.
                </Text>
                <View style={S.sigRow}>
                  <Text style={S.sigLabel}>Signature:</Text>
                  {input.signatureData
                    ? <Image src={input.signatureData} style={S.sigImg} />
                    : <View style={S.sigLine} />}
                </View>
              </View>
            </View>
          )}

          {hasFiles && (
            <View style={S.filesBox}>
              <Text style={S.blockHeader}>ATTACHMENTS</Text>
              <View style={S.filesGrid}>
                {input.attachments.map((a, idx) => {
                  const iconColor = fileIconColor(a.mimeType);
                  const label = fileIconLabel(a.mimeType, a.name);
                  return (
                    <Link key={idx} src={a.url} style={S.fileTile}>
                      <View style={[S.fileIconBox, { backgroundColor: iconColor }]}>
                        <Text style={S.fileIconText}>{label}</Text>
                      </View>
                      <Text style={S.fileName}>{a.name}</Text>
                      <Text style={S.fileLink}>Open</Text>
                    </Link>
                  );
                })}
              </View>
            </View>
          )}

          <View style={S.footer} fixed>
            <Text style={S.footerText}>
              {input.company.name}
              {input.company.phone ? ` · Phone: ${input.company.phone}` : ""}
              {input.company.email ? ` · ${input.company.email}` : ""}
            </Text>
          </View>
          <Text style={S.pageNum} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
        </Page>
      )}
    </Document>
  );
}
