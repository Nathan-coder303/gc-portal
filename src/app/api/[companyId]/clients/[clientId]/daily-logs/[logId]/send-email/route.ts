import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";
import { renderDailyLogPdf } from "@/lib/daily-log-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

function encodeSubject(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function stripHtmlSignature(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    include: { client: { select: { name: true, email: true, emailList: true } } },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const emails = (log.client.emailList as string[] | null)?.filter(Boolean) ?? [];
  const to = emails.length > 0 ? emails.join(", ") : log.client.email ?? "";

  const logDate = new Date(log.arrivalDate);
  const friendlyDate = logDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const defaultSubject = `Daily Log - ${log.client.name} - ${logDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  let signature = "";
  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const sendAsList = await gmail.users.settings.sendAs.list({ userId: "me" });
    const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
    if (defaultSendAs?.signature) signature = stripHtmlSignature(defaultSendAs.signature);
  } catch { /* gmail not connected */ }

  const defaultBody = [
    `Hi ${log.client.name},`,
    ``,
    `Please find attached your Daily Log for ${friendlyDate}.`,
    ``,
    `This report summarizes the work performed, personnel on site, materials, equipment, and any site conditions noted for the day. Please review it at your convenience and don't hesitate to reach out if you have any questions.`,
    ``,
    `We appreciate your continued trust in us and remain committed to keeping you informed every step of the way.`,
    ...(signature ? [``, signature] : []),
  ].join("\n");

  type RawAtt = { id: string; name: string; url: string; mimeType: string };
  let photoCount = 0;
  try {
    const atts: RawAtt[] = JSON.parse((log.attachments as string | null) ?? "[]");
    photoCount = atts.filter(a => a.mimeType?.startsWith("image/")).length;
  } catch { /* */ }

  return NextResponse.json({ to, defaultSubject, defaultBody, photoCount });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, cc, bcc, subject, body } = await req.json() as { to: string; cc?: string; bcc?: string; subject?: string; body?: string };
  if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    include: {
      client: { select: { name: true, address: true } },
      company: { select: { name: true, address: true, phone: true, email: true } },
    },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = {
    name: log.company.name,
    address: log.company.address ?? "",
    phone: log.company.phone ?? "",
    email: log.company.email ?? "",
  };

  const base = process.env.NEXTAUTH_URL ?? "https://gc-portal-two.vercel.app";
  const attachmentBaseUrl = `${base}/api/${params.companyId}/clients/${params.clientId}/daily-logs/${params.logId}/attachments`;
  const { buffer: pdfBuffer, photoTotal, photoLoaded } = await renderDailyLogPdf(log, company, log.client, attachmentBaseUrl);

  const logDate = new Date(log.arrivalDate);
  const date = logDate.toISOString().slice(0, 10);
  const clientSlug = log.client.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `Daily-Log-${clientSlug}-${date}.pdf`;

  const friendlyDate = logDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const emailSubject = subject ?? `Daily Log - ${log.client.name} - ${logDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const oauth2Client = await getGmailOAuth(params.companyId);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const [profile, sendAsList] = await Promise.all([
    gmail.users.getProfile({ userId: "me" }),
    gmail.users.settings.sendAs.list({ userId: "me" }),
  ]);
  const fromEmail = profile.data.emailAddress ?? "me";
  const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
  const signature = defaultSendAs?.signature ? stripHtmlSignature(defaultSendAs.signature) : "";

  const emailBody = body ?? [
    `Hi ${log.client.name},`,
    ``,
    `Please find attached your Daily Log for ${friendlyDate}.`,
    ``,
    `This report summarizes the work performed, personnel on site, materials, equipment, and any site conditions noted for the day. Please review it at your convenience and don't hesitate to reach out if you have any questions.`,
    ``,
    `We appreciate your continued trust in us and remain committed to keeping you informed every step of the way.`,
    ...(signature ? [``, signature] : []),
  ].join("\n");

  const boundary = `----=_Part_${Date.now()}`;
  const pdfBase64 = pdfBuffer.toString("base64");
  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeSubject(emailSubject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    emailBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    pdfBase64,
    `--${boundary}--`,
  ];
  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  await prisma.clientEmail.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      fromEmail,
      to,
      subject: emailSubject,
      body: emailBody,
      sentBy: session.user?.name ?? session.user?.email ?? null,
      context: "daily-log",
      attachments: JSON.stringify([filename]),
    },
  });

  return NextResponse.json({ success: true, photoTotal, photoLoaded });
}
