/**
 * GET /api/[companyId]/debug-bid-sync
 * Diagnostic — shows exactly what happens when processing the first unprocessed email.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const clients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, address: true, city: true, state: true },
  });

  const existingBids = await prisma.subBid.findMany({
    where: { companyId: params.companyId, fileUrl: { startsWith: "gmail:" } },
    select: { fileUrl: true },
  });
  const processedMsgIds = new Set(
    existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
  );

  // Step 1: Run the Gmail query
  let gmailError: string | null = null;
  let allMessages: { id?: string | null }[] = [];
  try {
    const BID_QUERY = [
      "from:projectnotification@planhub.com",
      "from:noreply@buildingconnected.com",
      "from:noreply@smartbid.net",
      "is:starred",
    ].join(" OR ");

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: BID_QUERY,
      maxResults: 10,
    });
    allMessages = listRes.data.messages ?? [];
  } catch (e) {
    gmailError = String(e);
  }

  const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));

  if (gmailError) {
    return NextResponse.json({ step: "gmail_query_failed", gmailError, clients: clients.length });
  }
  if (allMessages.length === 0) {
    return NextResponse.json({ step: "no_messages_found", gmailError: null, clients: clients.length });
  }
  if (newMessages.length === 0) {
    return NextResponse.json({
      step: "all_already_processed",
      totalFound: allMessages.length,
      processedMsgIds: processedMsgIds.size,
      sampleProcessedIds: Array.from(processedMsgIds).slice(0, 3),
    });
  }

  // Step 2: Fetch the first unprocessed email
  const msg = newMessages[0];
  let full;
  try {
    full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
  } catch (e) {
    return NextResponse.json({ step: "gmail_get_failed", error: String(e) });
  }

  const payload = full.data.payload!;
  const headers = payload.headers ?? [];
  const subject = headers.find(h => h.name === "Subject")?.value ?? "";
  const from = headers.find(h => h.name === "From")?.value ?? "";
  const bodyText = extractBody(payload);

  // Step 3: Call AI
  const clientList = clients
    .map(c => `${c.id} | ${c.name}${c.address ? ` | ${c.address}` : ""}${c.city ? `, ${c.city}` : ""}`)
    .join("\n");
  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  const safeFrom = from.replace(/[^\x00-\x7F]/g, " ");
  const safeSubject = subject.replace(/[^\x00-\x7F]/g, " ");
  const safeBody = bodyText.replace(/[^\x00-\x7F]/g, " ").slice(0, 3000);

  const prompt = `You are helping a general contractor organize incoming subcontractor bids.

These emails may be:
- A bid/estimate sent directly from a subcontractor
- A bid notification from PlanHub (from:projectnotification@planhub.com) — these say a sub submitted a bid for a project. THESE COUNT AS BIDS.

EMAIL FROM: ${safeFrom}
SUBJECT: ${safeSubject}
BODY:
${safeBody}

ACTIVE CLIENTS (id | name | address):
${clientList}

AVAILABLE CSI DIVISIONS:
${divisionList}

Respond ONLY with valid JSON:
{
  "isBid": <true or false>,
  "clientId": "<exact id from the client list above, or null>",
  "divisionCode": "<2-digit code, or null>",
  "contractorName": "<bidding company or person name>",
  "amount": <number or null>,
  "notes": "<one sentence describing the scope of work>"
}`;

  // Strip ALL non-ASCII from the assembled prompt before sending
  const safePrompt = prompt.replace(/[^\x00-\x7F]/g, " ");

  let aiResponse: string = "";
  let aiError: string | null = null;
  let aiParsed = null;

  // Also test: what non-ASCII chars are in the prompt?
  const nonAscii: Array<{ index: number; char: string; code: number }> = [];
  for (let i = 0; i < prompt.length; i++) {
    const code = prompt.charCodeAt(i);
    if (code > 127) nonAscii.push({ index: i, char: prompt[i], code });
  }

  try {
    const aiMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: safePrompt }],
    });
    aiResponse = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
    aiParsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ""));
  } catch (e) {
    aiError = String(e);
  }

  return NextResponse.json({
    step: "complete",
    totalFound: allMessages.length,
    newUnprocessed: newMessages.length,
    alreadyProcessed: processedMsgIds.size,
    clients: clients.length,
    email: {
      msgId: msg.id,
      from,
      subject,
      bodyLength: bodyText.length,
      bodyPreview: bodyText.slice(0, 500),
    },
    aiResponse,
    aiParsed,
    aiError,
    nonAsciiInPrompt: nonAscii,
  });
}
