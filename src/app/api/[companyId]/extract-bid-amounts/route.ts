/**
 * POST /api/[companyId]/extract-bid-amounts
 * Body: { clientId: string, bidIds?: string[] }
 *
 * For each SubBid with a PDF attached but no amount set, fetches the PDF
 * (from Vercel Blob or Gmail) and uses Claude to extract the total bid amount.
 * Updates the SubBid record with the extracted amount.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 300;

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

async function fetchPdfBytes(fileUrl: string): Promise<{ buffer: Buffer | null; error?: string }> {
  // Vercel Blob private URL
  if (fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(fileUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (!res.ok) return { buffer: null, error: `Blob fetch failed: ${res.status}` };
      return { buffer: Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      return { buffer: null, error: `Blob error: ${String(e)}` };
    }
  }

  // Gmail attachment: "gmail:msgId" or "gmail:msgId:attachmentId"
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    if (parts.length < 2) return { buffer: null, error: "Invalid gmail URL" };
    const msgId = parts[1];
    const attachmentId = parts.length >= 3 && parts[2] ? parts[2] : null;

    try {
      const gmail = google.gmail({ version: "v1", auth: await getGmailOAuth(params.companyId) });

      if (attachmentId) {
        const att = await gmail.users.messages.attachments.get({
          userId: "me", messageId: msgId, id: attachmentId,
        });
        const data = att.data.data;
        if (!data) return { buffer: null, error: "No attachment data" };
        return { buffer: Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64") };
      } else {
        // Inline PDF — fetch from message body
        const msg = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
        const part = findFirstPdfPart(msg.data.payload);
        if (!part) return { buffer: null, error: "No PDF part in message" };
        if (part.body?.data) {
          return { buffer: Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64") };
        }
        if (part.body?.attachmentId) {
          const att = await gmail.users.messages.attachments.get({
            userId: "me", messageId: msgId, id: part.body.attachmentId,
          });
          const data = att.data.data;
          if (!data) return { buffer: null, error: "No inline attachment data" };
          return { buffer: Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64") };
        }
        return { buffer: null, error: "No usable PDF data in message" };
      }
    } catch (e) {
      return { buffer: null, error: `Gmail error: ${String(e)}` };
    }
  }

  return { buffer: null, error: "Unknown file URL format" };
}

async function callClaude(apiKey: string, pdfBase64: string): Promise<{ text: string; rateLimited: boolean; error?: string }> {
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: "This is a subcontractor bid/proposal. Extract two things and respond with ONLY valid JSON, nothing else: {\"amount\": <total dollar amount as number, e.g. 27500.00, or null>, \"date\": <proposal/bid date as MM/DD/YYYY string, or null>}. For amount: find Grand Total, Total Cost, Total Price, Base Bid, Lump Sum, or Total Due. For date: find the date the proposal was written or submitted." },
        ],
      }],
    }),
  });
  const parsed = await aiRes.json() as { content?: { type: string; text: string }[]; error?: { message: string; type?: string } };
  if (parsed.error) {
    const isRateLimit = parsed.error.type === "rate_limit_error" || (parsed.error.message ?? "").includes("rate limit");
    return { text: "", rateLimited: isRateLimit, error: parsed.error.message };
  }
  return { text: parsed.content?.[0]?.type === "text" ? parsed.content[0].text.trim() : "", rateLimited: false };
}

async function extractFromPdf(pdfBytes: Buffer): Promise<{ amount: number | null; bidDate: string | null; error?: string }> {
  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
    const pdfBase64 = pdfBytes.toString("base64");

    let result = await callClaude(apiKey, pdfBase64);
    if (result.rateLimited) {
      await new Promise((r) => setTimeout(r, 60_000));
      result = await callClaude(apiKey, pdfBase64);
    }
    if (result.error) return { amount: null, bidDate: null, error: `API error: ${result.error}` };

    const text = result.text.replace(/```json\n?|\n?```/g, "").trim();
    let data: { amount?: number | null; date?: string | null } = {};
    try { data = JSON.parse(text); } catch {
      // fallback: try to parse as plain number (old format)
      const cleaned = text.replace(/[^0-9.]/g, "");
      const n = parseFloat(cleaned);
      return { amount: isNaN(n) || n <= 0 ? null : n, bidDate: null, error: isNaN(n) ? `Unparseable: "${text}"` : undefined };
    }

    const amount = data.amount != null && !isNaN(Number(data.amount)) && Number(data.amount) > 0 ? Number(data.amount) : null;
    const bidDate = data.date && data.date !== "null" ? String(data.date) : null;
    return { amount, bidDate };
  } catch (e) {
    return { amount: null, bidDate: null, error: `Error: ${String(e)}` };
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

  // Only process bids that have a PDF but no amount yet — skip already-extracted ones
  const where = bidIds?.length
    ? { id: { in: bidIds }, clientId, companyId: params.companyId }
    : { clientId, companyId: params.companyId, fileUrl: { not: null }, isPlaceholder: false, amount: null };

  const bids = await prisma.subBid.findMany({ where });

  const results: { id: string; amount: number | null; error?: string }[] = [];
  const deadline = Date.now() + 280_000; // stop after 280s to stay within 300s limit

  for (const bid of bids) {
    if (!bid.fileUrl) continue;
    if (Date.now() > deadline) {
      results.push({ id: bid.id, amount: null, error: "Time limit reached — run again to continue" });
      continue;
    }

    const { buffer: pdfBytes, error: fetchError } = await fetchPdfBytes(bid.fileUrl);
    if (!pdfBytes) {
      results.push({ id: bid.id, amount: null, error: fetchError ?? "Could not fetch PDF" });
      continue;
    }

    const { amount, bidDate, error: extractError } = await extractFromPdf(pdfBytes);
    const currentAmount = bid.amount !== null ? Number(bid.amount) : null;
    const updateData: Record<string, unknown> = {};
    if (amount !== null && amount !== currentAmount) { updateData.amount = amount; updateData.status = "RECEIVED"; }
    if (bidDate) updateData.bidDate = bidDate;
    if (Object.keys(updateData).length > 0) {
      await prisma.subBid.update({ where: { id: bid.id }, data: updateData });
    }
    results.push({ id: bid.id, amount, error: extractError });
    // Throttle to stay under 50k token/min rate limit (~4k tokens/PDF, 5s gap = ~48k/min)
    await new Promise((r) => setTimeout(r, 5000));
  }

  const extracted = results.filter((r) => r.amount !== null).length;
  const errors = Array.from(new Set(results.filter((r) => r.error).map((r) => r.error)));
  return NextResponse.json({ total: results.length, extracted, results, errors });
}
