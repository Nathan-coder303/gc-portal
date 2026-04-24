/**
 * POST /api/[companyId]/bids/triage/[bidId]/extract-sub
 *
 * Fetches the PDF attachment from Gmail and uses Claude to extract subcontractor
 * contact info: company name, address, phone, email.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

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

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; bidId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bid = await prisma.subBid.findUnique({ where: { id: params.bidId } });
  if (!bid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // fileUrl format: "gmail:msgId:attachmentId" or "gmail:msgId"
  const parts = (bid.fileUrl ?? "").split(":");
  const msgId = parts[1];
  const attachmentId = parts[2];

  if (!msgId || !attachmentId) {
    // No PDF attachment — return what we already know from the email
    return NextResponse.json({
      name: bid.contractorName ?? null,
      address: null,
      phone: null,
      email: null,
      licenseNumber: null,
      notes: null,
      source: "email",
    });
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    const attRes = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: msgId,
      id: attachmentId,
    });

    const pdfBase64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
    if (!pdfBase64) {
      return NextResponse.json({
        name: bid.contractorName ?? null,
        address: null,
        phone: null,
        email: null,
        source: "email",
      });
    }

    const pdfRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            {
              type: "text",
              text: `Extract the subcontractor's contact information from this bid/proposal PDF.
Respond ONLY with valid JSON, no markdown:
{
  "name": "<company or person name that submitted this bid>",
  "address": "<full street address including city, state, zip of the bidding company, or null>",
  "phone": "<phone number of the bidding company, or null>",
  "email": "<email address of the bidding company, or null>",
  "licenseNumber": "<contractor license number if shown, or null>",
  "notes": "<any useful notes about their scope, qualifications, or exclusions, or null>"
}`,
            },
          ],
        }],
      }),
    });

    const pdfJson = await pdfRes.json() as { content?: { type: string; text: string }[] };
    const pdfText = pdfJson.content?.[0]?.type === "text" ? pdfJson.content[0].text.trim() : "{}";
    const extracted = JSON.parse(pdfText.replace(/```json\n?|\n?```/g, ""));

    return NextResponse.json({
      name: extracted.name ?? bid.contractorName ?? null,
      address: extracted.address ?? null,
      phone: extracted.phone ?? null,
      email: extracted.email ?? null,
      licenseNumber: extracted.licenseNumber ?? null,
      notes: extracted.notes ?? null,
      source: "pdf",
    });
  } catch (err) {
    console.error("extract-sub error:", err);
    return NextResponse.json({
      name: bid.contractorName ?? null,
      address: null,
      phone: null,
      email: null,
      source: "fallback",
    });
  }
}
