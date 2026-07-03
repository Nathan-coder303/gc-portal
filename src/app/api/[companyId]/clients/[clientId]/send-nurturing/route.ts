import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { email: true, name: true },
  });
  if (!client?.email) {
    return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
  }

  const { subject, body, toEmail, cc, bcc } = await req.json() as {
    subject: string; body: string; toEmail?: string; cc?: string; bcc?: string;
  };
  const to = toEmail || client.email;

  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const profile = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profile.data.emailAddress ?? "me";

  // Convert plain text body to simple HTML
  const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:600px">
${body.split("\n").map((line: string) => line.trim() === "" ? "<br>" : `<p style="margin:0 0 4px">${line}</p>`).join("\n")}
</div>`;

  const boundary = `----=_Part_${Date.now()}`;
  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc?.trim() ? [`Cc: ${cc.trim()}`] : []),
    ...(bcc?.trim() ? [`Bcc: ${bcc.trim()}`] : []),
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    `--${boundary}--`,
  ];

  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  // Log to Comms tab — same table the manual email composer writes to, so
  // nurturing sends show up in the client's Comms history.
  await prisma.clientEmail.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      fromEmail,
      to,
      cc: cc?.trim() || null,
      bcc: bcc?.trim() || null,
      subject,
      body,
      sentBy: session.user?.name ?? session.user?.email ?? null,
      context: "nurturing",
      attachments: null,
    },
  });

  return NextResponse.json({ success: true });
}
