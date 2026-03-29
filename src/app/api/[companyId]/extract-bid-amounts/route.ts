/**
 * POST /api/[companyId]/extract-bid-amounts
 * Body: { clientId: string, bidIds?: string[] }
 *
 * For each SubBid with a PDF attached but no amount set, fetches the PDF
 * (from Vercel Blob or Gmail) and uses Claude to extract the total bid amount.
 * Updates the SubBid record with the extracted amount.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function fetchPdfBytes(fileUrl: string, companyId: string): Promise<Buffer | null> {
  // Vercel Blob private URL
  if (fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(fileUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  // Gmail attachment: "gmail:msgId" or "gmail:msgId:attachmentId"
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    if (parts.length < 2) return null;
    const msgId = parts[1];
    const attachmentId = parts.length >= 3 ? parts[2] : null;

    try {
      const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });

      if (attachmentId) {
        const att = await gmail.users.messages.attachments.get({
          userId: "me", messageId: msgId, id: attachmentId,
        });
        const data = att.data.data;
        if (!data) return null;
        return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      } else {
        // Inline PDF — fetch from message body
        const msg = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
        const part = findFirstPdfPart(msg.data.payload);
        if (!part) return null;
        if (part.body?.data) {
          return Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        }
        if (part.body?.attachmentId) {
          const att = await gmail.users.messages.attachments.get({
            userId: "me", messageId: msgId, id: part.body.attachmentId,
          });
          const data = att.data.data;
          if (!data) return null;
          return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        }
        return null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

async function extractAmountFromPdf(pdfBytes: Buffer): Promise<number | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBytes.toString("base64"),
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: `Extract the total bid/proposal amount from this document. Look for the grand total, total cost, total price, or base bid amount. Return ONLY the numeric dollar amount with no symbols, commas, or text — just digits and a decimal point (e.g. "27500.00"). If you cannot find a clear total amount, return "null".`,
          },
        ],
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    if (!text || text === "null") return null;
    // Strip any accidental formatting
    const cleaned = text.replace(/[^0-9.]/g, "");
    const amount = parseFloat(cleaned);
    return isNaN(amount) || amount <= 0 ? null : amount;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, bidIds } = await req.json() as { clientId: string; bidIds?: string[] };
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  // Find bids with PDFs but no amount (or specific bid IDs if provided)
  const where = bidIds?.length
    ? { id: { in: bidIds }, clientId, companyId: params.companyId }
    : { clientId, companyId: params.companyId, fileUrl: { not: null }, amount: null };

  const bids = await prisma.subBid.findMany({ where });

  const results: { id: string; amount: number | null; error?: string }[] = [];

  for (const bid of bids) {
    if (!bid.fileUrl) continue;
    const pdfBytes = await fetchPdfBytes(bid.fileUrl, params.companyId);
    if (!pdfBytes) {
      results.push({ id: bid.id, amount: null, error: "Could not fetch PDF" });
      continue;
    }

    const amount = await extractAmountFromPdf(pdfBytes);
    if (amount !== null) {
      await prisma.subBid.update({
        where: { id: bid.id },
        data: { amount, status: "RECEIVED" },
      });
    }
    results.push({ id: bid.id, amount });
  }

  const extracted = results.filter((r) => r.amount !== null).length;
  return NextResponse.json({ total: results.length, extracted, results });
}
