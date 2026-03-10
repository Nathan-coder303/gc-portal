import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:4000/callback"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// GET /api/[companyId]/gmail-attachment?msgId=xxx&attachmentId=yyy
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const msgId = searchParams.get("msgId");
  const attachmentId = searchParams.get("attachmentId");

  if (!msgId || !attachmentId) {
    return NextResponse.json({ error: "Missing msgId or attachmentId" }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
  }

  const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });

  const attachment = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: msgId,
    id: attachmentId,
  });

  const data = attachment.data.data ?? "";
  const buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bid.pdf"`,
    },
  });
}
