import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

function fmtOrdinalDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const sfx = [11, 12, 13].includes(day) ? "th" : (["st", "nd", "rd"][(day % 10) - 1] ?? "th");
  return `${month} ${day}${sfx}, ${year}`;
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    color: "#000",
    lineHeight: 1.55,
  },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    textAlign: "center",
    textDecoration: "underline",
    marginBottom: 22,
  },
  para: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.55,
    marginBottom: 14,
    textAlign: "justify",
  },
  indented: { paddingLeft: 72, marginBottom: 14 },
  line: { fontFamily: "Times-Roman", fontSize: 11, lineHeight: 1.55 },
  spacer: { height: 30 },
  sigCompany: { fontFamily: "Times-Bold", fontSize: 11, textDecoration: "underline", marginBottom: 2 },
  sigEntityType: { fontFamily: "Times-Roman", fontSize: 11, marginBottom: 28 },
  sigByRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  sigByLabel: { fontFamily: "Times-Roman", fontSize: 11, width: 24 },
  sigLineView: { flex: 1, borderBottomWidth: 0.75, borderBottomColor: "#000" },
  sigFieldRow: { fontFamily: "Times-Roman", fontSize: 11, marginBottom: 2 },
});

export type LienReleasePdfProps = {
  type: "PARTIAL" | "FINAL";
  subName: string;
  amount: string | null;
  throughDate: string | null;
  legalDescription: string;
  contractorName: string;
  clientName: string;
  clientAddress: string | null;
  signatureData?: string | null;
  signedByName?: string | null;
  createdDate: string; // YYYY-MM-DD
};

export function LienReleasePdfDocument(props: LienReleasePdfProps) {
  const {
    type, subName, amount, throughDate, legalDescription,
    contractorName, clientName, clientAddress,
    signatureData, signedByName, createdDate,
  } = props;

  const typeLabel = type === "PARTIAL" ? "PARTIAL" : "FINAL";
  const title = `LOWER TIER’S UNCONDITIONAL ${typeLabel} WAIVER AND RELEASE OF LIEN`;
  const amountStr = amount ? `$${amount}` : "$__________";
  const throughStr = throughDate ? fmtOrdinalDate(throughDate) : "__________";
  const datedStr = fmtOrdinalDate(createdDate);

  const disclaimer = type === "PARTIAL"
    ? "This waiver and release does not cover any retention or retainage by Contractor or Owner or any labor, services, or materials furnished after the date specified."
    : "This waiver and release covers all labor, services, and materials furnished on this project and constitutes a full and final release of all lien rights by the undersigned.";

  const addressLine = [clientAddress].filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>{title}</Text>

        {/* Body paragraph */}
        <Text style={s.para}>
          {"The undersigned lienor, in consideration of the sum of "}
          <Text style={{ textDecoration: "underline" }}>{amountStr}</Text>
          {", hereby waives and releases its lien, right to claim a lien, and all other claims for non-payment that lienor has or might have against the Contractor, Owner and/or the buildings and improvements for labor, services, or materials furnished through "}
          {throughStr}
          {", to "}
          <Text style={{ fontFamily: "Times-Bold" }}>{contractorName}</Text>
          {" (“Contractor”) on the job of "}
          {clientName}
          {". (“Owner”) to the following property:"}
        </Text>

        {/* Property & legal description */}
        <View style={s.indented}>
          {addressLine ? (
            <Text style={s.line}>Property Address:  {addressLine}</Text>
          ) : null}
          <Text style={[s.line, { marginTop: 10 }]}>Legal Description:</Text>
          {legalDescription.split(/\r?\n/).map((line, i) => (
            <Text key={i} style={s.line}>{line}</Text>
          ))}
        </View>

        <View style={s.spacer} />

        <Text style={s.para}>{disclaimer}</Text>

        <Text style={[s.para, { marginBottom: 40 }]}>DATED on {datedStr}.</Text>

        {/* Signature block */}
        <Text style={s.sigCompany}>{subName}</Text>
        <Text style={s.sigEntityType}>a Florida Limited Liability Company</Text>

        {signatureData ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={signatureData} style={{ height: 40, marginBottom: 6, objectFit: "contain", objectPositionX: 0, width: 220 }} />
        ) : (
          <View style={{ marginBottom: 6 }}>
            <View style={s.sigByRow}>
              <Text style={s.sigByLabel}>By:</Text>
              <View style={s.sigLineView} />
            </View>
          </View>
        )}

        {signatureData && (
          <Text style={[s.sigFieldRow, { marginBottom: 2 }]}>By:</Text>
        )}
        <Text style={s.sigFieldRow}>Printed Name: {signedByName ?? "__________________________"}</Text>
        <Text style={s.sigFieldRow}>
          {"Title:  "}
          <Text style={{ textDecoration: "underline" }}>Managing Member</Text>
        </Text>
      </Page>
    </Document>
  );
}

export async function renderLienReleasePdf(props: LienReleasePdfProps): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(React.createElement(LienReleasePdfDocument, props) as any) as Promise<Buffer>;
}
