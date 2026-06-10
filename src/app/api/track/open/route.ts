import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET /api/track/open?token=xxx — tracking pixel for email open detection
// Token formats:
//   <hex>         → estimate signatureToken
//   dl_<logId>    → daily log open
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (token?.startsWith("dl_")) {
    const logId = token.slice(3);
    try {
      const log = await prisma.dailyLog.findUnique({
        where: { id: logId },
        select: { id: true, companyId: true, arrivalDate: true, emailOpenedAt: true, client: { select: { name: true } } },
      });
      if (log && !log.emailOpenedAt) {
        await prisma.dailyLog.update({ where: { id: log.id }, data: { emailOpenedAt: new Date() } });

        try {
          const oauth2Client = await getGmailOAuth(log.companyId);
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: "me" });
          const fromEmail = profile.data.emailAddress ?? "me";
          const dateStr = new Date(log.arrivalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          const clientLabel = log.client?.name ?? "The client";
          const subject = `${clientLabel} opened Daily Log — ${dateStr}`;
          const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
          const body = [
            `${clientLabel} has opened the daily log email.`,
            ``,
            `Daily Log: ${dateStr}`,
            `Opened at: ${new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`,
          ].join("\n");
          const mimeLines = [
            `From: ${fromEmail}`,
            `To: ${fromEmail}`,
            `Subject: ${encodedSubject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/plain; charset=UTF-8`,
            ``,
            body,
          ];
          const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        } catch { /* non-fatal */ }
      }
    } catch { /* non-fatal — still return the pixel */ }
  } else if (token) {
    try {
      const template = await prisma.estimateTemplate.findUnique({
        where: { signatureToken: token },
        select: { id: true, companyId: true, name: true, estimateNumber: true, emailOpenedAt: true, client: { select: { name: true } } },
      });

      if (template && !template.emailOpenedAt) {
        // Mark first open
        await prisma.$executeRawUnsafe(
          `UPDATE "EstimateTemplate" SET "emailOpenedAt" = NOW() WHERE id = $1`,
          template.id
        );

        // Send notification
        try {
          const oauth2Client = await getGmailOAuth(template.companyId);
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          const profile = await gmail.users.getProfile({ userId: "me" });
          const fromEmail = profile.data.emailAddress ?? "me";

          const clientLabel = template.client?.name ?? "The client";
          const estimateRef = template.estimateNumber
            ? `Estimate #${template.estimateNumber}`
            : `"${template.name}"`;
          const subject = `${clientLabel} opened ${estimateRef}`;
          const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
          const body = [
            `${clientLabel} has opened the estimate email.`,
            ``,
            `Estimate: ${template.estimateNumber ? `#${template.estimateNumber} — ` : ""}${template.name}`,
            `Opened at: ${new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`,
          ].join("\n");

          const mimeLines = [
            `From: ${fromEmail}`,
            `To: ${fromEmail}`,
            `Subject: ${encodedSubject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/plain; charset=UTF-8`,
            ``,
            body,
          ];
          const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        } catch {
          // non-fatal
        }
      }
    } catch {
      // non-fatal — still return the pixel
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}
