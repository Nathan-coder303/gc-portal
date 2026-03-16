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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findFirstPdfPart(payload: any): any | null {
  if (!payload) return null;
  if ((payload.mimeType === "application/pdf" || payload.filename?.endsWith(".pdf")) && (payload.body?.attachmentId || payload.body?.data)) return payload;
  if (payload.parts) {
    for (const p of payload.parts) {
      const found = findFirstPdfPart(p);
      if (found) return found;
    }
  }
  return null;
}

// GET /api/[companyId]/gmail-attachment?msgId=xxx&attachmentId=yyy
// attachmentId is optional — if omitted, fetches the first PDF part from the message
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const msgId = searchParams.get("msgId");
  const attachmentId = searchParams.get("attachmentId") || null;

  if (!msgId) {
    return NextResponse.json({ error: "Missing msgId" }, { status: 400 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
  }

  const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });

  let buffer: Buffer;
  let filename = "bid.pdf";

  if (attachmentId) {
    // Normal path: fetch attachment by ID
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: msgId,
      id: attachmentId,
    });
    const data = attachment.data.data ?? "";
    buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } else {
    // Fallback: fetch the full message and extract first PDF part
    const full = await gmail.users.messages.get({ userId: "me", id: msgId });
    const pdfPart = findFirstPdfPart(full.data.payload);
    if (!pdfPart) return NextResponse.json({ error: "No PDF found in message" }, { status: 404 });

    filename = pdfPart.filename ?? "bid.pdf";
    if (pdfPart.body?.data) {
      // Inline data
      buffer = Buffer.from(pdfPart.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    } else if (pdfPart.body?.attachmentId) {
      // Large attachment — fetch by ID found in the message
      const attachment = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: msgId,
        id: pdfPart.body.attachmentId,
      });
      const data = attachment.data.data ?? "";
      buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    } else {
      return NextResponse.json({ error: "PDF part has no data" }, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
