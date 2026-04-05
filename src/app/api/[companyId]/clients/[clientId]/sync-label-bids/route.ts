/**
 * POST /api/[companyId]/clients/[clientId]/sync-label-bids
 *
 * Pulls every email tagged "7729 bids" in Gmail, assigns all bids to this
 * specific client (no AI client-matching needed), uses AI only to extract
 * division / contractor / amount / notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

export const runtime = "nodejs";
export const maxDuration = 120;

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

const PDF_MIMES = new Set(["application/pdf"]);
const WORD_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPdf(p: any) {
  return PDF_MIMES.has(p.mimeType) ||
    (p.mimeType === "application/octet-stream" && p.filename?.match(/\.pdf$/i)) ||
    p.filename?.match(/\.pdf$/i);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isWord(p: any) {
  return WORD_MIMES.has(p.mimeType) ||
    (p.mimeType === "application/octet-stream" && p.filename?.match(/\.docx?$/i)) ||
    p.filename?.match(/\.docx?$/i);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAttachment(p: any) { return isPdf(p) || isWord(p); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAttachmentParts(payload: any): any[] {
  if (!payload) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  if (isAttachment(payload)) results.push(payload);
  if (payload.parts) for (const p of payload.parts) results.push(...extractAttachmentParts(p));
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
    const safeApiKey = (process.env.ANTHROPIC_API_KEY ?? "").replace(/[^\x20-\x7E]/g, "").trim();

    // Get already-imported gmail msg IDs to deduplicate (exclude EXCLUDED placeholders so PDF emails can be retried)
    const existingBids = await prisma.subBid.findMany({
      where: { clientId: params.clientId, fileUrl: { startsWith: "gmail:" }, status: { not: "EXCLUDED" } },
      select: { fileUrl: true },
    });
    const processedMsgIds = new Set(
      existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
    );

    // Resolve the "7729 bids" label ID dynamically — try exact match first, then partial
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const allLabels = labelsRes.data.labels ?? [];
    const label =
      allLabels.find(l => l.name?.toLowerCase() === "7729 bids") ??
      allLabels.find(l => l.name?.toLowerCase().includes("7729") && l.name?.toLowerCase().includes("bid"));
    if (!label?.id) {
      const allLabelNames = allLabels.map(l => l.name).filter(Boolean) ?? [];
      return NextResponse.json({ error: "Gmail label '7729 bids' not found", allLabels: allLabelNames }, { status: 400 });
    }

    // Fetch only emails tagged with the "7729 bids" label — no keyword guessing
    const allMessages: { id?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        labelIds: [label.id],
        pageToken,
      });
      for (const m of listRes.data.messages ?? []) {
        if (m.id) allMessages.push(m);
      }
      pageToken = listRes.data.nextPageToken ?? undefined;
    } while (pageToken && allMessages.length < 500);

    const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
    const toProcess = newMessages.slice(0, 25); // 25 emails max per sync (Word docs skip AI so they're fast)

    const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

    let added = 0;
    let pdfsLoaded = 0;
    let aiSample = "";
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
        const attachmentParts = extractAttachmentParts(payload);

        const safeSubject = toAscii(subject);
        const safeFrom = toAscii(from);

        // Skip emails with no recognized attachment (PDF or Word)
        if (attachmentParts.length === 0) continue;

        // Process the first attachment (PDF preferred, then Word)
        const pdfPart = attachmentParts.find(p => isPdf(p)) ?? attachmentParts[0];
        const isWordDoc = !isPdf(pdfPart) && isWord(pdfPart);

        // Step 2: Download PDF attachment (only for PDFs — Word docs not sent to Claude)
        let pdfBase64: string | null = null;
        if (!isWordDoc) {
          if (pdfPart.body?.attachmentId) {
            try {
              const attRes = await gmail.users.messages.attachments.get({
                userId: "me",
                messageId: msg.id!,
                id: pdfPart.body.attachmentId,
              });
              pdfBase64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
              if (pdfBase64) pdfsLoaded++;
            } catch (e) {
              errors.push(`[pdf-dl] ${String(e).slice(0, 60)}`);
            }
          } else if (pdfPart.body?.data) {
            pdfBase64 = pdfPart.body.data.replace(/-/g, "+").replace(/_/g, "/");
            pdfsLoaded++;
          }
        }

        // Step 3: AI extraction — only for PDFs (Word docs go straight to triage)
        let parsed: { divisionCode?: string | null; contractorName?: string; amount?: number | null; notes?: string; date?: string | null } = {};
        if (!isWordDoc) {
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
5. Date of the bid/proposal as "Mon DD, YYYY" (e.g. "Mar 20, 2026"), or null if not found.

Respond ONLY with valid JSON, no markdown:
{"divisionCode":"<2-digit code>","contractorName":"<name>","amount":<number or null>,"notes":"<one sentence>","date":"<Mon DD, YYYY or null>"}`;

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
                "anthropic-beta": "pdfs-2024-09-25",
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
            if (!aiSample) aiSample = aiText.slice(0, 120);
            parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
          } catch (e) {
            errors.push(`[ai] ${String(e).slice(0, 80)}`);
          }
        }

        const divCode = parsed.divisionCode && STANDARD_DIVISIONS.find(d => d.code === parsed.divisionCode)
          ? parsed.divisionCode
          : null;
        // Word docs and unclassified PDFs go to triage
        const division = divCode
          ? STANDARD_DIVISIONS.find(d => d.code === divCode)!
          : { code: "00", name: "Triage" };

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
            bidDate: (parsed.date && parsed.date !== "null") ? parsed.date : null,
          },
        });

        added++;
      } catch (err) {
        errors.push(String(err).slice(0, 100));
      }
    }

    const remaining = Math.max(0, newMessages.length - toProcess.length);

    return NextResponse.json({
      labelId: label.id,
      found: allMessages.length,
      newUnprocessed: newMessages.length,
      processed: toProcess.length,
      added,
      pdfsLoaded,
      aiSample,
      remaining,
      errors: errors.slice(0, 5),
    });
  } catch (err) {
    console.error("Label sync fatal error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}
