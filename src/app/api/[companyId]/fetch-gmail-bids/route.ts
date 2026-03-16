import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { STANDARD_DIVISIONS } from "@/lib/divisions";
import { auth } from "@/lib/auth";

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
    const allParts: typeof payload.parts = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectParts = (parts: any[]) => {
      for (const p of parts) {
        allParts.push(p);
        if (p.parts) collectParts(p.parts);
      }
    };
    collectParts(payload.parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = allParts.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data).toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = allParts.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).toString("utf-8").replace(/<[^>]+>/g, " ");
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPdfParts(payload: any): any[] {
  if (!payload) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  if (payload.mimeType === "application/pdf" || payload.filename?.endsWith(".pdf")) {
    results.push(payload);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...extractPdfParts(part));
    }
  }
  return results;
}

// Build a targeted Gmail search using the client address/name
function buildGmailQuery(clientName?: string, clientAddress?: string): string {
  const baseTerms = "(bid OR estimate OR proposal OR quote)";

  // Extract the most distinctive part of the address (street number + first word of street)
  // e.g. "7729 Carlyle Ave, Miami Beach, FL" → "7729 Carlyle"
  if (clientAddress) {
    const parts = clientAddress.trim().split(/[\s,]+/);
    const addressKey = parts.slice(0, 2).join(" "); // e.g. "7729 Carlyle"
    if (addressKey.length > 3) {
      return `"${addressKey}" ${baseTerms}`;
    }
  }

  // Fallback: search by client name keywords
  if (clientName) {
    const nameKey = clientName.split(/\s+/).slice(0, 2).join(" ");
    return `"${nameKey}" ${baseTerms}`;
  }

  // Last resort: all bid emails with attachments (capped tightly)
  return `has:attachment filename:pdf ${baseTerms}`;
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { clientId, clientName, clientAddress } = body as { clientId?: string; clientName?: string; clientAddress?: string };

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const authClient = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: authClient });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Use targeted query — dramatically fewer emails to process
  const gmailQuery = buildGmailQuery(clientName, clientAddress);

  // Paginate through matching messages (targeted query → usually < 50 results)
  const allMessages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: gmailQuery,
      maxResults: 100,
      pageToken,
    });
    allMessages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken && allMessages.length < 200);

  // Bulk dedup: one query to get all already-imported Gmail message IDs for this client
  const existingSubBids = await prisma.subBid.findMany({
    where: { clientId, fileUrl: { startsWith: "gmail:" } },
    select: { fileUrl: true },
  });
  const processedMsgIds = new Set(
    existingSubBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
  );

  // Only process messages we haven't seen yet, cap at 30 per run
  const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
  const toProcess = newMessages.slice(0, 30);

  let added = 0;
  let skippedInLoop = 0;
  const errors: string[] = [];

  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  for (const msg of toProcess) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;

      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);
      const pdfParts = extractPdfParts(payload);

      const prompt = `You are parsing a construction subcontractor bid email for project: ${clientName ?? ""}${clientAddress ? ` at ${clientAddress}` : ""}.

FROM: ${from}
SUBJECT: ${subject}
EMAIL BODY:
${bodyText.slice(0, 2000)}

Is this a subcontractor bid or proposal related to this project? Look for the address, project name, or job number.

AVAILABLE DIVISIONS:
${divisionList}

Respond ONLY with valid JSON, no markdown:
{
  "isMatch": <true if this is a bid for this project>,
  "divisionCode": "<2-digit code, or null>",
  "contractorName": "<sender company/name>",
  "amount": <number or null>,
  "notes": "<1-sentence scope summary>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: { isMatch?: boolean; divisionCode?: string; contractorName?: string; amount?: number | null; notes?: string };
      try {
        parsed = JSON.parse(aiText);
      } catch {
        skippedInLoop++;
        continue;
      }

      if (!parsed.isMatch || !parsed.divisionCode) {
        skippedInLoop++;
        continue;
      }

      const division = STANDARD_DIVISIONS.find(d => d.code === parsed.divisionCode);
      if (!division) { skippedInLoop++; continue; }

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
      errors.push(String(err));
    }
  }

  const remaining = newMessages.length - toProcess.length;
  const skipped = (allMessages.length - newMessages.length) + skippedInLoop;
  return NextResponse.json({
    added,
    skipped,
    remaining,
    totalFound: allMessages.length,
    query: gmailQuery,
    errors: errors.slice(0, 5),
  });
}
