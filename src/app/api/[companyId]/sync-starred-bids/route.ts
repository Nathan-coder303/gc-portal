/**
 * POST /api/[companyId]/sync-starred-bids
 *
 * Reads starred + bid-platform emails in Gmail, uses AI + code-based matching
 * to determine which client and CSI division each one belongs to, then creates SubBid records.
 *
 * User workflow: star any bid email in Gmail → click "Sync All Bids"
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
  // Catch application/pdf AND application/octet-stream with .pdf filename (PlanHub)
  if (
    payload.mimeType === "application/pdf" ||
    payload.mimeType === "application/octet-stream" && payload.filename?.endsWith(".pdf") ||
    payload.filename?.endsWith(".pdf")
  ) {
    results.push(payload);
  }
  if (payload.parts) for (const p of payload.parts) results.push(...extractPdfParts(p));
  return results;
}

/** Try to match a client by finding their street address in the email body */
function codeMatchClient(
  bodyText: string,
  subject: string,
  clients: { id: string; name: string; address: string | null; city: string | null }[]
): string | null {
  const haystack = (subject + " " + bodyText).toLowerCase();
  for (const c of clients) {
    if (!c.address) continue;
    // Match on street number + first word of street (e.g. "7729 carlyle")
    const parts = c.address.trim().split(/[\s,]+/);
    const streetNum = parts[0]; // e.g. "7729"
    const streetWord = parts[1] ?? ""; // e.g. "carlyle"
    if (streetNum.length >= 3 && streetWord.length >= 3) {
      const key = (streetNum + " " + streetWord).toLowerCase();
      if (haystack.includes(key)) return c.id;
    }
    // Also try full first-segment of address
    const addrSeg = c.address.split(",")[0].trim().toLowerCase();
    if (addrSeg.length > 5 && haystack.includes(addrSeg)) return c.id;
  }
  return null;
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
  let notBid = 0;
  let noClient = 0;
  const errors: string[] = [];
  // Track which msg IDs we processed this run (for remaining count purposes)
  const processedThisRun = new Set<string>();

  for (const msg of toProcess) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);
      const pdfParts = extractPdfParts(payload);

      const prompt = `You are helping a general contractor organize incoming subcontractor bids.

These emails may be:
- A bid/estimate sent directly from a subcontractor
- A bid notification from PlanHub (from:projectnotification@planhub.com) — these say a sub submitted a bid for a project. THESE COUNT AS BIDS.
- A bid notification from BuildingConnected or SmartBid — same, THESE COUNT AS BIDS.
- A starred email the contractor flagged as a bid

EMAIL FROM: ${from}
SUBJECT: ${subject}
BODY:
${bodyText.slice(0, 3000)}

ACTIVE CLIENTS (id | name | address):
${clientList}

AVAILABLE CSI DIVISIONS:
${divisionList}

Task:
1. Is this related to a subcontractor bid, quote, estimate, or proposal? (bid notifications count)
2. Which client does it belong to? Match by street address (number + street name), project name, or any clue.
3. Which CSI division best describes the work?
4. What is the bid amount (number only, no $)?
5. Who is the contractor or bidding company?

Respond ONLY with valid JSON, no markdown:
{
  "isBid": <true or false>,
  "clientId": "<exact id from the client list above, or null>",
  "divisionCode": "<2-digit code from divisions, or null>",
  "contractorName": "<bidding company or person name>",
  "amount": <number or null>,
  "notes": "<one sentence describing the scope of work>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: {
        isBid?: boolean;
        clientId?: string | null;
        divisionCode?: string | null;
        contractorName?: string;
        amount?: number | null;
        notes?: string;
      };
      try {
        parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
      } catch {
        // Mark as processed so we don't keep retrying a malformed response
        processedThisRun.add(msg.id!);
        continue;
      }

      // Not a bid at all — skip and mark processed
      if (!parsed.isBid) {
        notBid++;
        processedThisRun.add(msg.id!);
        continue;
      }

      // Try code-based client match if AI failed
      if (!parsed.clientId) {
        parsed.clientId = codeMatchClient(bodyText, subject, clients);
      }

      // Still no client — can't save (FK constraint), skip but DON'T mark processed
      // so user can assign manually in future or we can improve matching
      if (!parsed.clientId) {
        noClient++;
        processedThisRun.add(msg.id!); // mark so we don't infinite-loop
        errors.push(`No client match for: "${subject.slice(0, 60)}"`);
        continue;
      }

      // Validate client exists
      const client = clients.find(c => c.id === parsed.clientId);
      if (!client) {
        noClient++;
        processedThisRun.add(msg.id!);
        continue;
      }

      // Default to "01 General Conditions" if AI couldn't determine division
      const divCode = parsed.divisionCode ?? "01";
      const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

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

      processedThisRun.add(msg.id!);
      added++;
    } catch (err) {
      errors.push(String(err));
    }
  }

  // remaining = messages not yet processed (either not in this run, or in this run but no-client)
  const trueRemaining = Math.max(0, newMessages.length - processedThisRun.size - processedMsgIds.size + existingBids.length);
  const remaining = Math.max(0, newMessages.length - toProcess.length);

  return NextResponse.json({
    found: allMessages.length,
    newUnprocessed: newMessages.length,
    processed: toProcess.length,
    added,
    notBid,
    noClient,
    remaining,
    trueRemaining,
    errors: errors.slice(0, 10),
  });
}
