import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font } from "@react-pdf/renderer";
import React from "react";
import path from "path";

Font.registerHyphenationCallback((word) => [word]);

export type CompanyBranding = {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenses: string;
  tagline: string;
  website: string;
  contactName: string;
  logoSrc: string; // local file path or base64 data URL
};

const MIBH_DEFAULTS: CompanyBranding = {
  name: "MIBH Construction",
  address: "2950 N 28 Terr, Hollywood, FL 33020",
  phone: "(305) 746-7307",
  email: "mike@mibhconstruction.com",
  licenses: "CGC1527069 | CCC1336817",
  tagline: "20 YEARS OF EXCELLENCE",
  website: "mibhconstruction.com",
  contactName: "Mike Baruh",
  logoSrc: path.join(process.cwd(), "public", "logo.png"),
};

const PRECISION_DEFAULTS: CompanyBranding = {
  name: "Precision Construction",
  address: "TBD, Hollywood, FL",
  phone: "(954) 383-8382",
  email: "mike@mibhconstruction.com",
  licenses: "CGC1516546",
  tagline: "20 YEARS OF EXCELLENCE",
  website: "mibhconstruction.com",
  contactName: "Mike Baruh",
  logoSrc: path.join(process.cwd(), "public", "logo.png"),
};

function getBranding(partial?: Partial<CompanyBranding> | null): CompanyBranding {
  const base = partial?.name === "Precision Construction" ? PRECISION_DEFAULTS : MIBH_DEFAULTS;
  return {
    name: partial?.name || base.name,
    address: partial?.address || base.address,
    phone: partial?.phone || base.phone,
    email: partial?.email || base.email,
    licenses: partial?.licenses || base.licenses,
    tagline: partial?.tagline || base.tagline,
    website: partial?.website || base.website,
    contactName: partial?.contactName || base.contactName,
    logoSrc: partial?.logoSrc || base.logoSrc,
  };
}

// Module-level variable — safe because each Vercel invocation is isolated
// and react-pdf's render phase is synchronous within renderToBuffer.
let _activeBranding: CompanyBranding = MIBH_DEFAULTS;
const useBranding = () => _activeBranding;

let _progressPct: number | null = null;
let _progressPhase: string | null = null;
let _progressInvoiceNumber: string | null = null;
const useProgressPayment = () => ({ pct: _progressPct, phase: _progressPhase });

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
  page: { fontFamily: "Helvetica", fontSize: 9, paddingTop: 22, paddingBottom: 54, paddingHorizontal: 40 },
  header: { flexDirection: "column", marginBottom: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: GOLD },

  // Left column
  logo: { width: 152, height: 152, marginBottom: 4 },
  companyInfo: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 2 },

  // Center column
  centerSection: { alignSelf: "stretch", alignItems: "center", paddingBottom: 2 },
  centerBold: { fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "center", marginBottom: 4 },

  // Right column
  clientName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3, textAlign: "right" },

  // Division header row — text/total both white
  divisionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, borderRadius: 3 },
  divisionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  divisionCsi: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  divisionTotal: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  groupHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  groupName: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#475569", textTransform: "uppercase" },
  groupTotal: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#475569" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 1, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 1, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 1, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  colLineNum: { width: 18, textAlign: "right", paddingRight: 4 },
  colName: { flex: 3 },
  colDetail: { width: 60, textAlign: "center" },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 40, textAlign: "center" },
  colTotal: { width: 80, textAlign: "right" },
  headerText: { fontSize: 6.5, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cellText: { fontSize: 8.5, color: "#334155" },
  cellMuted: { fontSize: 8.5, color: "#94a3b8" },
  cellBold: { fontSize: 8.5, color: "#0f172a", fontFamily: "Helvetica-Bold" },

  grandTotalBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, borderRadius: 3 },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#C9A84C" },

  groupSuperHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 8, paddingVertical: 5, marginTop: 12, borderRadius: 3 },
  groupSuperLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  groupSuperTotal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  sectionDivider: { borderBottomWidth: 2, borderBottomColor: GOLD, marginTop: 20, marginBottom: 0 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 8, paddingTop: 12 },

  // T&C
  termsText: { fontSize: 9.5, color: "#475569", lineHeight: 1.5 },

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
  sigSection: { marginTop: 6 },
  sigRow: { flexDirection: "row", gap: 40, marginTop: 10 },
  sigBlock: { flex: 1 },
  sigPartyLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#475569", marginBottom: 3 },
  sigLineLabel: { fontSize: 7, color: "#94a3b8" },
  sigPrefilled: { fontSize: 9, color: DARK, fontFamily: "Helvetica-Bold", marginBottom: 3 },
});

// Defined outside StyleSheet.create to avoid any style inheritance/override issues
const GRAND_TOTAL_VALUE_STYLE = { fontSize: 13 as const, fontFamily: "Helvetica-Bold" as const, color: "#C9A84C" as const };

type Item = { id: string; name: string; detail: string | null; unit: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null; csiCode?: string | null };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; manualTotal?: number | null; groups: Group[]; items: Item[] };

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
  template: { name: string; description: string | null; estimateNumber: string | null; estimateDate: string | null; sqFt?: number | null; durationMonths?: number | null };
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
  includePermitPages?: boolean;
  includeRetailPages?: boolean;
  includeDivisionSummary?: boolean;
  insulationType?: string | null;
  clientCoverPhotoType?: string | null;
  clientCoverPhotoUrl?: string | null;
  clientCoverTitle?: string | null;
  insertPageOffset?: number;
  forcedBreakCsiPrefixes?: string[];
  forcedBreakTerms?: boolean;
  scopeOfWork?: { title: string; body: string } | null;
  branding?: Partial<CompanyBranding> | null;
  hideEstimateLabel?: boolean;
  changeOrderNotes?: string | null;
  progressPaymentPct?: number | null;
  progressPaymentPhase?: string | null;
  progressInvoiceNumber?: string | null;
};

function ItemTableHeader({ showLineNum }: { showLineNum?: boolean }) {
  const { pct } = useProgressPayment();
  return (
    <View style={styles.tableHeader}>
      {showLineNum && <Text style={[styles.headerText, styles.colLineNum]}>#</Text>}
      <Text style={[styles.headerText, styles.colName]}>Item</Text>
      <Text style={[styles.headerText, styles.colDetail]}>Detail</Text>
      <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
      <Text style={[styles.headerText, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
      {pct != null && <Text style={[styles.headerText, { width: 70, textAlign: "right", color: GOLD }]}>{pct}%</Text>}
    </View>
  );
}

function ItemRow({ item, index, lineNum }: { item: Item; index: number; lineNum?: number }) {
  const isExcluded = item.detail === "Excluded";
  const total = calcTotal(item.defaultQty, item.defaultUnitCost, item.defaultMarkupPct);
  const rowStyle = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
  const detailColor = isExcluded ? "#dc2626" : item.detail === "Allowances" ? "#d97706" : "#334155";
  const { pct } = useProgressPayment();
  const progressAmt = pct != null && total > 0 && !isExcluded ? total * pct / 100 : null;
  return (
    <View wrap={false} minPresenceAhead={25} style={{ borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: index % 2 === 0 ? undefined : "#fafafa" }}>
      <View style={[rowStyle, { borderBottomWidth: 0 }]}>
        {lineNum != null && <Text style={[styles.cellMuted, styles.colLineNum]}>{lineNum}</Text>}
        <View style={styles.colName}>
          <Text style={styles.cellText}>
            {item.csiCode ? <Text style={{ fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold" }}>{item.csiCode}{"  "}</Text> : null}
            {(item.name ?? "")}
          </Text>
        </View>
        <Text style={[{ fontSize: 7, color: detailColor, textAlign: "center" }, styles.colDetail]}>{item.detail?.toUpperCase() ?? ""}</Text>
        {isExcluded ? (
          <>
            <Text style={[styles.cellMuted, styles.colQty]}>—</Text>
            <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellMuted, styles.colTotal]}>$0.00</Text>
            {pct != null && <Text style={[styles.cellMuted, { width: 70, textAlign: "right" }]}>—</Text>}
          </>
        ) : (
          <>
            <Text style={[styles.cellMuted, styles.colQty]}>{item.defaultQty ?? "—"}</Text>
            <Text style={[styles.cellMuted, styles.colUnit]}>{item.unit ?? ""}</Text>
            <Text style={[styles.cellBold, styles.colTotal]}>{total > 0 ? `$${fmt(total)}` : "—"}</Text>
            {pct != null && <Text style={[styles.cellBold, { width: 70, textAlign: "right", color: GOLD }]}>{progressAmt ? `$${fmt(progressAmt)}` : "—"}</Text>}
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
function CoverPages({ template, client, clientCoverPhotoType, clientCoverPhotoUrl, clientCoverTitle }: Pick<TemplatePdfProps, "template" | "client" | "clientCoverPhotoType" | "clientCoverPhotoUrl" | "clientCoverTitle">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, tagline: companyTagline, contactName: companyContactName } = useBranding();
  const templateNameLower = template.name?.toLowerCase() ?? "";
  const isKitchenLaundry = templateNameLower.includes("kitchen") || templateNameLower.includes("laundry");

  // Client cover photo takes priority; fall back to template-based defaults
  let photoSrc: string;
  if (clientCoverPhotoType === "CUSTOM" && clientCoverPhotoUrl) {
    photoSrc = clientCoverPhotoUrl; // public URL — react-pdf can fetch directly
  } else if (clientCoverPhotoType === "ADDITIONS" || clientCoverPhotoType === "COMMERCIAL") {
    photoSrc = path.join(process.cwd(), "public", "additions.jpg");
  } else if (clientCoverPhotoType === "FLAT_ROOFS" || clientCoverPhotoType === "RESIDENTIAL") {
    photoSrc = path.join(process.cwd(), "public", "flat-roofs-cover.jpg");
  } else if (clientCoverPhotoType === "LAUNDRY") {
    photoSrc = path.join(process.cwd(), "public", "laundry-cover.png");
  } else if (clientCoverPhotoType === "SHINGLE_ROOFS") {
    photoSrc = path.join(process.cwd(), "public", "shingle-roofs-cover.png");
  } else {
    photoSrc = path.join(process.cwd(), "public", isKitchenLaundry ? "laundry-cover.png" : "flat-roofs-cover.jpg");
  }
  const GOLD = "#C9A84C";
  const DARK = "#1e293b";

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Photo collage — equal padding on all 4 sides */}
      <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={photoSrc} style={{ width: 576, height: 270, objectFit: "cover" }} />
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
        {/* Right: cover title (or estimate name) + date — flex:1 prevents word hyphenation */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {(clientCoverTitle || template.name) ? (
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 8, lineHeight: 1.25 }}>{clientCoverTitle || template.name}</Text>
          ) : null}
          {clientCoverTitle && template.name ? (
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>{template.name}</Text>
          ) : null}
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* 20 Years of Excellence section — flex:1 fills remaining page */}
      <View style={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: 14, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1.5 }}>{companyTagline.toUpperCase()}</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Why Choose Us</Text>
        {[
          `Licensed & Insured — ${companyLicenses}`,
          "Miami-Dade Approved Materials & NOA Certified",
          "Florida Building Code 2023 Compliant",
          "Expert Teams for All Roofing Systems: Shingle, Tile, Metal, TPO, Flat",
          "Free Inspections & Emergency Repair Services",
          "Dedicated Project Manager on Every Job",
          "Serving South Florida Homeowners & Businesses for 20+ Years",
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 7, gap: 8 }}>
            <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
            <Text style={{ fontSize: 10, color: "#334155", flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
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

// ─── Roof Introduction Page ────────────────────────────────────────────────────
function getRoofIntroParagraphs(co: string) {
  return [
    `We appreciate your consideration and look forward to delivering the high-quality workmanship and customer service ${co} is known for in South Florida. This proposal outlines the manpower, materials, equipment, and installation standards required to complete your roofing project in full compliance with Florida Building Code (FBC 2023), Miami-Dade standards, and manufacturer specifications.`,
    `1. ${co} will handle the full permit application process by preparing all required documents, including permit forms, Notice of Commencement (if needed), product approvals/Miami-Dade NOAs, roof plans, scope of work, and all contractor credentials. Once the permit package is complete, we will submit it to the appropriate Building Department, pay or coordinate permitting fees, respond to any city comments or requested revisions, and track the application until full approval is issued.`,
    `2. Manpower Provided — ${co} will supply: Certified roofing technicians · Project manager/supervisor · Safety-compliant crew (OSHA trained) · Cleanup team for daily and final site maintenance. Our team is experienced in commercial and residential roofing systems, including shingle, tile, metal, TPO, hot mop, and modified bitumen.`,
    "3. Equipment Provided — We will provide all required equipment, including: Tear-off machinery & power tools · Dump trailer or roll-off dumpster · Ladders, lifts, scaffolding (as needed) · Full safety gear and fall protection systems. All equipment is maintained to ensure safe, efficient operations.",
    `4. Materials & Installation Standards — ${co} uses only approved, high-quality roofing materials installed following: FBC 2023 and local code requirements · Miami-Dade NOA specifications · Manufacturer-approved installation practices · South Florida high-wind performance requirements. This ensures durability, waterproofing integrity, and warranty eligibility.`,
    "5. Tarps and coverings for landscaping & AC units. Clear job-site organization and debris control. OSHA fall-protection procedures. Daily cleanup and end-of-project magnetic sweep.",
    "6. Remove all debris and materials. Conduct a full walkthrough. Prepare for city/county inspections. Provide warranty documentation as applicable.",
    "We appreciate your consideration and look forward to working with you. Please reach out with any questions or adjustments you would like added to this proposal.",
  ];
}

function RoofIntroPage({ template, client }: Pick<TemplatePdfProps, "template" | "client">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
  const ROOF_INTRO_PARAS = getRoofIntroParagraphs(companyDisplayName);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Gold info bar */}
      <View style={{ flexDirection: "row", backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 10 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          {client?.name ? <Text style={{ fontSize: 16.5, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 }}>{client.name}</Text> : null}
          {client?.address ? <Text style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.address}</Text> : null}
          {clientCity ? <Text style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>{clientCity}</Text> : null}
        </View>
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 2, marginHorizontal: 24 }} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          {template.name ? <Text style={{ fontSize: 16.5, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 6, lineHeight: 1.25 }}>{template.name}</Text> : null}
          <Text style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* Intro paragraphs */}
      <View style={{ paddingHorizontal: 28, paddingTop: 14, paddingBottom: 14, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 13.5, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1 }}>SCOPE OF WORK — ROOFING</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          {ROOF_INTRO_PARAS.map((para, i) => (
            <Text key={i} style={{ fontSize: 10.5, color: "#334155", lineHeight: 1.55 }}>{para}</Text>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

// ─── Addition Marketing Page (Page 1) ─────────────────────────────────────────
function AdditionPage1({ template, client, clientCoverPhotoType, clientCoverPhotoUrl }: Pick<TemplatePdfProps, "template" | "client" | "clientCoverPhotoType" | "clientCoverPhotoUrl">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, tagline: companyTagline, contactName: companyContactName } = useBranding();
  let coverImgSrc: string;
  if (clientCoverPhotoType === "CUSTOM" && clientCoverPhotoUrl) {
    coverImgSrc = clientCoverPhotoUrl;
  } else if (clientCoverPhotoType === "LAUNDRY") {
    coverImgSrc = path.join(process.cwd(), "public", "laundry-cover.png");
  } else if (clientCoverPhotoType === "FLAT_ROOFS" || clientCoverPhotoType === "RESIDENTIAL") {
    coverImgSrc = path.join(process.cwd(), "public", "flat-roofs-cover.jpg");
  } else if (clientCoverPhotoType === "SHINGLE_ROOFS") {
    coverImgSrc = path.join(process.cwd(), "public", "shingle-roofs-cover.png");
  } else {
    coverImgSrc = path.join(process.cwd(), "public", "additions.jpg");
  }
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Fixed footer — prevents overflow to blank page 2 */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Photo collage */}
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={coverImgSrc} style={{ width: 576, height: 252, objectFit: "cover" }} />
      </View>

      {/* Gold info rectangle — compact */}
      <View style={{ flexDirection: "row", backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 12 }}>
        {/* Left: client info */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {client?.name ? <Text style={{ fontSize: 14.5, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 }}>{client.name}</Text> : null}
          {client?.address ? <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.address}</Text> : null}
          {clientCity ? <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{clientCity}</Text> : null}
          {client?.phone ? <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.phone}</Text> : null}
          {client?.email ? <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>{client.email}</Text> : null}
        </View>
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 2, marginHorizontal: 20 }} />
        {/* Right: estimate name + date */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          {template.name ? (
            <Text style={{ fontSize: 14.5, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 5, lineHeight: 1.25 }}>{template.name}</Text>
          ) : null}
          <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* 20 Years + WHY CHOOSE */}
      <View style={{ paddingHorizontal: 28, paddingTop: 16, paddingBottom: 10, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 13.5, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1.5 }}>{companyTagline.toUpperCase()}</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Why Choose Us</Text>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          {[
            "Over 20 years of delivering high-quality workmanship across South Florida",
            `Licensed & insured (${companyLicenses}) and fully compliant with Florida Building Code (FBC 2023)`,
            "Specialized expertise in additions, structural modifications, and custom home construction",
            "Turnkey service: design, engineering, permitting, and construction handled in-house",
            "Dedicated project manager from start to completion for clear communication and accountability",
            "Highly skilled, experienced team delivering consistent, professional results",
            "Built for Florida conditions: hurricanes, sun exposure, moisture, and high-wind resistance",
            "Customized solutions with honest, transparent recommendations tailored to each project",
            "Proven track record in both residential and high-end custom homes",
            "Strong, long-term relationships with trusted suppliers and manufacturers ensuring quality materials",
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ fontSize: 10, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
              <Text style={{ fontSize: 10, color: "#334155", flex: 1, lineHeight: 1.35 }}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

    </Page>
  );
}

// ─── Addition Scope of Work Page (Page 2) ─────────────────────────────────────
function AdditionPage2({ client }: Pick<TemplatePdfProps, "client">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
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
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Footer pinned to bottom */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
        {clientName ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{clientName}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Main content */}
      <View style={{ paddingHorizontal: 28, paddingTop: 10, paddingBottom: 6 }}>

        {/* WHAT WE BUILD + OUR APPROACH side by side */}
        <View style={{ flexDirection: "row", gap: 20, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 6 }}>WHAT WE BUILD</Text>
            {WHAT_ITEMS.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
                <Text style={{ fontSize: 11, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                <Text style={{ fontSize: 11, color: "#334155", flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: 2, backgroundColor: GOLD, marginVertical: 2 }} />
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 6 }}>OUR APPROACH</Text>
            <Text style={{ fontSize: 11, color: "#334155", lineHeight: 1.5 }}>
              We handle your project from concept to completion — including planning, engineering, permitting, and construction — ensuring a seamless process with one accountable team. You get a single point of contact, no subcontractor confusion, and full transparency from day one.
            </Text>
          </View>
        </View>

        {/* Scope of Work title */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 6, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1 }}>SCOPE OF WORK</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
        </View>

        {/* Intro */}
        <Text style={{ fontSize: 10.5, color: "#334155", lineHeight: 1.5, marginBottom: 8 }}>
          We appreciate the opportunity to provide this proposal. {companyDisplayName} will deliver all labor, materials, equipment, and supervision required to complete your addition in full compliance with Florida Building Code (FBC 2023), local municipal requirements, and approved engineering plans.
        </Text>

        {/* Two-column sections */}
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(0, 3).map((sec, si) => (
              <View key={si} style={{ marginTop: si === 0 ? 0 : 9, marginBottom: 2 }}>
                <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 3, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2, gap: 7 }}>
                    <Text style={{ fontSize: 10.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 10.5, color: "#475569", flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(3).map((sec, si) => (
              <View key={si} style={{ marginTop: si === 0 ? 0 : 9, marginBottom: 2 }}>
                <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 3, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2, gap: 7 }}>
                    <Text style={{ fontSize: 10.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 10.5, color: "#475569", flex: 1 }}>{item}</Text>
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

// ─── Permit & Design Scope of Work Page ──────────────────────────────────────
function PermitDrawingsPage({ client }: Pick<TemplatePdfProps, "client">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
  const PERMIT_SECTIONS: { title: string; body: string }[] = [
    {
      title: "1. Pergola",
      body: "The proposed pergola shall be shown within the architectural permit set. Final fabrication details, engineering, product approvals, and shop drawings, if required, shall be provided by the pergola manufacturer/vendor.",
    },
    {
      title: "2. Outdoor Kitchen",
      body: "The outdoor kitchen location and general layout shall be shown on the architectural plans for coordination and permit review purposes. Specialty shop drawings, engineering, and permit applications related to the outdoor kitchen components, if required, shall be provided and submitted separately by the applicable contractor/vendor.",
    },
    {
      title: "3. Pool Modifications",
      body: "The architectural permit set shall include the proposed modification to the existing pool to incorporate a beach lounge / sun shelf feature, including the general layout and related coordination details required for permit submittal.",
    },
    {
      title: "4. Railings",
      body: "The proposed railings shall be shown as part of the architectural permit drawings, including applicable locations and general construction details required for permit review. Final shop drawings, engineering calculations, fabrication details, and product approvals, if required, shall be provided by the railing manufacturer and/or specialty contractor.",
    },
    {
      title: "5. Pavers",
      body: "The paver layout shall be included within the architectural permit set for coordination purposes.",
    },
    {
      title: "6. Landscaping",
      body: "Landscape permitting, including preparation and submission of any required landscape plans, shall be performed and pulled separately by the landscape contractor.",
    },
    {
      title: "7. Irrigation",
      body: "Irrigation design, permitting, and associated specialty permits shall be provided and pulled separately by the irrigation subcontractor.",
    },
  ];
  const WHAT_ITEMS = [
    "Room Additions",
    "Second Story Additions",
    "Master Suite Expansions",
    "Garage Conversions & Additions",
    "Kitchen & Living Space Expansions",
    "Structural Modifications & Open Layouts",
    "Custom Outdoor Living Space",
  ];
  const clientName = client?.name ?? "";
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Footer pinned to bottom */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
        {clientName ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{clientName}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Main content */}
      <View style={{ paddingHorizontal: 28, paddingTop: 10, paddingBottom: 6, flex: 1 }}>

        {/* WHAT WE BUILD + OUR APPROACH side by side */}
        <View style={{ flexDirection: "row", gap: 20, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 8 }}>WHAT WE BUILD</Text>
            {WHAT_ITEMS.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 5, gap: 8 }}>
                <Text style={{ fontSize: 12, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                <Text style={{ fontSize: 12, color: "#334155", flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: 2, backgroundColor: GOLD, marginVertical: 2 }} />
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 8 }}>OUR APPROACH</Text>
            <Text style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              We handle your project from concept to completion — including planning, engineering, permitting, and construction — ensuring a seamless process with one accountable team. You get a single point of contact, no subcontractor confusion, and full transparency from day one.
            </Text>
          </View>
        </View>

        {/* Scope of Work title */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 6, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1 }}>PERMIT &amp; DESIGN SCOPE OF WORK</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
        </View>

        {/* Intro */}
        <Text style={{ fontSize: 11, color: "#334155", lineHeight: 1.5, marginBottom: 6 }}>
          Preparation of architectural permit drawings and related site plan revisions for the proposed outdoor improvements at the Schwartz Residence project located at 3161 NE 165th St, North Miami Beach, FL. The scope is intended to document the applicable work for permit submittal and coordination with the required specialty contractors and vendors.
        </Text>

        {/* Two-column sections — flex: 1 so they fill space, pushing Exclusions to bottom */}
        <View style={{ flexDirection: "row", gap: 20, alignItems: "stretch", flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            {PERMIT_SECTIONS.slice(0, 3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 2 }}>
                <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 3 }}>{sec.title}</Text>
                <Text style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.45 }}>{sec.body}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            {PERMIT_SECTIONS.slice(3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 2 }}>
                <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 3 }}>{sec.title}</Text>
                <Text style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.45 }}>{sec.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Exclusions — anchored at bottom of flex container */}
        <View style={{ paddingTop: 10, marginTop: 10, borderTop: "1px solid #e2e8f0" }}>
          <Text style={{ fontSize: 10.5, color: "#475569", lineHeight: 1.45, textAlign: "center" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Exclusions: </Text>Surveys, permit expediter services, and any work, engineering, specialty permitting, product approvals, or shop drawings not specifically listed above are excluded unless otherwise noted in writing.
          </Text>
        </View>
      </View>

    </Page>
  );
}

// ─── Retail Page 1: Cover + WHY CHOOSE US ────────────────────────────────────
function RetailPage1({ template, client, clientCoverPhotoType, clientCoverPhotoUrl, clientCoverTitle }: Pick<TemplatePdfProps, "template" | "client" | "clientCoverPhotoType" | "clientCoverPhotoUrl" | "clientCoverTitle">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
  let coverImgSrc: string;
  if (clientCoverPhotoType === "CUSTOM" && clientCoverPhotoUrl) {
    coverImgSrc = clientCoverPhotoUrl;
  } else if (clientCoverPhotoType === "FLAT_ROOFS" || clientCoverPhotoType === "RESIDENTIAL") {
    coverImgSrc = path.join(process.cwd(), "public", "flat-roofs-cover.jpg");
  } else if (clientCoverPhotoType === "SHINGLE_ROOFS") {
    coverImgSrc = path.join(process.cwd(), "public", "shingle-roofs-cover.png");
  } else if (clientCoverPhotoType === "LAUNDRY") {
    coverImgSrc = path.join(process.cwd(), "public", "laundry-cover.png");
  } else {
    coverImgSrc = path.join(process.cwd(), "public", "additions.jpg");
  }
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const clientCity = [client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  const WHY_ITEMS = [
    "Proven Retail Buildout Expertise — Extensive experience delivering high-quality retail spaces designed for functionality, customer flow, and brand impact",
    "Trusted by Recognized Brands — Kids Story (Eden Prairie, MN) · City Fashion (Margaritaville, Orlando, FL) · Fridababy (Miami, FL)",
    "Over 20 Years of Construction Excellence — Consistent track record of high-quality workmanship across South Florida and beyond",
    `Licensed, Insured & Code-Compliant — ${companyLicenses}, fully compliant with Florida Building Code (FBC 2023)`,
    "Turnkey Retail Solutions — From concept to completion: design coordination, engineering, permitting, and construction under one roof",
    "Brand-Focused Execution — We translate your brand identity into a physical space that enhances customer experience and drives sales",
    "Dedicated Project Management — Single point of contact ensuring timelines, budgets, and quality standards are maintained from start to finish",
    "Efficient Scheduling for Retail Deadlines — Opening dates are critical; projects are delivered on time with minimal delays",
    "Built for High-Traffic Commercial Use — Durable materials and construction methods designed for longevity, safety, and heavy foot traffic",
    "Customized, Transparent Approach — Tailored solutions with clear communication, detailed budgeting, and no surprises",
    "Strong Vendor & Supplier Network — Access to premium materials and finishes aligned with retail brand standards",
  ];

  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Fixed footer — prevents overflow to blank page 2 */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Cover photo — full width, no crop */}
      <View style={{ paddingTop: 8, paddingBottom: 8 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={coverImgSrc} style={{ width: 612, height: 268, objectFit: "contain" }} />
      </View>

      {/* Gold info rectangle */}
      <View style={{ flexDirection: "row", backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 16 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          {client?.name ? <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 }}>{client.name}</Text> : null}
          {client?.address ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.address}</Text> : null}
          {clientCity ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{clientCity}</Text> : null}
          {client?.phone ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{client.phone}</Text> : null}
          {client?.email ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)" }}>{client.email}</Text> : null}
        </View>
        <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.4)", marginVertical: 2, marginHorizontal: 24 }} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 6, lineHeight: 1.25 }}>{clientCoverTitle || template.name}</Text>
          {clientCoverTitle && template.name ? <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>{template.name}</Text> : null}
          <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)" }}>{today}</Text>
        </View>
      </View>

      {/* WHY CHOOSE US */}
      <View style={{ paddingHorizontal: 28, paddingTop: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, gap: 12 }}>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1.5 }}>WHY CHOOSE US</Text>
          <View style={{ flex: 1, height: 2, backgroundColor: GOLD }} />
        </View>
        {WHY_ITEMS.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
            <Text style={{ fontSize: 9.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
            <Text style={{ fontSize: 9.5, color: "#334155", flex: 1, lineHeight: 1.3, textAlign: "justify" }}>{item}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── Retail Page 2: WHAT WE BUILD + OUR APPROACH + SCOPE OF WORK ─────────────
function RetailPage2({ client }: Pick<TemplatePdfProps, "client">) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
  const WHAT_ITEMS = [
    "Retail Store Buildouts",
    "Tenant Improvements (TI)",
    "Flagship & Brand Experience Stores",
    "Mall & Inline Retail Spaces",
    "Restaurants & Food Service Buildouts",
    "Interior Renovations & Reconfigurations",
  ];
  const SECTIONS: { title: string; items: string[] }[] = [
    {
      title: "1. PERMITTING & PRE-CONSTRUCTION",
      items: [
        "Preparation of architectural and engineering plans",
        "MEP (mechanical, electrical, plumbing) coordination",
        "Structural and code compliance documentation",
        "Notice of Commencement",
        "Submission to city/building department and landlord review",
        "Coordination of revisions and approvals",
        "Permit tracking through final approval",
      ],
    },
    {
      title: "2. MANPOWER PROVIDED",
      items: [
        "Licensed General Contractor supervision",
        "Dedicated Project Manager (retail-focused execution)",
        "Skilled trade crews (carpentry, electrical, plumbing, HVAC, millwork)",
        "Fixture and display installation teams",
        "OSHA-compliant workforce",
        "Site protection and cleanup crew",
      ],
    },
    {
      title: "3. EQUIPMENT PROVIDED",
      items: [
        "Interior construction and demolition equipment",
        "Concrete, flooring, and finishing tools",
        "Framing and drywall systems",
        "Ladders, scaffolding, and lifts (as required)",
        "Safety equipment and compliance systems",
        "Dumpsters and debris removal equipment",
      ],
    },
    {
      title: "4. MATERIALS & CONSTRUCTION STANDARDS",
      items: [
        "Florida Building Code (FBC 2023) compliance",
        "Retail and commercial construction standards",
        "Landlord and shopping center requirements",
        "Manufacturer installation specifications",
        "Miami-Dade product approvals (NOA where applicable)",
        "High-traffic durability and finish standards",
      ],
    },
    {
      title: "5. SITE PROTECTION & JOB CONDITIONS",
      items: [
        "Protection of existing structure and adjacent tenants",
        "Dust, noise, and debris control (retail environment sensitive)",
        "Daily site cleanup",
        "Safe and organized jobsite",
        "Coordination with mall/center operating hours",
        "Final cleaning prior to store opening",
      ],
    },
    {
      title: "6. PROJECT CLOSEOUT",
      items: [
        "Final inspections and approvals",
        "Completion walkthrough with client and/or landlord",
        "Punch list completion",
        "Delivery of warranties and closeout documents",
        "Final site cleanup and turnover ready for merchandising",
      ],
    },
  ];
  const clientName = client?.name ?? "";
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 36 }}>
      {/* Fixed footer */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
        {clientName ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{clientName}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      <View style={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 8 }}>
        {/* WHAT WE BUILD + OUR APPROACH side by side */}
        <View style={{ flexDirection: "row", gap: 20, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 6 }}>WHAT WE BUILD</Text>
            {WHAT_ITEMS.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 6 }}>
                <Text style={{ fontSize: 10.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                <Text style={{ fontSize: 10.5, color: "#334155", flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: 2, backgroundColor: GOLD, marginVertical: 2 }} />
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 12.5, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, marginBottom: 6 }}>OUR APPROACH</Text>
            <Text style={{ fontSize: 10.5, color: "#334155", lineHeight: 1.55, textAlign: "justify" }}>
              We handle your retail project from concept to completion — including planning, engineering, permitting, and construction — ensuring a seamless process with one accountable team. You get a single point of contact, no subcontractor confusion, and full transparency from day one.{"\n\n"}We focus on delivering spaces that reflect your brand, maximize customer experience, and meet strict retail timelines.
            </Text>
          </View>
        </View>

        {/* Scope of Work title */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 6, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
          <Text style={{ fontSize: 13.5, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 1 }}>SCOPE OF WORK</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: GOLD }} />
        </View>

        {/* Intro */}
        <Text style={{ fontSize: 11, color: "#334155", lineHeight: 1.5, marginBottom: 6, textAlign: "justify" }}>
          We appreciate the opportunity to provide this proposal. {companyDisplayName} will deliver all labor, materials, equipment, and supervision required to complete your retail buildout in full compliance with Florida Building Code (FBC 2023), local municipal requirements, landlord criteria, and approved plans.
        </Text>

        {/* Two-column sections */}
        <View style={{ flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(0, 3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2.5, gap: 5 }}>
                    <Text style={{ fontSize: 11, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 11, color: "#475569", flex: 1 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {SECTIONS.slice(3).map((sec, si) => (
              <View key={si} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4, textTransform: "uppercase" }}>{sec.title}</Text>
                {sec.items.map((item, ii) => (
                  <View key={ii} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 2.5, gap: 5 }}>
                    <Text style={{ fontSize: 11, color: GOLD, fontFamily: "Helvetica-Bold" }}>•</Text>
                    <Text style={{ fontSize: 11, color: "#475569", flex: 1 }}>{item}</Text>
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

// ─── Division Summary Page ────────────────────────────────────────────────────
function DivisionSummaryPage({ template, client, divisions, gcFeePercent }: Pick<TemplatePdfProps, "template" | "client" | "divisions" | "gcFeePercent">) {
  const { logoSrc: logoPath, name: companyDisplayName, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();

  // Compute division totals (only divisions with items having a total)
  const divTotals: { name: string; total: number }[] = [];
  for (const div of divisions) {
    if (div.manualTotal != null) {
      if (div.manualTotal > 0) divTotals.push({ name: div.name, total: div.manualTotal });
      continue;
    }
    const allItems = [
      ...div.items.filter(isItemFilled),
      ...div.groups.flatMap(g => g.items.filter(isItemFilled)),
    ];
    if (allItems.length === 0) continue;
    const total = allItems.reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
    if (total > 0) divTotals.push({ name: div.name, total });
  }

  const subtotal = divTotals.reduce((s, d) => s + d.total, 0);
  const gcFeeAmount = gcFeePercent && gcFeePercent > 0 ? subtotal * gcFeePercent / 100 : 0;
  const grandTotalWithGc = subtotal + gcFeeAmount;
  const dateDisplay = fmtDate(template.estimateDate);
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

  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", paddingTop: 0, paddingBottom: 0 }}>
      {/* Header bar */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 48, height: 48 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>MIBH CONSTRUCTION</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyPhone}</Text>
        </View>
        {client ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{client.name}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Main centered content */}
      <View style={{ flex: 1, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 32 }}>
        {/* Title */}
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "center", letterSpacing: 1, marginBottom: 6 }}>
          ESTIMATE SUMMARY
        </Text>
        <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginBottom: 4 }}>{template.name}</Text>
        {dateDisplay ? <Text style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", marginBottom: 24 }}>{dateDisplay}</Text> : <View style={{ height: 24 }} />}

        {/* Gold divider */}
        <View style={{ height: 2, backgroundColor: GOLD, marginBottom: 20 }} />

        {/* Division rows */}
        {divTotals.map((d, idx) => (
          <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" }}>
            <Text style={{ fontSize: 10, color: "#334155", fontFamily: "Helvetica-Bold" }}>{d.name}</Text>
            <Text style={{ fontSize: 10, color: "#0f172a", fontFamily: "Helvetica-Bold" }}>${fmt(d.total)}</Text>
          </View>
        ))}

        {/* GC Fee row */}
        {gcFeeAmount > 0 && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: divTotals.length % 2 === 0 ? "#f8fafc" : "#ffffff" }}>
              <Text style={{ fontSize: 10, color: "#334155", fontFamily: "Helvetica-Bold" }}>GC Overhead &amp; Profit</Text>
              <Text style={{ fontSize: 10, color: "#0f172a", fontFamily: "Helvetica-Bold" }}>${fmt(gcFeeAmount)}</Text>
            </View>
          </>
        )}

        {/* Gold divider + Grand total + note — kept together, never orphaned */}
        <View wrap={false} minPresenceAhead={80}>
          <View style={{ height: 2, backgroundColor: GOLD, marginTop: 20, marginBottom: 0 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, marginTop: 0 }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: GOLD }}>ESTIMATE TOTAL</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: GOLD }}>${fmt(grandTotalWithGc)}</Text>
          </View>
          {hasAllowances && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#2d2410", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: GOLD }}>TOTAL ALLOWANCES INCLUDED</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: GOLD }}>{allowancesTotal > 0 ? `$${fmt(allowancesTotal)}` : "TBD"}</Text>
            </View>
          )}
          {(template.sqFt || template.durationMonths) && (
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32, marginTop: 18, marginBottom: 4 }}>
              {template.sqFt ? (
                <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: DARK }}>{Number(template.sqFt).toLocaleString("en-US", { maximumFractionDigits: 0 })} SF</Text>
              ) : null}
              {template.sqFt && template.durationMonths ? (
                <View style={{ width: 1, backgroundColor: "#e2e8f0", alignSelf: "stretch" }} />
              ) : null}
              {template.durationMonths ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: DARK }}>{Number(template.durationMonths).toLocaleString("en-US", { maximumFractionDigits: 1 })} MONTHS</Text>
                  <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: "#94a3b8" }}>EST. DURATION</Text>
                </View>
              ) : null}
            </View>
          )}
          <Text style={{ fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: (template.sqFt || template.durationMonths) ? 8 : 20 }}>
            Detailed scope of work and line items follow on the next pages.
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={{ backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

function ScopeOfWorkPage({ title, body, client }: { title: string; body: string; client?: TemplatePdfProps["client"] }) {
  const { logoSrc: logoPath, name: companyDisplayName, address: companyAddress, phone: companyPhone, email: companyEmail, licenses: companyLicenses, contactName: companyContactName } = useBranding();
  const blocks = body.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  const clientName = client?.name ?? "";
  return (
    <Page size="LETTER" style={{ fontFamily: "Helvetica", padding: 0, paddingBottom: 96 }}>
      {/* Footer pinned to bottom */}
      <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{companyDisplayName.toUpperCase()}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyEmail}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyContactName}</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
        <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{companyPhone}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 10, gap: 14 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoPath} style={{ width: 104, height: 104 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2 }}>{companyDisplayName.toUpperCase()}</Text>
          <Text style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>Licensed &amp; Insured  |  {companyLicenses}  |  {companyAddress}  |  {companyPhone}</Text>
        </View>
        {clientName ? <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>{clientName}</Text> : null}
      </View>
      <View style={{ height: 3, backgroundColor: GOLD }} />

      {/* Page title */}
      <View style={{ paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>{title}</Text>

        {/* Body blocks */}
        {blocks.map((block, i) => {
          const lines = block.split("\n");
          const firstLine = lines[0];
          const isNumbered = /^\d+\.\s+/.test(firstLine);
          const rest = lines.slice(1).join("\n").trim();
          if (isNumbered) {
            return (
              <View key={i} style={{ marginBottom: 10, backgroundColor: "#f8fafc", borderRadius: 4, padding: 10, borderLeft: "3px solid " + GOLD }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: rest ? 4 : 0 }}>{firstLine}</Text>
                {rest ? <Text style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.55 }}>{rest}</Text> : null}
              </View>
            );
          }
          return (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.55 }}>{block}</Text>
            </View>
          );
        })}
      </View>
    </Page>
  );
}

function TemplatePdfDocument({ companyName, template, client, divisions, showTerms, termsContent, paymentSchedule, gcFeePercent, summaryGroups, clientSignatureData, clientSignedByName, clientSignedAt, contractorSignatureData, contractorSignedAt, includeRoofUpgradesPage, includeCoverPage, includeAdditionPages, includePermitPages, includeRetailPages, includeDivisionSummary, insertPageOffset, insulationType, clientCoverPhotoType, clientCoverPhotoUrl, clientCoverTitle, forcedBreakCsiPrefixes = [], forcedBreakTerms = false, scopeOfWork, hideEstimateLabel = false, changeOrderNotes }: TemplatePdfProps) {
  const branding = useBranding();
  const grouped = groupDivisions(divisions);

  // Compute raw totals per group label (or null for ungrouped)
  function rawGroupTotal(divs: Division[]): number {
    return divs.reduce((sum, div) => {
      if (div.manualTotal != null) return sum + div.manualTotal;
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

  const paymentTermsSignatureBlock = (
    <>
      {/* Payment Schedule */}
      {(paymentSchedule ?? []).length > 0 && (
        <View wrap={false} style={{ marginTop: 16 }}>
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
      {showTerms && !!termsContent && (
        <>
          {forcedBreakTerms && <View break style={{ height: 0 }} />}
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Terms &amp; Conditions</Text>
          {termsContent.split(/\r?\n\r?\n|\r?\n(?=\d+[\.\)]?\s)/).map(p => p.trim()).filter(Boolean).map((para, i) => (
            <Text key={i} style={[styles.termsText, { marginBottom: 8 }]}>{para}</Text>
          ))}
        </>
      )}
      {/* Signature Block */}
      <View style={styles.sigSection} wrap={false}>
        <View style={[styles.sectionDivider, { marginTop: 2 }]} />
        <Text style={[styles.sectionTitle, { marginBottom: 3, paddingTop: 4 }]}>Agreement &amp; Authorization</Text>
        <Text style={{ fontSize: 8, color: "#475569", marginBottom: 3 }}>
          By signing below, both parties agree to the scope of work, pricing, and terms described in this document.
        </Text>
        <View style={styles.sigRow}>
          {/* Customer */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigPartyLabel}>Customer</Text>
            {clientSignatureData
              // eslint-disable-next-line jsx-a11y/alt-text
              ? <Image src={clientSignatureData} style={{ height: 32, marginBottom: 3, objectFit: "contain", objectPositionX: 0 }} />
              : <View style={[styles.sigLine, { marginBottom: 3, height: 32 }]} />}
            <Text style={styles.sigLineLabel}>Signature</Text>
            <View style={{ height: 4 }} />
            <View style={styles.sigLine} />
            {clientSignedByName
              ? <Text style={styles.sigPrefilled}>{clientSignedByName}</Text>
              : <View style={{ height: 8 }} />}
            <Text style={styles.sigLineLabel}>Name (Print)</Text>
            <View style={{ height: 4 }} />
            <View style={styles.sigLine} />
            {clientSignedAt
              ? <Text style={styles.sigPrefilled}>{clientSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
              : <View style={{ height: 8 }} />}
            <Text style={styles.sigLineLabel}>Date</Text>
          </View>
          {/* Contractor */}
          <View style={styles.sigBlock}>
            <Text style={styles.sigPartyLabel}>Contractor</Text>
            {contractorSignatureData
              // eslint-disable-next-line jsx-a11y/alt-text
              ? <Image src={contractorSignatureData} style={{ height: 32, marginBottom: 3, objectFit: "contain", objectPositionX: 0 }} />
              : <View style={[styles.sigLine, { marginBottom: 3, height: 32 }]} />}
            <Text style={styles.sigLineLabel}>Signature</Text>
            <View style={{ height: 4 }} />
            <View style={styles.sigLine} />
            <Text style={styles.sigPrefilled}>{branding.contactName}</Text>
            <Text style={styles.sigLineLabel}>Name (Print)</Text>
            <View style={{ height: 4 }} />
            <View style={styles.sigLine} />
            {contractorSignedAt
              ? <Text style={styles.sigPrefilled}>{contractorSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
              : <View style={{ height: 8 }} />}
            <Text style={styles.sigLineLabel}>Date</Text>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <Document title={`${template.name} — Estimate`} author={companyName}>
      {includeCoverPage && !includeAdditionPages && !includePermitPages && !includeRoofUpgradesPage && !includeRetailPages && <CoverPages template={template} client={client} clientCoverPhotoType={clientCoverPhotoType} clientCoverPhotoUrl={clientCoverPhotoUrl} clientCoverTitle={clientCoverTitle} />}
      {includeRoofUpgradesPage && <CoverPages template={template} client={client} clientCoverPhotoType={clientCoverPhotoType} clientCoverPhotoUrl={clientCoverPhotoUrl} clientCoverTitle={clientCoverTitle} />}
      {includeRoofUpgradesPage && <RoofIntroPage template={template} client={client} />}
      {includeAdditionPages && <AdditionPage1 template={template} client={client} clientCoverPhotoType={clientCoverPhotoType} clientCoverPhotoUrl={clientCoverPhotoUrl} />}
      {includeAdditionPages && <AdditionPage2 client={client} />}
      {includePermitPages && <AdditionPage1 template={template} client={client} clientCoverPhotoType={clientCoverPhotoType} clientCoverPhotoUrl={clientCoverPhotoUrl} />}
      {includePermitPages && <PermitDrawingsPage client={client} />}
      {includeRetailPages && <RetailPage1 template={template} client={client} clientCoverPhotoType={clientCoverPhotoType} clientCoverPhotoUrl={clientCoverPhotoUrl} clientCoverTitle={clientCoverTitle} />}
      {includeRetailPages && <RetailPage2 client={client} />}
      {scopeOfWork && <ScopeOfWorkPage title={scopeOfWork.title} body={scopeOfWork.body} client={client} />}
      {includeDivisionSummary && !includeRoofUpgradesPage && (
        <DivisionSummaryPage template={template} client={client} divisions={divisions} gcFeePercent={gcFeePercent} />
      )}
      <Page size="LETTER" style={styles.page}>
        {/* Fixed footer — renders on every page */}
        <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{branding.name.toUpperCase()}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.email}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.contactName}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
          <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.phone}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 8, color: "#94a3b8" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        {/* Header: scope full-width on top, addresses on bottom row */}
        <View style={styles.header}>
          {/* Top: Scope of Work centered across full width */}
          <View style={styles.centerSection}>
            <Text style={styles.centerBold}>Scope of Work:</Text>
            <Text style={styles.centerBold}>{template.name}</Text>
            {dateDisplay ? <Text style={styles.centerBold}>{dateDisplay}</Text> : null}
            {_progressPct != null ? (
              <>
                <Text style={[styles.centerBold, { color: GOLD }]}>Progress Invoice {_progressInvoiceNumber ?? ""}</Text>
                <Text style={[styles.centerBold, { color: GOLD }]}>{_progressPct}% Progress Payment</Text>
              </>
            ) : (
              !hideEstimateLabel && <Text style={styles.centerBold}>{template.estimateNumber ? `Estimate #${template.estimateNumber}` : "ESTIMATE"}</Text>
            )}
          </View>

          {/* Bottom row: Logo + company left, client right */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            {/* Left: Logo + company info */}
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.logo} src={branding.logoSrc} />
              <Text style={styles.companyInfo}>{branding.address}</Text>
              <Text style={styles.companyInfo}>Tel: {branding.phone}</Text>
              <Text style={styles.companyInfo}>{branding.licenses}</Text>
            </View>

            {/* Right: Client — marginTop 156 aligns with address lines (below 152px logo + 4px gap) */}
            <View style={{ alignItems: "flex-end", marginTop: 156 }}>
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
        </View>

        {/* Divisions — grouped into super-sections (e.g. SHELL) */}
        {(() => {
          // Shared filter function
          const applyInsF = (item: Item) => {
            const filtered = applyInsulationFilter(item.name, insulationType);
            if (filtered === null) return null;
            return filtered === item.name ? item : { ...item, name: filtered };
          };

          // ── Height simulation to find which PDF page each division lands on ──
          // Page geometry (LETTER, paddingTop 22, paddingBottom 96 footer)
          const PAGE_H = 674; // 792 - 22 - 96
          const HEADER_H = 140; // estimate header on first page (logo + company info + client + border)

          // Element height estimates (pt)
          const H_SUPER = 31;  // super-group header (marginTop 12 + padding 10 + text ~9.5)
          const H_DIV  = 22;   // division header (marginTop 4 + padding 4 + text ~9.5)
          const H_BLUE = 19;   // blue sub-group header (marginTop 3 + padding 4 + text ~9.5)
          const H_TH   = 11;   // table header row
          const H_ROW  = 11;   // item row

          // Count pre-content pages (pages before the main estimate <Page>)
          let prePages = 0;
          if (includeCoverPage && !includeAdditionPages && !includePermitPages && !includeRoofUpgradesPage && !includeRetailPages) prePages++;
          if (includeRoofUpgradesPage) prePages += 2; // CoverPages + RoofIntroPage
          if (includeAdditionPages) prePages += 2;
          if (includePermitPages) prePages += 2;
          if (includeRetailPages) prePages += 2;
          if (scopeOfWork) prePages++;
          if (includeDivisionSummary && !includeRoofUpgradesPage) prePages++;
          // Insert file is spliced in after generation — it adds 1 page that shifts all subsequent pages
          prePages += (insertPageOffset ?? 0);

          // Simulate layout: track PDF page for each division
          let simPage = prePages + 1;
          let simRemaining = PAGE_H - HEADER_H; // first page has less room (header takes space)

          function simAdvance(needed: number) {
            if (simRemaining < needed) { simPage++; simRemaining = PAGE_H; }
            simRemaining -= needed;
          }

          // div.id → { page, remainingWhenPlaced }
          const divPageMap = new Map<string, number>();
          const divRemainingMap = new Map<string, number>();
          const divNameMap = new Map<string, string>();

          for (const { groupLabel, divs: ds } of grouped) {
            const filteredDs = ds.map(div => ({
              div,
              filledItems: div.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)),
              filledGroups: div.groups.map(g => ({ ...g, items: g.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)) })).filter(g => g.items.length > 0),
            })).filter(d => d.filledItems.length > 0 || d.filledGroups.length > 0);

            if (filteredDs.length === 0) continue;

            if (groupLabel) simAdvance(H_SUPER);

            for (const { div, filledItems, filledGroups } of filteredDs) {
              // Division header has minPresenceAhead=50 — advance page if tight
              if (simRemaining < 50) { simPage++; simRemaining = PAGE_H; }
              // Record which page this division lands on and how much space was left
              divPageMap.set(div.id, simPage);
              divRemainingMap.set(div.id, simRemaining);
              divNameMap.set(div.id, div.name);
              simRemaining -= H_DIV;

              for (const grp of filledGroups) {
                const grpH = H_BLUE + H_TH + grp.items.length * H_ROW;
                if (simRemaining < Math.min(70, grpH)) { simPage++; simRemaining = PAGE_H; }
                simRemaining -= (H_BLUE + H_TH);
                for (let r = 0; r < grp.items.length; r++) { simAdvance(H_ROW); }
              }

              if (filledItems.length > 0) {
                const itemsH = H_TH + filledItems.length * H_ROW;
                if (simRemaining < Math.min(55, itemsH)) { simPage++; simRemaining = PAGE_H; }
                simRemaining -= H_TH;
                for (let r = 0; r < filledItems.length; r++) { simAdvance(H_ROW); }
              }
            }
          }

          // Force break for divisions whose CSI code matches a selected prefix
          const forcedBreakDivIds = new Set<string>();
          if (forcedBreakCsiPrefixes.length > 0) {
            for (const { divs } of grouped) {
              for (const div of divs) {
                if (div.csiCode && forcedBreakCsiPrefixes.some(p => div.csiCode!.replace(/\s/g, "").startsWith(p))) {
                  forcedBreakDivIds.add(div.id);
                }
              }
            }
          }


          return grouped.map(({ groupLabel, divs }, gi) => {
          // Pre-filter each division's items (apply insulation type filter)
          const filteredDivs = divs.map(div => ({
            div,
            filledItems: div.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)),
            filledGroups: div.groups.map(g => ({ ...g, items: g.items.map(applyInsF).filter((i): i is Item => i !== null && (isItemFilled(i) || !!i.detail)) })).filter(g => g.items.length > 0),
          })).filter(({ filledItems, filledGroups }) => filledItems.length > 0 || filledGroups.length > 0);

          if (filteredDivs.length === 0) return null;

          const rawTotal = filteredDivs.reduce((s, { div, filledItems, filledGroups }) =>
            s + (div.manualTotal != null ? div.manualTotal : [...filledItems, ...filledGroups.flatMap(g => g.items)].reduce((ss, i) => ss + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0)), 0);
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
                const divTotal = div.manualTotal != null
                  ? div.manualTotal
                  : [...filledItems, ...filledGroups.flatMap(g => g.items)]
                    .reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);

                return (
                  <View key={div.id} minPresenceAhead={160} break={forcedBreakDivIds.has(div.id)}>
                    <View wrap={false} style={[styles.divisionHeader, groupLabel ? { marginTop: 6 } : {}]}>
                      <View style={styles.divisionLeft}>
                        {!isRoof && div.csiCode ? <Text style={styles.divisionCsi}>{div.csiCode}</Text> : null}
                        <Text style={styles.divisionName}>{div.name}</Text>
                      </View>
                      {!groupLabel && <Text style={styles.divisionTotal}>${fmt(divTotal)}</Text>}
                    </View>

                    {filledGroups.map((grp) => {
                      const grpTotal = grp.items.reduce((s, i) => s + calcTotal(i.defaultQty, i.defaultUnitCost, i.defaultMarkupPct), 0);
                      return (
                        <View key={grp.id} minPresenceAhead={70}>
                          {/* Group header row — light blue */}
                          <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }}>
                            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.5 }}>{grp.name}</Text>
                            {grpTotal > 0 && <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#1e40af" }}>${fmt(grpTotal)}</Text>}
                          </View>
                          <ItemTableHeader showLineNum={isRoof} />
                          {grp.items.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} lineNum={lineNumMap.get(item.id)} />)}
                        </View>
                      );
                    })}

                    {filledItems.length > 0 && (
                      <View minPresenceAhead={55}>
                        <ItemTableHeader showLineNum={isRoof} />
                        {filledItems.map((item, idx) => <ItemRow key={item.id} item={item} index={idx} lineNum={lineNumMap.get(item.id)} />)}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        });
        })()}

        {/* Change order notes — below items, above totals */}
        {changeOrderNotes ? (
          <View style={{ marginTop: 10, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
            <Text style={{ fontSize: 8.5, color: "#475569", fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Notes</Text>
            <Text style={{ fontSize: 8.5, color: "#1e293b" }}>{changeOrderNotes}</Text>
          </View>
        ) : null}

        {/* Totals block — all kept together so TOTAL never lands alone on a new page */}
        <View wrap={false}>
          {hasAllowances && (
            <View style={[styles.grandTotalBar, { marginTop: 6, backgroundColor: "#2d2410" }]}>
              <Text style={[styles.grandTotalLabel, { fontSize: 10 }]}>TOTAL ALLOWANCES</Text>
              <Text style={[GRAND_TOTAL_VALUE_STYLE, { fontSize: 13 }]}>{allowancesTotal > 0 ? `$${fmt(allowancesTotal)}` : "TBD"}</Text>
            </View>
          )}

          {gcFeeAmount > 0 && (
            <>
              {/* Subtotal row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
                <Text style={[styles.headerText, { fontSize: 8, color: "#475569" }]}>SUBTOTAL</Text>
                <Text style={[styles.cellBold, { fontSize: 9 }]}>${fmt(grandTotal)}</Text>
              </View>
              {/* GC fee row — amount only, no % shown */}
              <View style={[styles.tableRow, { marginTop: 0 }]}>
                <Text style={[styles.cellText, styles.colName]}>GC Overhead &amp; Profit</Text>
                <Text style={[styles.cellBold, styles.colTotal]}>${fmt(gcFeeAmount)}</Text>
              </View>
            </>
          )}

          {_progressPct == null && (
            <View style={[styles.grandTotalBar, { marginTop: gcFeeAmount > 0 ? 4 : (allowancesTotal > 0 ? 4 : 6) }]}>
              <Text style={styles.grandTotalLabel}>{hideEstimateLabel ? "TOTAL" : "ESTIMATE TOTAL"}</Text>
              <Text style={GRAND_TOTAL_VALUE_STYLE}>${fmt(grandTotalWithGc)}</Text>
            </View>
          )}

          {_progressPct != null && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: GOLD, paddingHorizontal: 10, paddingVertical: 8, marginTop: gcFeeAmount > 0 ? 4 : (allowancesTotal > 0 ? 4 : 6), borderRadius: 3 }}>
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0d1117" }}>
                PROGRESS PAYMENT · {_progressPct}%
              </Text>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0d1117" }}>
                ${fmt(grandTotalWithGc * _progressPct / 100)}
              </Text>
            </View>
          )}
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
        <Page size="LETTER" style={[styles.page, { paddingTop: 14, paddingBottom: 96 }]}>
          {/* Fixed footer */}
          <View fixed style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingHorizontal: 24, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 8.5, color: GOLD, fontFamily: "Helvetica-Bold" }}>{branding.name.toUpperCase()}</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.email}</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.contactName}</Text>
            <Text style={{ fontSize: 7, color: "#94a3b8" }}>|</Text>
            <Text style={{ fontSize: 8.5, color: "#94a3b8" }}>{branding.phone}</Text>
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
  _activeBranding = getBranding(props.branding);
  _progressPct = props.progressPaymentPct ?? null;
  _progressPhase = props.progressPaymentPhase ?? null;
  _progressInvoiceNumber = props.progressInvoiceNumber ?? null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(React.createElement(TemplatePdfDocument, props) as any);
    return Buffer.from(buf as unknown as Uint8Array);
  } finally {
    _activeBranding = MIBH_DEFAULTS;
    _progressPct = null;
    _progressPhase = null;
    _progressInvoiceNumber = null;
  }
}
