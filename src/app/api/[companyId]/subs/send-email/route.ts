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

function encodeSubject(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const to = formData.get("to") as string;
  const bcc = formData.get("bcc") as string | null;
  const subject = formData.get("subject") as string;
  const bodyText = formData.get("bodyText") as string;
  const files = formData.getAll("files") as File[];

  if (!to) return NextResponse.json({ error: "Recipient required" }, { status: 400 });

  const outerBoundary = "sub_itb_outer_mibh";
  const lines: string[] = [
    `To: ${to}`,
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    "",
    `--${outerBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText,
    "",
  ];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const b64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const safeFilename = file.name.replace(/[^\w.\-]/g, "_");
    lines.push(`--${outerBoundary}`);
    lines.push(`Content-Type: ${mimeType}; name="${safeFilename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
    lines.push("");
    const chunks = b64.match(/.{1,76}/g) ?? [b64];
    lines.push(...chunks);
    lines.push("");
  }

  lines.push(`--${outerBoundary}--`);

  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");

  try {
    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
