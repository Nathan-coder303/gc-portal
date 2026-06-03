import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font } from "@react-pdf/renderer";
import React from "react";
import path from "path";
import sharp from "sharp";

Font.registerHyphenationCallback((word) => [word]);

const GOLD = "#C9A84C";
const DARK = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const MUTED = "#8b949e";
const WHITE = "#e6edf3";

const s = StyleSheet.create({
  page: { backgroundColor: DARK, paddingHorizontal: 32, paddingVertical: 28, fontFamily: "Helvetica" },
  // Header
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  logo: { width: 52, height: 52, borderRadius: 8, marginRight: 14 },
  companyBlock: { flex: 1 },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: GOLD, marginBottom: 2 },
  companyDetail: { fontSize: 7.5, color: MUTED, marginBottom: 1 },
  titleBlock: { alignItems: "flex-end" },
  titleLabel: { fontSize: 18, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 2 },
  titleSub: { fontSize: 8, color: MUTED, marginTop: 2, textAlign: "right" },
  // Info strip
  infoStrip: { flexDirection: "row", gap: 10, marginBottom: 14 },
  infoBox: { flex: 1, backgroundColor: CARD, borderRadius: 6, borderWidth: 1, borderColor: BORDER, padding: 8 },
  infoLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  infoValue: { fontSize: 9, color: WHITE },
  // Status badge
  badgeRow: { flexDirection: "row", marginBottom: 14, alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Section
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: GOLD, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  sectionCard: { backgroundColor: CARD, borderRadius: 6, borderWidth: 1, borderColor: BORDER, padding: 10 },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { width: 120, fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold" },
  value: { flex: 1, fontSize: 8.5, color: WHITE },
  fullText: { fontSize: 8.5, color: WHITE, lineHeight: 1.5 },
  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 5 },
  // Grid
  grid2: { flexDirection: "row", gap: 10 },
  gridItem: { flex: 1, backgroundColor: CARD, borderRadius: 6, borderWidth: 1, borderColor: BORDER, padding: 8 },
  // Photo grid
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  photoCell: { width: "31.5%", borderRadius: 6, borderWidth: 1.5, borderColor: "#ffffff", overflow: "hidden", backgroundColor: CARD },
  photoImg: { width: "100%", height: 120 },
  photoName: { fontSize: 6.5, color: MUTED, textAlign: "center", paddingVertical: 3, paddingHorizontal: 2 },
  // List item
  listItem: { flexDirection: "row", marginBottom: 4 },
  bullet: { width: 12, color: GOLD, fontSize: 8.5 },
  listText: { flex: 1, fontSize: 8.5, color: WHITE },
  // Footer
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
  footerText: { fontSize: 7, color: MUTED },
});

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function statusStyle(status: string) {
  if (status === "COMPLETE") return { backgroundColor: "#0d2a1a", color: "#22c55e" };
  if (status === "ON_HOLD") return { backgroundColor: "#1a1a2e", color: "#8b949e" };
  return { backgroundColor: "#2a1f00", color: "#f59e0b" };
}
function statusLabel(status: string) {
  if (status === "COMPLETE") return "Complete";
  if (status === "ON_HOLD") return "On Hold";
  return "In Progress";
}

type DailyLogData = {
  id: string;
  arrivalDate: Date;
  departureTime: string | null;
  status: string;
  siteCondition: string | null;
  weatherCondition: string | null;
  temperature: string | null;
  weatherNote: string | null;
  weatherDelay: boolean;
  scheduleDelay: boolean;
  jobsiteConditionNotes: string | null;
  tasksPerformed: string | null;
  employeesOnSite: string | null;
  visitorsOnSite: boolean;
  employeeWorkNotes: string | null;
  subsOnJobsite: string | null;
  materialNotes: string | null;
  materialDelivered: string | null;
  materialUsed: string | null;
  equipmentNotes: string | null;
  equipmentUsed: string | null;
  equipmentDelivered: string | null;
  projectNotes: string | null;
  inspections: string | null;
  safetyMeetings: string | null;
  siteAuditConducted: boolean;
  areasOfConcern: string | null;
  workCompletedPct: string | null;
  estimatedCompletion: string | null;
  groundConditions: string | null;
  crewsPresent: string | null;
  equipmentDamaged: string | null;
  equipmentDamageNotes: string | null;
  createdBy: string | null;
  attachments?: string | null;
};

type CompanyInfo = { name: string; address: string; phone: string; email: string; licenses?: string };
type ClientInfo = { name: string; address?: string | null };

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function DailyLogDocument({ log, company, client, photoDataUrls }: { log: DailyLogData; company: CompanyInfo; client: ClientInfo; photoDataUrls?: { name: string; dataUrl: string }[] }) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const date = new Date(log.arrivalDate);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const arrivalTimeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const subs = parseJson<{ name: string; company: string; trade: string }[]>(log.subsOnJobsite, []);
  const matDelivered = parseJson<{ item: string; qty: string; supplier?: string }[]>(log.materialDelivered, []);
  const matUsed = parseJson<{ item: string; qty: string }[]>(log.materialUsed, []);
  const equipUsed = parseJson<{ item: string; qty: string }[]>(log.equipmentUsed, []);
  const equipDelivered = parseJson<{ item: string; qty: string }[]>(log.equipmentDelivered, []);
  const inspections = parseJson<{ type: string; status: string }[]>(log.inspections, []);
  const safetyMeetings = parseJson<{ name: string; leader: string }[]>(log.safetyMeetings, []);
  const crews = parseJson<string[]>(log.crewsPresent, []);
  const projectNotes = parseJson<{ addedBy: string; title: string; content: string }[]>(log.projectNotes, []);
  const st = statusStyle(log.status);

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoPath} style={s.logo} />
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{company.name}</Text>
            <Text style={s.companyDetail}>{company.address}</Text>
            <Text style={s.companyDetail}>{company.phone} · {company.email}</Text>
            {company.licenses && <Text style={s.companyDetail}>{company.licenses}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.titleLabel}>DAILY LOG</Text>
            <Text style={s.titleSub}>{dateStr}</Text>
            <Text style={s.titleSub}>{client.name}</Text>
          </View>
        </View>

        {/* Status + key info */}
        <View style={s.badgeRow}>
          <Text style={[s.badge, { backgroundColor: st.backgroundColor, color: st.color }]}>
            {statusLabel(log.status)}
          </Text>
          {log.weatherDelay && <Text style={[s.badge, { backgroundColor: "#2a1f00", color: "#f59e0b" }]}>Weather Delay</Text>}
          {log.scheduleDelay && <Text style={[s.badge, { backgroundColor: "#2a1010", color: "#ef4444" }]}>Schedule Delay</Text>}
          {log.createdBy && <Text style={{ fontSize: 8, color: MUTED, marginLeft: "auto" }}>Logged by {log.createdBy}</Text>}
        </View>

        {/* Info strip */}
        <View style={s.infoStrip}>
          {log.weatherCondition && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Weather</Text>
              <Text style={s.infoValue}>{log.weatherCondition}{log.temperature ? ` · ${log.temperature}°F` : ""}</Text>
            </View>
          )}
          {log.siteCondition && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Site Condition</Text>
              <Text style={s.infoValue}>{log.siteCondition}</Text>
            </View>
          )}
          {log.groundConditions && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Ground Conditions</Text>
              <Text style={s.infoValue}>{log.groundConditions}</Text>
            </View>
          )}
          {log.workCompletedPct && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Work Completed</Text>
              <Text style={s.infoValue}>{log.workCompletedPct}%</Text>
            </View>
          )}
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Arrival</Text>
            <Text style={s.infoValue}>{arrivalTimeStr}</Text>
          </View>
          {log.departureTime && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Departure</Text>
              <Text style={s.infoValue}>{log.departureTime}</Text>
            </View>
          )}
        </View>

        {/* Tasks performed */}
        {log.tasksPerformed && (
          <Section title="Tasks Performed">
            <Text style={s.fullText}>{log.tasksPerformed}</Text>
          </Section>
        )}

        {/* Jobsite conditions */}
        {(log.jobsiteConditionNotes || log.weatherNote) && (
          <Section title="Site & Weather Notes">
            {log.weatherNote && <InfoRow label="Weather Note" value={log.weatherNote} />}
            {log.jobsiteConditionNotes && <InfoRow label="Jobsite Conditions" value={log.jobsiteConditionNotes} />}
          </Section>
        )}

        {/* People */}
        {(log.employeesOnSite || log.visitorsOnSite || subs.length > 0 || crews.length > 0 || log.employeeWorkNotes) && (
          <Section title="Personnel">
            {log.employeesOnSite && <InfoRow label="Employees on Site" value={log.employeesOnSite} />}
            {log.visitorsOnSite && <InfoRow label="Visitors" value="Yes" />}
            {crews.length > 0 && <InfoRow label="Crews Present" value={crews.join(", ")} />}
            {log.employeeWorkNotes && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 3 }]}>Work Notes</Text>
                <Text style={s.fullText}>{log.employeeWorkNotes}</Text>
              </>
            )}
            {subs.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 4 }]}>Subcontractors on Site</Text>
                {subs.map((sub, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{sub.name}{sub.company ? ` (${sub.company})` : ""}{sub.trade ? ` — ${sub.trade}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
          </Section>
        )}

        {/* Materials */}
        {(log.materialNotes || matDelivered.length > 0 || matUsed.length > 0) && (
          <Section title="Materials">
            {log.materialNotes && <InfoRow label="Notes" value={log.materialNotes} />}
            {matDelivered.length > 0 && (
              <>
                {log.materialNotes && <View style={s.divider} />}
                <Text style={[s.label, { marginBottom: 4 }]}>Delivered</Text>
                {matDelivered.map((m, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{m.item}{m.qty ? ` — Qty: ${m.qty}` : ""}{m.supplier ? ` (${m.supplier})` : ""}</Text>
                  </View>
                ))}
              </>
            )}
            {matUsed.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 4 }]}>Used</Text>
                {matUsed.map((m, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{m.item}{m.qty ? ` — Qty: ${m.qty}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
          </Section>
        )}

        {/* Equipment */}
        {(log.equipmentNotes || equipUsed.length > 0 || equipDelivered.length > 0) && (
          <Section title="Equipment">
            {log.equipmentNotes && <InfoRow label="Notes" value={log.equipmentNotes} />}
            {equipUsed.length > 0 && (
              <>
                {log.equipmentNotes && <View style={s.divider} />}
                <Text style={[s.label, { marginBottom: 4 }]}>Used</Text>
                {equipUsed.map((e, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{e.item}{e.qty ? ` — ${e.qty}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
            {equipDelivered.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 4 }]}>Delivered</Text>
                {equipDelivered.map((e, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{e.item}{e.qty ? ` — ${e.qty}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
            {log.equipmentDamaged === "YES" && (
              <>
                <View style={s.divider} />
                <InfoRow label="Equipment Damaged" value="Yes" />
                {log.equipmentDamageNotes && <InfoRow label="Damage Notes" value={log.equipmentDamageNotes} />}
              </>
            )}
          </Section>
        )}

        {/* Safety & Inspections */}
        {(inspections.length > 0 || safetyMeetings.length > 0 || log.siteAuditConducted || log.areasOfConcern) && (
          <Section title="Safety & Inspections">
            {log.siteAuditConducted && <InfoRow label="Site Audit" value="Conducted" />}
            {log.areasOfConcern && <InfoRow label="Areas of Concern" value={log.areasOfConcern} />}
            {inspections.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 4 }]}>Inspections</Text>
                {inspections.map((ins, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{ins.type} — {ins.status}</Text>
                  </View>
                ))}
              </>
            )}
            {safetyMeetings.length > 0 && (
              <>
                <View style={s.divider} />
                <Text style={[s.label, { marginBottom: 4 }]}>Safety Meetings</Text>
                {safetyMeetings.map((m, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={s.listText}>{m.name}{m.leader ? ` — Led by ${m.leader}` : ""}</Text>
                  </View>
                ))}
              </>
            )}
          </Section>
        )}

        {/* Project Notes */}
        {projectNotes.length > 0 && (
          <Section title="Project Notes">
            {projectNotes.map((n, i) => (
              <View key={i}>
                {i > 0 && <View style={s.divider} />}
                {n.title && <Text style={[s.label, { marginBottom: 3 }]}>{n.title}{n.addedBy ? ` (${n.addedBy})` : ""}</Text>}
                {n.content && <Text style={s.fullText}>{n.content}</Text>}
              </View>
            ))}
          </Section>
        )}

        {/* Site Photos */}
        {photoDataUrls && photoDataUrls.length > 0 && (
          <View style={s.section} break>
            <Text style={s.sectionTitle}>Site Photos</Text>
            <View style={s.photoGrid}>
              {photoDataUrls.map((p, i) => (
                <View key={i} style={s.photoCell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={p.dataUrl} style={s.photoImg} />
                  <Text style={s.photoName}>{p.name.length > 30 ? p.name.slice(0, 28) + "…" : p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{company.name} · Daily Log · {dateStr}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function isJpeg(buf: Buffer) { return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff; }
function isPng(buf: Buffer)  { return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47; }

async function fetchPhotoAsDataUrl(blobUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      // Always convert through sharp to guarantee sRGB JPEG
      // This handles HEIC, CMYK JPEG, Display P3, WEBP, AVIF, PNG, etc.
      const jpeg = await sharp(buf)
        .rotate()                       // auto-orient from EXIF
        .toColorspace("srgb")           // flatten any wide/CMYK gamut → standard RGB
        .jpeg({ quality: 82 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch {
      // sharp couldn't decode this format (e.g. HEIC without libheif on this host)
      // Fall back only for standard JPEG/PNG — skip unknown formats to avoid black frames
      if (isJpeg(buf) || isPng(buf)) {
        const mime = isPng(buf) ? "image/png" : "image/jpeg";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
      return null; // skip HEIC / WEBP / etc. rather than embed black garbage
    }
  } catch {
    return null;
  }
}

export async function renderDailyLogPdf(
  log: DailyLogData,
  company: CompanyInfo,
  client: ClientInfo,
): Promise<{ buffer: Buffer; photoTotal: number; photoLoaded: number }> {
  type RawAttachment = { id: string; name: string; url: string; mimeType: string };
  const rawAttachments = parseJson<RawAttachment[]>(log.attachments ?? null, []);
  const imageAttachments = rawAttachments.filter(a => a.mimeType?.startsWith("image/"));
  const photoTotal = imageAttachments.length;

  const photoDataUrls: { name: string; dataUrl: string }[] = [];
  await Promise.all(
    imageAttachments.map(async (a) => {
      const dataUrl = await fetchPhotoAsDataUrl(a.url);
      if (dataUrl) photoDataUrls.push({ name: a.name, dataUrl });
    })
  );
  const photoLoaded = photoDataUrls.length;

  const buf = await renderToBuffer(
    <DailyLogDocument log={log} company={company} client={client} photoDataUrls={photoDataUrls} />
  );
  return { buffer: Buffer.from(buf), photoTotal, photoLoaded };
}
