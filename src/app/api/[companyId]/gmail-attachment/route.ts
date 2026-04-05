import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

const FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findFirstFilePart(payload: any): any | null {
  if (!payload) return null;
  const isFile =
    FILE_MIMES.has(payload.mimeType) ||
    (payload.mimeType === "application/octet-stream" && payload.filename?.match(/\.(pdf|docx?)$/i)) ||
    payload.filename?.match(/\.(pdf|docx?)$/i);
  if (isFile && (payload.body?.attachmentId || payload.body?.data)) return payload;
  if (payload.parts) {
    for (const p of payload.parts) {
      const found = findFirstFilePart(p);
      if (found) return found;
    }
  }
  return null;
}

function mimeForPart(part: { mimeType?: string; filename?: string }): string {
  if (part.mimeType && FILE_MIMES.has(part.mimeType)) return part.mimeType;
  if (part.filename?.match(/\.docx$/i)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (part.filename?.match(/\.doc$/i)) return "application/msword";
  return "application/pdf";
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
  let filename = "bid-document";
  let contentType = "application/pdf";

  try {
    if (attachmentId) {
      // Normal path: fetch attachment by ID — also fetch message to get mime type
      const [attRes, fullMsg] = await Promise.all([
        gmail.users.messages.attachments.get({ userId: "me", messageId: msgId, id: attachmentId }),
        gmail.users.messages.get({ userId: "me", id: msgId, format: "full" }),
      ]);
      const data = attRes.data.data ?? "";
      buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      // Find the part to get filename and mime type
      const part = findFirstFilePart(fullMsg.data.payload);
      if (part) { filename = part.filename ?? filename; contentType = mimeForPart(part); }
    } else {
      // Fallback: fetch full message and find first PDF or Word doc
      const full = await gmail.users.messages.get({ userId: "me", id: msgId });
      const filePart = findFirstFilePart(full.data.payload);
      if (!filePart) return NextResponse.json({ error: "No file found in message" }, { status: 404 });

      filename = filePart.filename ?? filename;
      contentType = mimeForPart(filePart);

      if (filePart.body?.data) {
        buffer = Buffer.from(filePart.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      } else if (filePart.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me", messageId: msgId, id: filePart.body.attachmentId,
        });
        const data = attachment.data.data ?? "";
        buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      } else {
        return NextResponse.json({ error: "File part has no data" }, { status: 404 });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gmail-attachment] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
