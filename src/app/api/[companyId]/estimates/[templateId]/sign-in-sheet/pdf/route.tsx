import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";
import React from "react";

export const runtime = "nodejs";

Font.registerHyphenationCallback((word) => [word]);

const GOLD = "#C9A84C";
const DARK = "#0d1117";
const NAVY = "#1e2a3a";

type SheetData = {
  dates: string[];
  employees: { id: string; name: string; payPerDay: number; attendance: Record<string, boolean> }[];
};

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: DARK, padding: "30pt 30pt 60pt 30pt" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2pt solid ${GOLD}`, paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK },
  subtitle: { fontSize: 9, color: "#475569", marginTop: 2 },
  metaCell: { fontSize: 8, color: "#475569", textAlign: "right" },
  table: { borderTop: `1pt solid ${DARK}`, borderLeft: `1pt solid ${DARK}` },
  row: { flexDirection: "row" },
  th: { padding: "4pt 5pt", fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: NAVY, color: "#fff" },
  thName: { padding: "4pt 6pt", fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "left", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: NAVY, color: "#fff", flex: 1.6 },
  thPay: { padding: "4pt 6pt", fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: NAVY, color: "#fff", width: 70 },
  thDay: { padding: "4pt 4pt", fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: NAVY, color: "#fff", width: 36 },
  thTotal: { padding: "4pt 6pt", fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: NAVY, color: "#fff", width: 70 },
  tdName: { padding: "5pt 6pt", fontSize: 9, borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, flex: 1.6 },
  tdPay: { padding: "5pt 6pt", fontSize: 9, textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, width: 70 },
  tdDay: { padding: "5pt 4pt", fontSize: 10, textAlign: "center", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, width: 36, fontFamily: "Helvetica-Bold" },
  tdTotal: { padding: "5pt 6pt", fontSize: 10, textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, width: 70, fontFamily: "Helvetica-Bold", color: GOLD },
  totalsRow: { flexDirection: "row" },
  grandLabel: { padding: "6pt 6pt", fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: "#fef9ec" },
  grandValue: { padding: "6pt 6pt", fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "right", borderRight: `1pt solid ${DARK}`, borderBottom: `1pt solid ${DARK}`, backgroundColor: "#fef9ec", color: DARK, width: 70 },
  footer: { position: "absolute", bottom: 22, left: 30, right: 30, textAlign: "center", borderTop: `1pt solid #cccccc`, paddingTop: 6 },
  footerText: { fontSize: 8, color: "#6b7280" },
});

function fmtDateLabel(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${m}/${d}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [sheet, est, company] = await Promise.all([
    prisma.signInSheet.findUnique({ where: { estimateTemplateId: params.templateId } }),
    prisma.estimateTemplate.findFirst({ where: { id: params.templateId, companyId: params.companyId }, include: { client: true } }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!est || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data: SheetData = { dates: [], employees: [] };
  if (sheet?.data) { try { data = JSON.parse(sheet.data); } catch { /* keep empty */ } }

  const dates = data.dates ?? [];
  const employees = data.employees ?? [];

  const employeeTotals = employees.map(e => {
    const daysPresent = dates.reduce((s, d) => s + (e.attendance[d] ? 1 : 0), 0);
    return daysPresent * (Number(e.payPerDay) || 0);
  });
  const grand = employeeTotals.reduce((s, n) => s + n, 0);

  const buffer = await renderToBuffer(
    <Document>
      <Page size="LETTER" orientation={dates.length > 8 ? "landscape" : "portrait"} style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>Sign-In Sheet</Text>
            <Text style={S.subtitle}>{est.name}{est.estimateNumber ? ` · Est. #${est.estimateNumber}` : ""}</Text>
            <Text style={S.subtitle}>{est.client?.name ?? ""}</Text>
          </View>
          <View>
            <Text style={S.metaCell}>{company.name}</Text>
            {company.address && <Text style={S.metaCell}>{company.address}</Text>}
            {company.phone && <Text style={S.metaCell}>{company.phone}</Text>}
            {company.licenses && <Text style={S.metaCell}>License {company.licenses}</Text>}
          </View>
        </View>

        {employees.length === 0 || dates.length === 0 ? (
          <Text style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 40 }}>
            Add at least one employee and one date.
          </Text>
        ) : (
          <View style={S.table}>
            <View style={S.row}>
              <Text style={S.thName}>Employee</Text>
              <Text style={S.thPay}>Pay / Day</Text>
              {dates.map(d => (
                <Text key={d} style={S.thDay}>{fmtDateLabel(d)}</Text>
              ))}
              <Text style={S.thTotal}>Total</Text>
            </View>

            {employees.map((e, idx) => (
              <View key={e.id} style={S.row}>
                <Text style={S.tdName}>{e.name || "—"}</Text>
                <Text style={S.tdPay}>${fmt(Number(e.payPerDay) || 0)}</Text>
                {dates.map(d => (
                  <Text key={d} style={S.tdDay}>{e.attendance[d] ? "✓" : ""}</Text>
                ))}
                <Text style={S.tdTotal}>${fmt(employeeTotals[idx])}</Text>
              </View>
            ))}

            <View style={S.totalsRow}>
              <Text style={[S.grandLabel, { flex: 1.6 + (dates.length * 36 / 70) + 1 }]}>GRAND TOTAL</Text>
              <Text style={S.grandValue}>${fmt(grand)}</Text>
            </View>
          </View>
        )}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {company.name} · Generated {new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      </Page>
    </Document>
  );

  const filename = `SignInSheet-${(est.client?.name ?? est.name).replace(/[^a-z0-9]/gi, "-")}.pdf`;

  return new Response(Buffer.from(buffer as unknown as Uint8Array) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
