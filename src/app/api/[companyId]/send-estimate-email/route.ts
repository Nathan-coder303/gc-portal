import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;



function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// GET — returns the authenticated Gmail address and default signature for the modal
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const [profile, sendAsList] = await Promise.all([
      gmail.users.getProfile({ userId: "me" }),
      gmail.users.settings.sendAs.list({ userId: "me" }),
    ]);

    const fromEmail = profile.data.emailAddress ?? "";
    // Find the default (primary) send-as entry for its signature
    const defaultSendAs = sendAsList.data.sendAs?.find((s) => s.isDefault) ?? sendAsList.data.sendAs?.[0];
    // Strip HTML tags from signature for plain-text use
    const rawSignature = defaultSendAs?.signature ?? "";
    const plainSignature = rawSignature
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

    return NextResponse.json({ fromEmail, signature: plainSignature });
  } catch (err) {
    console.error("Gmail profile fetch error:", err);
    return NextResponse.json({ fromEmail: "", signature: "" });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // PDF is pre-rendered by the browser and sent as binary FormData.
  // This endpoint only handles Gmail send (~1-2s), safely within Vercel Hobby's 10s limit.
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const templateId = formData.get("templateId") as string | null;
  const to = formData.get("to") as string | null;
  const cc = formData.get("cc") as string | null;
  const bcc = formData.get("bcc") as string | null;
  const subject = formData.get("subject") as string | null;
  const emailBody = formData.get("body") as string | null;
  const pdfFile = formData.get("pdf") as File | null;

  if (!templateId || !to || !subject || !emailBody || !pdfFile) {
    return NextResponse.json({ error: "templateId, to, subject, body, and pdf are required" }, { status: 400 });
  }

  const [template, finalBuffer] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: templateId, companyId: params.companyId, archivedAt: null },
      select: { id: true, name: true, estimateNumber: true, signatureToken: true, client: { select: { name: true } } },
    }),
    pdfFile.arrayBuffer().then(buf => Buffer.from(buf)),
  ]);

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Gmail profile + token generation in parallel
  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profileRes = await gmail.users.getProfile({ userId: "me" });
  const fromEmail = profileRes.data.emailAddress ?? "me";

  // Generate (or reuse) a signature token for this estimate
  let signToken = template.signatureToken;
  if (!signToken) {
    signToken = crypto.randomBytes(32).toString("hex");
    await prisma.estimateTemplate.update({
      where: { id: templateId },
      data: { signatureToken: signToken },
    });
  }
  const signUrl = `https://portal.mibhconstruction.com/sign/${signToken}`;
  const fullEmailBody = `${emailBody}\n\n---\nSign your estimate here: ${signUrl}`;

  const boundary = `----=_Part_${Date.now()}`;
  const clientSlug = template.client ? `-for-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
  const estimateSlug = template.estimateNumber ? `Estimate-${template.estimateNumber}` : template.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `${estimateSlug}${clientSlug}.pdf`;
  const encodedPdf = finalBuffer.toString("base64");

  // RFC 2047 encode subject to handle non-ASCII characters (em dash, accents, etc.)
  const encodedSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const mimeLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    fullEmailBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    encodedPdf,
    `--${boundary}--`,
  ];
  const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    console.error("Gmail send error:", err);
    return NextResponse.json({ error: "Failed to send email", detail: String(err) }, { status: 500 });
  }

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { lastSentAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
