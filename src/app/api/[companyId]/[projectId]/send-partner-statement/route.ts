import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 20;

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partnerName, partnerEmail, htmlContent, subject } = await req.json();
  if (!partnerEmail) return NextResponse.json({ error: "No email address for this partner" }, { status: 400 });

  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  const emailSubject = subject ?? `Account Statement — ${partnerName}`;
  const boundary = `----=_Part_${Date.now()}`;

  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${partnerEmail}`,
    `Subject: ${emailSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlContent,
    `--${boundary}--`,
  ];

  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
