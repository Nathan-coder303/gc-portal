/**
 * POST /api/[companyId]/sync-starred-bids
 *
 * Reads all starred emails in Gmail, uses AI to determine which client
 * and CSI division each one belongs to, then creates SubBid records.
 *
 * User workflow: star any bid email in Gmail → click "Sync Starred Bids"
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
    if (html) return decodeBase64(html.body.data).toString("utf-8").replace(/<[^>]+>/g, " ");
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPdfParts(payload: any): any[] {
  if (!payload) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  if (payload.mimeType === "application/pdf" || payload.filename?.endsWith(".pdf")) results.push(payload);
  if (payload.parts) for (const p of payload.parts) results.push(...extractPdfParts(p));
  return results;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
  }

  const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Load all clients for this company (to let AI match emails to them)
  const clients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, address: true, city: true, state: true },
  });

  if (clients.length === 0) {
    return NextResponse.json({ error: "No clients found" }, { status: 400 });
  }

  // Load all already-imported gmail msg IDs to dedup
  const existingBids = await prisma.subBid.findMany({
    where: { companyId: params.companyId, fileUrl: { startsWith: "gmail:" } },
    select: { fileUrl: true },
  });
  const processedMsgIds = new Set(
    existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
  );

  // Known bid notification senders + starred emails
  // Add more senders here as needed
  const BID_QUERY = [
    "from:projectnotification@planhub.com",
    "from:noreply@buildingconnected.com",
    "from:noreply@smartbid.net",
    "is:starred",
  ].join(" OR ");

  const allMessages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: BID_QUERY,
      maxResults: 100,
      pageToken,
    });
    allMessages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken && allMessages.length < 500);

  const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
  // Process up to 40 per run
  const toProcess = newMessages.slice(0, 40);

  const clientList = clients
    .map(c => `${c.id} | ${c.name}${c.address ? ` | ${c.address}` : ""}${c.city ? `, ${c.city}` : ""}`)
    .join("\n");

  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  let added = 0;
  let skipped = 0;
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

      const prompt = `You are helping a general contractor organize subcontractor bids.

EMAIL FROM: ${from}
SUBJECT: ${subject}
BODY:
${bodyText.slice(0, 2500)}

ACTIVE CLIENTS (id | name | address):
${clientList}

AVAILABLE DIVISIONS:
${divisionList}

Is this a subcontractor bid, estimate, or proposal email?
If yes, determine:
1. Which client it belongs to (match by address, project name, or any context clue)
2. Which CSI division covers the work
3. The bid amount (number only, no $ sign, null if not found)
4. The contractor/company name (from sender)
5. A one-sentence scope summary

Respond ONLY with valid JSON, no markdown:
{
  "isBid": <true or false>,
  "clientId": "<client id from list, or null if cannot determine>",
  "divisionCode": "<2-digit code, or null>",
  "contractorName": "<sender company/name>",
  "amount": <number or null>,
  "notes": "<one sentence scope summary>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: { isBid?: boolean; clientId?: string | null; divisionCode?: string | null; contractorName?: string; amount?: number | null; notes?: string };
      try {
        parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
      } catch {
        skipped++;
        continue;
      }

      if (!parsed.isBid || !parsed.clientId || !parsed.divisionCode) {
        skipped++;
        continue;
      }

      const client = clients.find(c => c.id === parsed.clientId);
      const division = STANDARD_DIVISIONS.find(d => d.code === parsed.divisionCode);
      if (!client || !division) { skipped++; continue; }

      const fileUrl = pdfParts.length > 0
        ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
        : `gmail:${msg.id}`;
      const fileName = pdfParts[0]?.filename ?? null;

      await prisma.subBid.create({
        data: {
          clientId: client.id,
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
      errors.push(String(err));
    }
  }

  return NextResponse.json({
    starred: allMessages.length,
    newUnprocessed: newMessages.length,
    processed: toProcess.length,
    added,
    skipped,
    remaining: Math.max(0, newMessages.length - toProcess.length),
    errors: errors.slice(0, 5),
  });
}
