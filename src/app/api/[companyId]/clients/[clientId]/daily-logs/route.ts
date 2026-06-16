import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderDailyLogPdf } from "@/lib/daily-log-pdf";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.dailyLog.findMany({
    where: { companyId: params.companyId, clientId: params.clientId },
    orderBy: { arrivalDate: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: {
      name: true, contactName: true, address: true, email: true, emailList: true, dailyLogEmailEnabled: true,
      company: { select: { name: true, address: true, phone: true, email: true } },
    },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const log = await prisma.dailyLog.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      arrivalDate: new Date(body.arrivalDate),
      departureTime: body.departureTime ?? null,
      status: body.status ?? "IN_PROGRESS",
      siteCondition: body.siteCondition ?? null,
      weatherCondition: body.weatherCondition ?? null,
      temperature: body.temperature ?? null,
      weatherNote: body.weatherNote ?? null,
      weatherDelay: body.weatherDelay ?? false,
      scheduleDelay: body.scheduleDelay ?? false,
      jobsiteConditionNotes: body.jobsiteConditionNotes ?? null,
      tasksPerformed: body.tasksPerformed ?? null,
      employeesOnSite: body.employeesOnSite ?? null,
      visitorsOnSite: body.visitorsOnSite ?? false,
      visitorNotes: body.visitorNotes ?? null,
      employeeWorkNotes: body.employeeWorkNotes ?? null,
      subsOnJobsite: body.subsOnJobsite ? JSON.stringify(body.subsOnJobsite) : null,
      materialNotes: body.materialNotes ?? null,
      materialDelivered: body.materialDelivered ? JSON.stringify(body.materialDelivered) : null,
      materialUsed: body.materialUsed ? JSON.stringify(body.materialUsed) : null,
      equipmentNotes: body.equipmentNotes ?? null,
      equipmentUsed: body.equipmentUsed ? JSON.stringify(body.equipmentUsed) : null,
      equipmentDelivered: body.equipmentDelivered ? JSON.stringify(body.equipmentDelivered) : null,
      projectNotes: body.projectNotes ? JSON.stringify(body.projectNotes) : null,
      inspections: body.inspections ? JSON.stringify(body.inspections) : null,
      safetyMeetings: body.safetyMeetings ? JSON.stringify(body.safetyMeetings) : null,
      siteAuditConducted: body.siteAuditConducted ?? false,
      areasOfConcern: body.areasOfConcern ?? null,
      workCompletedPct: body.workCompletedPct ?? null,
      estimatedCompletion: body.estimatedCompletion ?? null,
      groundConditions: body.groundConditions ?? null,
      crewsPresent: body.crewsPresent ? JSON.stringify(body.crewsPresent) : null,
      equipmentDamaged: body.equipmentDamaged ?? null,
      equipmentDamageNotes: body.equipmentDamageNotes ?? null,
      signatureData: body.signatureData ?? null,
      attachments: body.attachments ? JSON.stringify(body.attachments) : null,
      createdBy: session.user?.name ?? session.user?.email ?? null,
    },
  });

  // Auto-send email if enabled
  if (client.dailyLogEmailEnabled) {
    const emails = (client.emailList as string[] | null)?.filter(Boolean) ?? [];
    const to = emails.length > 0 ? emails.join(", ") : client.email;
    if (to) {
      try {
        const company = {
          name: client.company.name,
          address: client.company.address ?? "",
          phone: client.company.phone ?? "",
          email: client.company.email ?? "",
        };
        const { buffer: pdfBuffer } = await renderDailyLogPdf(log, company, { name: client.name, address: client.address });
        const logDate = new Date(log.arrivalDate);
        const date = logDate.toISOString().slice(0, 10);
        const clientSlug = client.name.replace(/[^a-z0-9]/gi, "-");
        const filename = `Daily-Log-${clientSlug}-${date}.pdf`;
        const friendlyDate = logDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const emailSubject = `Daily Log - ${client.name} - ${logDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

        const oauth2Client = await getGmailOAuth(params.companyId);
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const [profile, sendAsList] = await Promise.all([
          gmail.users.getProfile({ userId: "me" }),
          gmail.users.settings.sendAs.list({ userId: "me" }),
        ]);
        const fromEmail = profile.data.emailAddress ?? "me";
        const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
        const signature = defaultSendAs?.signature
          ? defaultSendAs.signature
              .replace(/<br\s*\/?>/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&nbsp;/g, " ")
              .trim()
          : "";

        const emailBody = [
          `Hi ${client.contactName || client.name},`,
          ``,
          `Please find attached your Daily Log for ${friendlyDate}.`,
          ``,
          `This report summarizes the work performed, personnel on site, materials, equipment, and any site conditions noted for the day. Please review it at your convenience and don't hesitate to reach out if you have any questions.`,
          ``,
          `We appreciate your continued trust in us and remain committed to keeping you informed every step of the way.`,
          ...(signature ? [``, signature] : []),
        ].join("\n");

        const encodedSubject = `=?UTF-8?B?${Buffer.from(emailSubject, "utf8").toString("base64")}?=`;
        const outerBoundary = `----=_Mixed_${Date.now()}`;
        const altBoundary = `----=_Alt_${Date.now() + 1}`;
        const pdfBase64 = pdfBuffer.toString("base64");
        const trackPixelUrl = `https://portal.mibhconstruction.com/api/track/open?token=dl_${log.id}`;
        const htmlBody = emailBody
          .split("\n")
          .map(l => l.trim() === "" ? "<br>" : `<p style="margin:0 0 8px">${l}</p>`)
          .join("\n")
          + `\n<img src="${trackPixelUrl}" width="1" height="1" alt="" style="display:none" />`;
        const mimeLines = [
          `From: ${fromEmail}`,
          `To: ${to}`,
          `Subject: ${encodedSubject}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
          ``,
          `--${outerBoundary}`,
          `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
          ``,
          `--${altBoundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          emailBody,
          ``,
          `--${altBoundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          `<html><body style="font-family:sans-serif;font-size:14px;color:#1e293b">`,
          htmlBody,
          `</body></html>`,
          ``,
          `--${altBoundary}--`,
          ``,
          `--${outerBoundary}`,
          `Content-Type: application/pdf; name="${filename}"`,
          `Content-Transfer-Encoding: base64`,
          `Content-Disposition: attachment; filename="${filename}"`,
          ``,
          pdfBase64,
          `--${outerBoundary}--`,
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

        await prisma.dailyLog.update({
          where: { id: log.id },
          data: { emailSentAt: new Date() },
        });
      } catch (err) {
        console.error("Daily log auto-send failed:", err);
      }
    }
  }

  return NextResponse.json(log, { status: 201 });
}
