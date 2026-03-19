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
  // Keep only printable ASCII: tab, newline, CR, and 0x20–0x7E
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
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
    // Sanitize API key — strip any invisible/non-ASCII chars that cause ByteString errors in fetch headers
    const safeApiKey = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();
    const anthropic = new Anthropic({ apiKey: safeApiKey });

    // Confirm which Gmail account is being accessed
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    const gmailEmail = profileRes.data.emailAddress ?? "unknown";

    // Get already-imported gmail msg IDs to deduplicate
    const existingBids = await prisma.subBid.findMany({
      where: { clientId: params.clientId, fileUrl: { startsWith: "gmail:" } },
      select: { fileUrl: true },
    });
    const processedMsgIds = new Set(
      existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
    );

    // Resolve the "7729 bids" label ID dynamically
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const label = labelsRes.data.labels?.find(
      l => l.name?.toLowerCase() === "7729 bids"
    );
    if (!label?.id) {
      const allLabelNames = labelsRes.data.labels?.map(l => l.name).filter(Boolean) ?? [];
      return NextResponse.json({ error: "Gmail label '7729 bids' not found", gmailEmail, allLabels: allLabelNames }, { status: 400 });
    }

    // Fetch all emails with the 7729 bids label
    const allMessages: { id?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        labelIds: [label.id],
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
        // Step 1: fetch message
        let full;
        try {
          full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
        } catch (e) {
          errors.push(`[gmail-get] ${String(e).slice(0, 80)}`);
          continue;
        }

        const payload = full.data.payload!;
        const headers = payload.headers ?? [];
        const subject = headers.find(h => h.name === "Subject")?.value ?? "";
        const from = headers.find(h => h.name === "From")?.value ?? "";
        const pdfParts = extractPdfParts(payload);

        // Skip emails with no PDF — those are just correspondence threads
        if (pdfParts.length === 0) {
          // Mark as processed so we don't revisit, but don't save a bid card
          await prisma.subBid.create({
            data: {
              clientId: params.clientId,
              companyId: params.companyId,
              divisionCode: "00",
              divisionName: "Correspondence",
              contractorName: null,
              amount: null,
              notes: null,
              fileUrl: `gmail:${msg.id}`,
              fileName: null,
              status: "EXCLUDED",
              emailSource: toAscii(from),
              isPlaceholder: true,
            },
          });
          continue;
        }

        const safeSubject = toAscii(subject);
        const safeFrom = toAscii(from);

        // Step 2: Download PDF attachment
        let pdfBase64: string | null = null;
        const pdfPart = pdfParts[0];
        if (pdfPart.body?.attachmentId) {
          try {
            const attRes = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: msg.id!,
              id: pdfPart.body.attachmentId,
            });
            pdfBase64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
          } catch (e) {
            errors.push(`[pdf-dl] ${String(e).slice(0, 60)}`);
          }
        }

        // Step 3: AI extraction via direct fetch (bypasses SDK ByteString issues)
        let parsed: { divisionCode?: string | null; contractorName?: string; amount?: number | null; notes?: string } = {};
        try {
          const prompt = `You are helping a general contractor organize subcontractor bids for project: ${client.name}.

EMAIL FROM: ${safeFrom}
SUBJECT: ${safeSubject}
ATTACHED PDF: ${pdfPart.filename ?? "bid proposal"}

AVAILABLE CSI DIVISIONS:
${divisionList}

${pdfBase64 ? "Read the attached PDF and extract:" : "Extract from the email subject/sender:"}
1. Which CSI division best describes the work (use the 2-digit code)?
2. Bid amount (number only, no $)?
3. Contractor/company name?
4. One sentence describing the scope.

Respond ONLY with valid JSON, no markdown:
{"divisionCode":"<2-digit code>","contractorName":"<name>","amount":<number or null>,"notes":"<one sentence>"}`;

          const contentBlocks: unknown[] = [];
          if (pdfBase64) {
            contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
          }
          contentBlocks.push({ type: "text", text: prompt });

          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": safeApiKey,
              "anthropic-version": "2023-06-01",
              ...(pdfBase64 ? { "anthropic-beta": "pdfs-2024-09-25" } : {}),
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              messages: [{ role: "user", content: contentBlocks }],
            }),
          });
          const aiJson = await aiRes.json() as { content?: { type: string; text: string }[]; error?: { message: string } };
          if (aiJson.error) throw new Error(aiJson.error.message);
          const aiText = aiJson.content?.[0]?.type === "text" ? aiJson.content[0].text.trim() : "{}";
          parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
        } catch (e) {
          errors.push(`[ai] ${String(e).slice(0, 80)}`);
        }

        const divCode = parsed.divisionCode ?? "01";
        const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

        const fileUrl = `gmail:${msg.id}:${pdfPart.body?.attachmentId ?? ""}`;
        const fileName = pdfPart.filename ?? null;

        await prisma.subBid.create({
          data: {
            clientId: params.clientId,
            companyId: params.companyId,
            divisionCode: division.code,
            divisionName: division.name,
            contractorName: parsed.contractorName ?? safeFrom,
            amount: parsed.amount ?? null,
            notes: parsed.notes ?? safeSubject,
            fileUrl,
            fileName,
            status: "RECEIVED",
            emailSource: safeFrom,
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
      gmailEmail,
      labelId: label.id,
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
