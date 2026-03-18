/**
 * POST /api/[companyId]/clients/[clientId]/sync-label-bids
 *
 * Pulls every email tagged "7729 bids" in Gmail, assigns all bids to this
 * specific client (no AI client-matching needed), uses AI only to extract
 * division / contractor / amount / notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

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

function decodeBase64(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data).toString("utf-8");
  if (payload.parts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collect = (parts: any[]) => { for (const p of parts) { all.push(p); if (p.parts) collect(p.parts); } };
    collect(payload.parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = all.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data).toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = all.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).toString("utf-8")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPdfParts(payload: any): any[] {
  if (!payload) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  if (
    payload.mimeType === "application/pdf" ||
    (payload.mimeType === "application/octet-stream" && payload.filename?.endsWith(".pdf")) ||
    payload.filename?.endsWith(".pdf")
  ) {
    results.push(payload);
  }
  if (payload.parts) for (const p of payload.parts) results.push(...extractPdfParts(p));
  return results;
}

function toAscii(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, " ");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
    }

    // Verify client belongs to company
    const client = await prisma.client.findFirst({
      where: { id: params.clientId, companyId: params.companyId },
      select: { id: true, name: true },
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get already-imported gmail msg IDs to deduplicate
    const existingBids = await prisma.subBid.findMany({
      where: { clientId: params.clientId, fileUrl: { startsWith: "gmail:" } },
      select: { fileUrl: true },
    });
    const processedMsgIds = new Set(
      existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
    );

    // Fetch all emails with the 7729 bids label
    const allMessages: { id?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: "label:7729-bids",
        maxResults: 100,
        pageToken,
      });
      allMessages.push(...(listRes.data.messages ?? []));
      pageToken = listRes.data.nextPageToken ?? undefined;
    } while (pageToken && allMessages.length < 500);

    const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
    const toProcess = newMessages.slice(0, 40);

    const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

    let added = 0;
    const errors: string[] = [];

    for (const msg of toProcess) {
      try {
        const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
        const payload = full.data.payload!;
        const headers = payload.headers ?? [];
        const subject = headers.find(h => h.name === "Subject")?.value ?? "";
        const from = headers.find(h => h.name === "From")?.value ?? "";
        const bodyText = extractBody(payload);
        const pdfParts = extractPdfParts(payload);

        const safeSubject = toAscii(subject);
        const safeFrom = toAscii(from);
        const safeBody = toAscii(bodyText).slice(0, 3000);

        const prompt = toAscii(`You are helping a general contractor organize subcontractor bids for project: ${client.name}.

EMAIL FROM: ${safeFrom}
SUBJECT: ${safeSubject}
BODY:
${safeBody}

AVAILABLE CSI DIVISIONS:
${divisionList}

Extract:
1. Which CSI division best describes the work?
2. Bid amount (number only, no $)?
3. Contractor/bidding company name?
4. One sentence describing the scope of work.

Respond ONLY with valid JSON, no markdown:
{
  "divisionCode": "<2-digit CSI code, or null>",
  "contractorName": "<bidding company or person name>",
  "amount": <number or null>,
  "notes": "<one sentence describing scope>"
}`);

        const aiMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });

        const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
        let parsed: { divisionCode?: string | null; contractorName?: string; amount?: number | null; notes?: string };
        try {
          parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
        } catch {
          parsed = {};
        }

        const divCode = parsed.divisionCode ?? "01";
        const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

        const fileUrl = pdfParts.length > 0
          ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
          : `gmail:${msg.id}`;
        const fileName = pdfParts[0]?.filename ?? null;

        await prisma.subBid.create({
          data: {
            clientId: params.clientId,
            companyId: params.companyId,
            divisionCode: division.code,
            divisionName: division.name,
            contractorName: parsed.contractorName ?? from,
            amount: parsed.amount ?? null,
            notes: parsed.notes ?? null,
            fileUrl,
            fileName,
            status: "RECEIVED",
            emailSource: from,
            isPlaceholder: false,
          },
        });

        added++;
      } catch (err) {
        errors.push(String(err).slice(0, 100));
      }
    }

    const remaining = Math.max(0, newMessages.length - toProcess.length);

    return NextResponse.json({
      found: allMessages.length,
      newUnprocessed: newMessages.length,
      processed: toProcess.length,
      added,
      remaining,
      errors: errors.slice(0, 5),
    });
  } catch (err) {
    console.error("Label sync fatal error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}
