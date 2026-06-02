import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";
import { renderDailyLogPdf } from "@/lib/daily-log-pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body } = await req.json() as { to: string; subject?: string; body?: string };
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

  const pdfBuffer = await renderDailyLogPdf(log, company, log.client);

  const date = new Date(log.arrivalDate).toISOString().slice(0, 10);
  const clientSlug = log.client.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `Daily-Log-${clientSlug}-${date}.pdf`;

  const emailSubject = subject ?? `Daily Log — ${log.client.name} — ${new Date(log.arrivalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  const emailBody = body ?? `Please find attached the daily log for ${new Date(log.arrivalDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`;

  const oauth2Client = await getGmailOAuth(params.companyId);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  const boundary = `----=_Part_${Date.now()}`;
  const pdfBase64 = pdfBuffer.toString("base64");
  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${emailSubject}`,
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

  return NextResponse.json({ success: true });
}
