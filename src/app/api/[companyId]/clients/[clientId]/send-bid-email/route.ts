import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

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
  { params: _params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { to, cc, bcc, subject, bodyHtml } = body as {
    to: string; cc?: string; bcc?: string; subject: string; bodyHtml: string;
  };

  if (!to) return NextResponse.json({ error: "Recipient required" }, { status: 400 });

  const boundary = "bid_boundary_mibh";
  const mime = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    bcc ? `Bcc: ${bcc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    bodyHtml,
    "",
    `--${boundary}--`,
  ]
    .filter(l => l !== "")
    .join("\r\n");

  try {
    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(mime).toString("base64url") } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
