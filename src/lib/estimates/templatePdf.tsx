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
  page: { fontFamily: "Helvetica", fontSize: 9, paddingTop: 36, paddingBottom: 74, paddingHorizontal: 40 },
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
  colLineNum: { width: 18, textAlign: "right", paddingRight: 4 },
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
  termsText: { fontSize: 8.5, color: "#475569", lineHeight: 1.6 },

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
  client: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone?: string | null; email?: string | null } | null;
  divisions: Division[];
  showTerms?: boolean;
  termsContent?: string | null;
  paymentSchedule?: PaymentRow[] | null;
  gcFeePercent?: number | null;
  summaryGroups?: Record<string, SummaryGroupOverride> | null;
  clientSignatureData?: string | null;
  clientSignedByName?: string | null;
  clientSignedAt?: Date | null;
  contractorSignatureData?: string | null;
  contractorSignedAt?: Date | null;
  includeRoofUpgradesPage?: boolean;
  includeCoverPage?: boolean;
  includeAdditionPages?: boolean;
  insulationType?: string | null;
};

function ItemTableHeader({ showLineNum }: { showLineNum?: boolean }) {
  return (
    <View style={styles.tableHeader}>
      {showLineNum && <Text style={[styles.headerText, styles.colLineNum]}>#</Text>}
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colDetail]}>Detail</Text>
      <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
    </View>
  );
}

function ItemRow({ item, index, lineNum }: { item: Item; index: number; lineNum?: number }) {
  const isExcluded = item.detail === "Excluded";
  const total = calcTotal(item.defaultQty, item.defaultUnitCost, item.defaultMarkupPct);
  const rowStyle = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  const detailColor = isExcluded ? "#dc2626" : item.detail === "Allowances" ? "#d97706" : "#334155";
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: index % 2 === 0 ? undefined : "#fafafa" }}>
      <View style={[rowStyle, { borderBottomWidth: 0 }]}>
        {lineNum != null && <Text style={[styles.cellMuted, styles.colLineNum]}>{lineNum}</Text>}
        <View style={styles.colName}>
          {(item.name ?? "").split(/\n| (?=[A-C]\. [A-Z])/).map((part, pi) => (
            <Text key={pi} style={[styles.cellText, pi > 0 ? { marginTop: 3 } : {}]}>{part}</Text>
          ))}
        </View>
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

// ─── Presentation Cover Page (single page) ────────────────────────────────────
function CoverPages({ template, client }: Pick<TemplatePdfProps, "template" | "client">) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const templateNameLower = template.name?.toLowerCase() ?? "";
  const isKitchenLaundry = templateNameLower.includes("kitchen") || templateNameLower.includes("laundry");
  const photosPath = path.join(process.cwd(), "public", isKitchenLaundry ? "laundry-cover.jpg" : "flat-roofs-cover.jpg");
  const GOLD = "#C9A84C";
  const DARK = "#1e293b";

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 52, height: 52 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>MIBH CONSTRUCTION</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  CGC1527069  |  CCC1336817  |  2950 N 28 Terr, Hollywood, FL  |  (305) 746-7307</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Photo collage — equal padding on all 4 sides */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={photosPath} style={{ width: 576, height: 270, objectFit: "cover" }} />
      </View>

      {/* Gold info rectangle */}
      <View style={{ flexDirection: "row", backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 22 }}>
        {/* Left: client name prominent, address below */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {client?.name ? <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 6 }}>{client.name}</Text> : null}
          {client?.address ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.address}</Text> : null}
          {clientCity ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{clientCity}</Text> : null}
          {client?.phone ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.phone}</Text> : null}
          {client?.email ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>{client.email}</Text> : null}
        </View>
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 2, marginHorizontal: 24 }} />
        {/* Right: estimate name + date — flex:1 prevents word hyphenation */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {template.name ? (
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 8, lineHeight: 1.25 }}>{template.name}</Text>
          ) : null}
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* 20 Years of Excellence section — flex:1 fills remaining page */}
      <View style={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 14, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1.5 }}>20 YEARS OF EXCELLENCE</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Why Choose Us</Text>
        {[
          "Over 20 years of delivering the highest quality workmanship",
          "Multilingual service: English, Spanish, Portuguese, French, and Creole",
          "Locally owned and operated company",
          "Team of highly skilled and experienced professionals",
          "Specialized expertise in Florida climate conditions: hurricanes, sun exposure, and wind resistance",
          "Customized solutions with honest, transparent recommendations",
          "Proven track record in high-end and custom home construction",
          "Industry-recognized and award-winning performance",
          "Strong, long-term relationships with trusted manufacturers and suppliers",
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 7, gap: 8 }}>
            <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
            <Text style={{ fontSize: 10, color: "#334155", flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>MIBH CONSTRUCTION</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>mike@mibhconstruction.com</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>Mike Baruh</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>(305) 746-7307</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

// Apply insulation type filter to item name:
// "ISO"     → keep Option A, strip " B. ..." suffix
// "Tapered" → strip " A. ..." up to " B. ", keep from "B." onward
// "None"    → return null (item should be hidden)
function applyInsulationFilter(name: string, insulationType: string | null | undefined): string | null {
  const lower = name.toLowerCase();
  // Detect insulation option items: must contain "insulation" or "select one system"
  // AND have a "B. " section (the second option marker)
  const bIdx = name.search(/[ \n]B\. /);
  const isInsulationItem = bIdx >= 0 && (lower.includes("insulation") || lower.includes("select one system"));
  if (!isInsulationItem) return name;
  const type = (insulationType ?? "ISO").toLowerCase();
  if (type === "none") return null;
  const aIdx = name.search(/[ \n]A\. /);
  if (type === "iso") {
    // Keep everything up to (but not including) the separator before "B. ..."
    return name.slice(0, bIdx).trimEnd();
  }
  if (type === "tapered") {
    // Keep from "B." onward, prepend the intro text before "A."
    const intro = aIdx >= 0 ? name.slice(0, aIdx).trimEnd() : "";
    const bPart = name.slice(bIdx + 1); // skip the leading space/newline
    return intro ? `${intro} ${bPart}` : bPart;
  }
  return name;
}

// ─── Addition Marketing Page (Page 1) ─────────────────────────────────────────
function AdditionPage1({ template, client }: Pick<TemplatePdfProps, "template" | "client">) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const additionsImgPath = path.join(process.cwd(), "public", "additions.jpg");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 52, height: 52 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>MIBH CONSTRUCTION</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  CGC1527069  |  CCC1336817  |  2950 N 28 Terr, Hollywood, FL  |  (305) 746-7307</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Photo collage — equal padding on all 4 sides */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={additionsImgPath} style={{ width: 576, height: 270, objectFit: "cover" }} />
      </View>

      {/* Gold info rectangle */}
      <View style={{ flexDirection: "row", backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 22 }}>
        {/* Left: client info — name prominent at top */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {client?.name ? <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 6 }}>{client.name}</Text> : null}
          {client?.address ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.address}</Text> : null}
          {clientCity ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{clientCity}</Text> : null}
          {client?.phone ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.phone}</Text> : null}
          {client?.email ? <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>{client.email}</Text> : null}
        </View>
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 2, marginHorizontal: 24 }} />
        {/* Right: estimate name + date — flex:1 prevents word hyphenation */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {template.name ? (
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 8, lineHeight: 1.25 }}>{template.name}</Text>
          ) : null}
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* 20 Years + WHY CHOOSE */}
      <View style={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 14, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1.5 }}>20 YEARS OF EXCELLENCE</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Why Choose Us</Text>
        {[
          "Over 20 years of delivering high-quality workmanship across South Florida",
          "Licensed & insured (CGC1527069 | CCC1336817) and fully compliant with Florida Building Code (FBC 2023)",
          "Specialized expertise in additions, structural modifications, and custom home construction",
          "Turnkey service: design, engineering, permitting, and construction handled in-house",
          "Dedicated project manager from start to completion for clear communication and accountability",
          "Highly skilled, experienced team delivering consistent, professional results",
          "Built for Florida conditions: hurricanes, sun exposure, moisture, and high-wind resistance",
          "Customized solutions with honest, transparent recommendations tailored to each project",
          "Proven track record in both residential and high-end custom homes",
          "Strong, long-term relationships with trusted suppliers and manufacturers ensuring quality materials",
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
            <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
            <Text style={{ fontSize: 10, color: "#334155", flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>MIBH CONSTRUCTION</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>mike@mibhconstruction.com</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>Mike Baruh</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>(305) 746-7307</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

// ─── Addition Scope of Work Page (Page 2) ─────────────────────────────────────
function AdditionPage2({ client }: Pick<TemplatePdfProps, "client">) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const SECTIONS: { title: string; items: string[] }[] = [
    {
      title: "1. PERMITTING & PRE-CONSTRUCTION",
      items: [
        "Preparation of architectural and engineering plans",
        "Structural calculations and documentation",
        "Notice of Commencement",
        "Submission to city/building department",
        "Coordination of revisions and approvals",
        "Permit tracking through final approval",
      ],
    },
    {
      title: "2. MANPOWER PROVIDED",
      items: [
        "Licensed General Contractor supervision",
        "Project Manager (dedicated to your job)",
        "Skilled trade crews (carpentry, concrete, electrical, plumbing, HVAC)",
        "OSHA-compliant workforce",
        "Site cleanup and protection crew",
      ],
    },
    {
      title: "3. EQUIPMENT PROVIDED",
      items: [
        "Excavation and grading equipment",
        "Concrete and forming systems",
        "Framing tools and machinery",
        "Ladders, scaffolding, lifts (as required)",
        "Safety equipment and fall protection systems",
        "Dumpsters and debris removal equipment",
      ],
    },
    {
      title: "4. MATERIALS & CONSTRUCTION STANDARDS",
      items: [
        "Florida Building Code (FBC 2023)",
        "Structural engineering specifications",
        "Miami-Dade product approvals (NOA where applicable)",
        "Manufacturer installation standards",
        "South Florida wind-load and moisture requirements",
      ],
    },
    {
      title: "5. SITE PROTECTION & JOB CONDITIONS",
      items: [
        "Protection of existing structure and finishes",
        "Dust and debris control",
        "Daily site cleanup",
        "Safe jobsite organization",
        "Protection of landscaping and adjacent areas",
        "Final cleaning upon completion",
      ],
    },
    {
      title: "6. PROJECT CLOSEOUT",
      items: [
        "Final inspections and approvals",
        "Completion walkthrough with client",
        "Punch list completion",
        "Delivery of warranties (where applicable)",
        "Final site cleanup",
      ],
    },
  ];
  const WHAT_ITEMS = [
    "Room Additions",
    "Second Story Additions",
    "Master Suite Expansions",
    "Garage Conversions & Additions",
    "Kitchen & Living Space Expansions",
    "Structural Modifications & Open Layouts",
  ];
  const clientName = client?.name ?? "";
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 74 }}>
      {/* Footer pinned to bottom */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>MIBH CONSTRUCTION</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>mike@mibhconstruction.com</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>Mike Baruh</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>(305) 746-7307</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 52, height: 52 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>MIBH CONSTRUCTION</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  CGC1527069  |  CCC1336817  |  2950 N 28 Terr, Hollywood, FL  |  (305) 746-7307</Text>
        </View>
        {clientName ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{clientName}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Main content */}
      <View style={{ paddingHorizontal: 28, paddingTop: 16, paddingBottom: 16 }}>

        {/* WHAT WE BUILD + OUR APPROACH side by side */}
        <View style={{ flexDirection: "row", gap: 20, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 10 }}>WHAT WE BUILD</Text>
            {WHAT_ITEMS.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                <Text style={{ fontSize: 11, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                <Text style={{ fontSize: 11, color: "#334155", flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: 2, backgroundColor: GOLD, marginVertical: 2 }} />
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 10 }}>OUR APPROACH</Text>
            <Text style={{ fontSize: 11, color: "#334155", lineHeight: 1.55 }}>
              We handle your project from concept to completion — including planning, engineering, permitting, and construction — ensuring a seamless process with one accountable team. You get a single point of contact, no subcontractor confusion, and full transparency from day one.
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 14 }} />

        {/* Scope of Work title */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1 }}>SCOPE OF WORK</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
        </View>

        {/* Intro */}
        <Text style={{ fontSize: 10, color: "#334155", lineHeight: 1.5, marginBottom: 14 }}>
          We appreciate the opportunity to provide this proposal. MIBH Construction will deliver all labor, materials, equipment, and supervision required to complete your addition in full compliance with Florida Building Code (FBC 2023), local municipal requirements, and approved engineering plans.
        </Text>

        {/* Two-column sections */}
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(0, 3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 5, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 7 }}>
                    <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 10, color: "#475569", flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 5, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 7 }}>
                    <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 10, color: "#475569", flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

    </Page>
  );
}

function TemplatePdfDocument({ companyName, template, client, divisions, showTerms, termsContent, paymentSchedule, gcFeePercent, summaryGroups, clientSignatureData, clientSignedByName, clientSignedAt, contractorSignatureData, contractorSignedAt, includeRoofUpgradesPage, includeCoverPage, includeAdditionPages, insulationType }: TemplatePdfProps) {
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

  const hasAllowances = divisions.some(div =>
    div.items.some(i => i.detail === "Allowances") ||
    div.groups.some(g => g.items.some(i => i.detail === "Allowances"))
  );
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
  const roofUpgradesPath = path.join(process.cwd(), "public", "roof-upgrades-page.png");
  const isRoof = !!includeRoofUpgradesPage;

  // Pre-compute sequential line numbers for all visible items (roof estimates only)
  const lineNumMap = new Map<string, number>();
  if (isRoof) {
    const applyInsFilter = (item: Item) => {
      const filtered = applyInsulationFilter(item.name, insulationType);
      if (filtered === null) return null;
      return filtered === item.name ? item : { ...item, name: filtered };
    };
    let counter = 1;
    for (const { divs } of grouped) {
      for (const div of divs) {
        const filledItems = div.items.map(applyInsFilter).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail));
        const filledGroups = div.groups
          .map(g => ({ ...g, items: g.items.map(applyInsFilter).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)) }))
          .filter(g => g.items.length > 0);
        if (filledItems.length === 0 && filledGroups.length === 0) continue;
        for (const grp of filledGroups) {
          for (const item of grp.items) { lineNumMap.set(item.id, counter++); }
        }
        for (const item of filledItems) { lineNumMap.set(item.id, counter++); }
      }
    }
  }

  const ROOF_INTRO_PARAS = [
    "We appreciate your consideration and look forward to delivering the high-quality workmanship and customer service MIBH Construction is known for in South Florida. This proposal outlines the manpower, materials, equipment, and installation standards required to complete your roofing project in full compliance with Florida Building Code (FBC 2023), Miami-Dade standards, and manufacturer specifications.",
    "1. MIBH Construction will handle the full permit application process by preparing all required documents, including permit forms, Notice of Commencement (if needed), product approvals/Miami-Dade NOAs, roof plans, scope of work, and all contractor credentials. Once the permit package is complete, we will submit it to the appropriate Building Department, pay or coordinate permitting fees, respond to any city comments or requested revisions, and track the application until full approval is issued.",
    "2. Manpower Provided — MIBH Construction will supply: Certified roofing technicians · Project manager/supervisor · Safety-compliant crew (OSHA trained) · Cleanup team for daily and final site maintenance. Our team is experienced in commercial and residential roofing systems, including shingle, tile, metal, TPO, hot mop, and modified bitumen.",
    "3. Equipment Provided — We will provide all required equipment, including: Tear-off machinery & power tools · Dump trailer or roll-off dumpster · Ladders, lifts, scaffolding (as needed) · Full safety gear and fall protection systems. All equipment is maintained to ensure safe, efficient operations.",
    "4. Materials & Installation Standards — MIBH Construction uses only approved, high-quality roofing materials installed following: FBC 2023 and local code requirements · Miami-Dade NOA specifications · Manufacturer-approved installation practices · South Florida high-wind performance requirements. This ensures durability, waterproofing integrity, and warranty eligibility.",
    "5. Tarps and coverings for landscaping & AC units. Clear job-site organization and debris control. OSHA fall-protection procedures. Daily cleanup and end-of-project magnetic sweep.",
    "6. Remove all debris and materials. Conduct a full walkthrough. Prepare for city/county inspections. Provide warranty documentation as applicable.",
    "We appreciate your consideration and look forward to working with you. Please reach out with any questions or adjustments you would like added to this proposal.",
  ];

  const paymentTermsSignatureBlock = (
    <>
      {/* Payment Schedule */}
      {(paymentSchedule ?? []).length > 0 && (
        <View style={{ marginTop: 16 }} break>
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
        </View>
      )}
      {/* T&C */}
      {(showTerms || !!termsContent) && (
        <View minPresenceAhead={80}>
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>
          {termsContent
            ? termsContent.split(/\r?\n\r?\n|\r?\n(?=\d+[\.\)]?\s)/).filter(Boolean).map((para, i) => (
                <Text key={i} style={[styles.termsText, { marginBottom: 10 }]}>{para.trim()}</Text>
              ))
            : null}
        </View>
      )}
      {/* Signature Block */}
      <View style={[styles.sigSection, { marginTop: 14 }]} minPresenceAhead={220}>
        <View style={[styles.sectionDivider, { marginTop: 10 }]} />
        <Text style={[styles.sectionTitle, { marginBottom: 4, paddingTop: 6 }]}>Agreement &amp; Authorization</Text>
        <Text style={{ fontSize: 8, color: "#475569", marginBottom: 4 }}>
          By signing below, both parties agree to the scope of work, pricing, and terms described in this document.
        </Text>
        <View style={[styles.sigRow, { marginTop: 12 }]}>
          {/* Customer */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigPartyLabel}>Customer</Text>
            {clientSignatureData
              // eslint-disable-next-line jsx-a11y/alt-text
              ? <Image src={clientSignatureData} style={{ height: 40, marginBottom: 3, objectFit: "contain", objectPositionX: 0 }} />
              : <View style={[styles.sigLine, { marginBottom: 3, height: 40 }]} />}
            <Text style={styles.sigLineLabel}>Signature</Text>
            <View style={{ height: 6 }} />
            <View style={styles.sigLine} />
            {clientSignedByName
              ? <Text style={styles.sigPrefilled}>{clientSignedByName}</Text>
              : <View style={{ height: 10 }} />}
            <Text style={styles.sigLineLabel}>Name (Print)</Text>
            <View style={{ height: 6 }} />
            <View style={styles.sigLine} />
            {clientSignedAt
              ? <Text style={styles.sigPrefilled}>{clientSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
              : <View style={{ height: 10 }} />}
            <Text style={styles.sigLineLabel}>Date</Text>
          </View>
          {/* Contractor */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigPartyLabel}>Contractor</Text>
            {contractorSignatureData
              // eslint-disable-next-line jsx-a11y/alt-text
              ? <Image src={contractorSignatureData} style={{ height: 40, marginBottom: 3, objectFit: "contain", objectPositionX: 0 }} />
              : <View style={[styles.sigLine, { marginBottom: 3, height: 40 }]} />}
            <Text style={styles.sigLineLabel}>Signature</Text>
            <View style={{ height: 6 }} />
            <View style={styles.sigLine} />
            <Text style={styles.sigPrefilled}>Mike Baruh</Text>
            <Text style={styles.sigLineLabel}>Name (Print)</Text>
            <View style={{ height: 6 }} />
            <View style={styles.sigLine} />
            {contractorSignedAt
              ? <Text style={styles.sigPrefilled}>{contractorSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
              : <View style={{ height: 10 }} />}
            <Text style={styles.sigLineLabel}>Date</Text>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <Document title={`${template.name} — Estimate`} author={companyName}>
      {includeCoverPage && !includeAdditionPages && <CoverPages template={template} client={client} />}
      {includeAdditionPages && <AdditionPage1 template={template} client={client} />}
      {includeAdditionPages && <AdditionPage2 client={client} />}
      <Page size="LETTER" style={styles.page}>
        {/* Fixed footer — renders on every page */}
        <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>MIBH CONSTRUCTION</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>mike@mibhconstruction.com</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>Mike Baruh</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>(305) 746-7307</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

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
            <Text style={styles.centerBold}>Scope of Work:</Text>
            <Text style={styles.centerBold}>{template.name}</Text>
            {dateDisplay ? <Text style={styles.centerBold}>{dateDisplay}</Text> : null}
            <Text style={styles.centerBold}>{template.estimateNumber ? `Estimate #${template.estimateNumber}` : "ESTIMATE"}</Text>
          </View>

          {/* Right: Client — marginTop aligns with address text (below 90px logo + gap) */}
          <View style={{ marginTop: 96 }}>
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

        {/* Roof intro text — page 1, before divisions */}
        {isRoof && (
          <View style={{ marginBottom: 10, paddingVertical: 4 }}>
            {ROOF_INTRO_PARAS.map((para, i) => (
              <Text key={i} style={{ fontSize: 10.5, color: "#334155", lineHeight: 1.65, marginBottom: i < ROOF_INTRO_PARAS.length - 1 ? 8 : 0 }}>{para}</Text>
            ))}
          </View>
        )}

        {/* Divisions — grouped into super-sections (e.g. SHELL) */}
        {grouped.map(({ groupLabel, divs }, gi) => {
          // Pre-filter each division's items (apply insulation type filter)
          const applyInsF = (item: Item) => {
            const filtered = applyInsulationFilter(item.name, insulationType);
            if (filtered === null) return null;
            return filtered === item.name ? item : { ...item, name: filtered };
          };
          const filteredDivs = divs.map(div => ({
            div,
            filledItems: div.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)),
            filledGroups: div.groups.map(g => ({ ...g, items: g.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)) })).filter(g => g.items.length > 0),
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
                  <View key={div.id} minPresenceAhead={320} break={div.name.toLowerCase().includes("roofing system")}>
                    <View style={[styles.divisionHeader, groupLabel ? { marginTop: 6 } : {}]}>
                      <View style={styles.divisionLeft}>
                        {!isRoof && div.csiCode ? <Text style={styles.divisionCsi}>{div.csiCode}</Text> : null}
                        <Text style={styles.divisionName}>{div.name}</Text>
                      </View>
                      {!groupLabel && <Text style={styles.divisionTotal}>${fmt(divTotal)}</Text>}
                    </View>

                    {filledGroups.map((grp) => {
                      return (
                        <View key={grp.id} minPresenceAhead={60}>
                          <ItemTableHeader showLineNum={isRoof} />
                          {grp.items.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} lineNum={lineNumMap.get(item.id)} />)}
                        </View>
                      );
                    })}

                    {filledItems.length > 0 && (
                      <View>
                        <ItemTableHeader showLineNum={isRoof} />
                        {filledItems.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} lineNum={lineNumMap.get(item.id)} />)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Allowances total */}
        {hasAllowances && (
          <View style={[styles.grandTotalBar, { marginTop: 6, backgroundColor: "#2d2410" }]}>
            <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>TOTAL ALLOWANCES</Text>
            <Text style={[GRAND_TOTAL_VALUE_STYLE, { fontSize: 13 }]}>{allowancesTotal > 0 ? `$${fmt(allowancesTotal)}` : "TBD"}</Text>
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

        {/* Payment terms + signature: inline when no extra page */}
        {!includeRoofUpgradesPage && paymentTermsSignatureBlock}

      </Page>

      {/* Roof Upgrades extra page — full bleed image */}
      {includeRoofUpgradesPage && (
        <Page size="LETTER" style={{ padding: 0, margin: 0 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={roofUpgradesPath} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </Page>
      )}

      {/* Payment terms + signature: on their own page when extra page is present */}
      {includeRoofUpgradesPage && (
        <Page size="LETTER" style={[styles.page, { paddingTop: 14, paddingBottom: 74 }]}>
          {/* Fixed footer */}
          <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>MIBH CONSTRUCTION</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>mike@mibhconstruction.com</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>Mike Baruh</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>(305) 746-7307</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
          {paymentTermsSignatureBlock}
        </Page>
      )}
    </Document>
  );
}

export async function renderTemplatePdf(props: TemplatePdfProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(React.createElement(TemplatePdfDocument, props) as any);
  return Buffer.from(buf as unknown as Uint8Array);
}
