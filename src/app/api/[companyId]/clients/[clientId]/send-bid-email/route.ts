import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(mime).toString("base64url") } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-bid-email error:", e);
    const msg = String(e);
    if (msg.includes("invalid_grant")) {
      return NextResponse.json({ error: "gmail_auth_expired" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
