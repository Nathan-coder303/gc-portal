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

  const body = await req.json().catch(() => ({}));
  const { templateId, to, cc, bcc, subject, body: emailBody } = body as {
    templateId?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
  };

  if (!templateId || !to || !subject || !emailBody) {
    return NextResponse.json(
      { error: "templateId, to, subject, and body are required" },
      { status: 400 }
    );
  }

  // Fetch only the minimal fields needed for token + filename
  const template = await prisma.estimateTemplate.findFirst({
    where: { id: templateId, companyId: params.companyId, archivedAt: null },
    select: { id: true, name: true, estimateNumber: true, signatureToken: true, client: { select: { name: true } } },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Call the PDF route as a separate Vercel function invocation — it gets its own 10s timer
  // so PDF rendering (~5-8s) + Gmail send (~1s) each fit within the limit independently.
  // Forward the session cookie so the PDF route authenticates the same user.
  const host = req.headers.get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const pdfUrl = `${protocol}://${host}/api/${params.companyId}/estimates/${templateId}/pdf`;

  // Parallel: PDF generation (separate function invocation) + Gmail profile
  const oauth2Client = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const [pdfRes, profileRes] = await Promise.all([
    fetch(pdfUrl, { headers: { cookie: req.headers.get("cookie") ?? "" } }),
    gmail.users.getProfile({ userId: "me" }),
  ]);

  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  const finalBuffer = Buffer.from(await pdfRes.arrayBuffer());
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
