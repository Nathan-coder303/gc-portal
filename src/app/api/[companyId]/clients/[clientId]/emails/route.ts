import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emails = await prisma.clientEmail.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { sentAt: "desc" },
  });
  return NextResponse.json(emails);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Accept both FormData (with attachments) and JSON
  const contentType = req.headers.get("content-type") ?? "";
  let to: string, cc: string | undefined, bcc: string | undefined, subject: string, emailBody: string;
  let files: { name: string; mimeType: string; data: Buffer }[] = [];

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    to = fd.get("to") as string;
    cc = (fd.get("cc") as string) || undefined;
    bcc = (fd.get("bcc") as string) || undefined;
    subject = fd.get("subject") as string;
    emailBody = fd.get("body") as string;
    const rawFiles = fd.getAll("attachments") as File[];
    files = await Promise.all(rawFiles.map(async f => ({
      name: f.name,
      mimeType: f.type || "application/octet-stream",
      data: Buffer.from(await f.arrayBuffer()),
    })));
  } else {
    const body = await req.json();
    to = body.to; cc = body.cc; bcc = body.bcc; subject = body.subject; emailBody = body.body;
  }

  if (!to || !subject || !emailBody)
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });

  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  const encodedSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const boundary = `----=_Part_${Date.now()}`;
  const hasAttachments = files.length > 0;

  const mimeLines: string[] = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
  ];

  if (hasAttachments) {
    mimeLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, ``);
    mimeLines.push(`--${boundary}`);
    mimeLines.push(`Content-Type: text/plain; charset=UTF-8`, ``);
    mimeLines.push(emailBody, ``);
    for (const file of files) {
      const encodedName = /^[\x00-\x7F]*$/.test(file.name)
        ? file.name
        : `=?UTF-8?B?${Buffer.from(file.name).toString("base64")}?=`;
      mimeLines.push(`--${boundary}`);
      mimeLines.push(`Content-Type: ${file.mimeType}; name="${encodedName}"`);
      mimeLines.push(`Content-Transfer-Encoding: base64`);
      mimeLines.push(`Content-Disposition: attachment; filename="${encodedName}"`, ``);
      mimeLines.push(file.data.toString("base64"), ``);
    }
    mimeLines.push(`--${boundary}--`);
  } else {
    mimeLines.push(`Content-Type: text/plain; charset=UTF-8`, ``, emailBody);
  }

  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  const email = await prisma.clientEmail.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      fromEmail,
      to,
      cc: cc ?? null,
      bcc: bcc ?? null,
      subject,
      body: emailBody,
      sentBy: session.user?.name ?? session.user?.email ?? null,
      context: "manual",
      attachments: files.length > 0 ? JSON.stringify(files.map(f => f.name)) : null,
    },
  });

  return NextResponse.json(email);
}
