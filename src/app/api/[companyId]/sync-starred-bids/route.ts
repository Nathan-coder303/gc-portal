/**
 * POST /api/[companyId]/sync-starred-bids
 *
 * Reads starred + bid-platform emails in Gmail, uses AI to extract project info,
 * auto-creates Client records as needed, then creates SubBid records.
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

/** Strip non-ASCII characters so the prompt doesn't crash ByteString conversion in fetch */
function toAscii(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, " ");
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

  // Load existing clients (may be empty — we'll auto-create as needed)
  const existingClients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, address: true, city: true, state: true },
  });

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
  const toProcess = newMessages.slice(0, 40);

  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  // Build client list string for AI (may be empty on first run)
  const buildClientList = (clients: typeof existingClients) =>
    clients.length > 0
      ? clients.map(c => `${c.id} | ${c.name}${c.address ? ` | ${c.address}` : ""}${c.city ? `, ${c.city}` : ""}`).join("\n")
      : "(none yet — extract project address and name from the email)";

  let added = 0;
  let notBid = 0;
  let noInfo = 0;
  const errors: string[] = [];
  // Keep a mutable copy so newly-created clients can be matched in the same run
  const clients = [...existingClients];

  for (const msg of toProcess) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);
      const pdfParts = extractPdfParts(payload);

      // Sanitize to ASCII to avoid ByteString conversion errors in fetch
      const safeSubject = toAscii(subject);
      const safeFrom = toAscii(from);
      const safeBody = toAscii(bodyText).slice(0, 3000);

      const prompt = `You are helping a general contractor organize incoming subcontractor bids.

These emails may be:
- A bid/estimate sent directly from a subcontractor
- A bid notification from PlanHub (projectnotification@planhub.com) saying a sub submitted a bid. THESE COUNT AS BIDS.
- A bid notification from BuildingConnected or SmartBid. THESE COUNT AS BIDS.
- A starred email the contractor flagged as a bid

EMAIL FROM: ${safeFrom}
SUBJECT: ${safeSubject}
BODY:
${safeBody}

EXISTING CLIENTS (id | name | address):
${buildClientList(clients)}

AVAILABLE CSI DIVISIONS:
${divisionList}

Task:
1. Is this a subcontractor bid, estimate, proposal, or bid notification? (notifications count as bids)
2. Which existing client does it match? Match by street address, street number, or project name.
3. If no client matches, extract the project address and name from the email to create a new client.
4. Which CSI division best describes the work?
5. Bid amount (number only, no $)?
6. Contractor/bidding company name?

Respond ONLY with valid JSON, no markdown:
{
  "isBid": true or false,
  "existingClientId": "<id from existing clients list, or null>",
  "newClientName": "<project name if creating new client, or null>",
  "newClientAddress": "<street address only if creating new client, e.g. '7729 Carlyle Ave', or null>",
  "newClientCity": "<city if creating new client, or null>",
  "newClientState": "<state abbreviation if creating new client, or null>",
  "divisionCode": "<2-digit CSI code, or null>",
  "contractorName": "<bidding company or person name>",
  "amount": <number or null>,
  "notes": "<one sentence describing the scope of work>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: {
        isBid?: boolean;
        existingClientId?: string | null;
        newClientName?: string | null;
        newClientAddress?: string | null;
        newClientCity?: string | null;
        newClientState?: string | null;
        divisionCode?: string | null;
        contractorName?: string;
        amount?: number | null;
        notes?: string;
      };
      try {
        parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
      } catch {
        errors.push(`JSON parse failed for: "${safeSubject.slice(0, 50)}"`);
        continue;
      }

      if (!parsed.isBid) {
        notBid++;
        continue;
      }

      // Resolve which client to use
      let clientId = parsed.existingClientId ?? null;

      // Validate the existingClientId actually exists
      if (clientId && !clients.find(c => c.id === clientId)) {
        clientId = null;
      }

      // Try code-based address match if AI gave no clientId
      if (!clientId) {
        const haystack = (safeSubject + " " + safeBody).toLowerCase();
        for (const c of clients) {
          if (!c.address) continue;
          const parts = c.address.trim().split(/[\s,]+/);
          const streetNum = parts[0];
          const streetWord = parts[1] ?? "";
          if (streetNum.length >= 3 && streetWord.length >= 3) {
            if (haystack.includes((streetNum + " " + streetWord).toLowerCase())) {
              clientId = c.id;
              break;
            }
          }
          const addrSeg = c.address.split(",")[0].trim().toLowerCase();
          if (addrSeg.length > 5 && haystack.includes(addrSeg)) {
            clientId = c.id;
            break;
          }
        }
      }

      // Auto-create client if AI extracted address info and we still have no match
      if (!clientId && (parsed.newClientAddress || parsed.newClientName)) {
        const newClient = await prisma.client.create({
          data: {
            companyId: params.companyId,
            name: parsed.newClientName ?? parsed.newClientAddress ?? "Unknown Project",
            address: parsed.newClientAddress ?? null,
            city: parsed.newClientCity ?? null,
            state: parsed.newClientState ?? null,
          },
        });
        clientId = newClient.id;
        // Add to local list so later emails in this run can match it
        clients.push({
          id: newClient.id,
          name: newClient.name,
          address: newClient.address,
          city: newClient.city,
          state: newClient.state,
        });
      }

      if (!clientId) {
        noInfo++;
        errors.push(`No client info for: "${safeSubject.slice(0, 60)}"`);
        continue;
      }

      const divCode = parsed.divisionCode ?? "01";
      const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

      const fileUrl = pdfParts.length > 0
        ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
        : `gmail:${msg.id}`;
      const fileName = pdfParts[0]?.filename ?? null;

      await prisma.subBid.create({
        data: {
          clientId,
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
    notBid,
    noInfo,
    remaining,
    errors: errors.slice(0, 10),
  });
}
