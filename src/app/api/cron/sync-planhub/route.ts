/**
 * GET /api/cron/sync-planhub
 *
 * Automatically pulls all PlanHub bid notification emails and saves them to the
 * TRIAGE bucket. No project matching — user assigns from the Subs page.
 *
 * Called by Vercel Cron every few hours. Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMPANY_ID = process.env.COMPANY_ID ?? "cmme9q6fg0000hriagrothwrc";

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

    // Load already-imported gmail msg IDs to dedup
    const existingBids = await prisma.subBid.findMany({
      where: { companyId: COMPANY_ID, fileUrl: { startsWith: "gmail:" } },
      select: { fileUrl: true },
    });
    const processedMsgIds = new Set(
      existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
    );

    // Pull all PlanHub emails going back 5 years — no label needed
    const allMessages: { id?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: "from:projectnotification@planhub.com after:2021/01/01",
        maxResults: 100,
        pageToken,
      });
      allMessages.push(...(listRes.data.messages ?? []));
      pageToken = listRes.data.nextPageToken ?? undefined;
    } while (pageToken && allMessages.length < 2000);

    const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
    const toProcess = newMessages.slice(0, 50); // process up to 50 per cron run

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

        const safeSubject = toAscii(subject);
        const safeBody = toAscii(bodyText).slice(0, 3000);

        const prompt = `You are parsing a PlanHub bid notification email for a general contractor.

FROM: ${toAscii(from)}
SUBJECT: ${safeSubject}
BODY:
${safeBody}

AVAILABLE CSI DIVISIONS:
${divisionList}

Extract bid info. Respond ONLY with valid JSON, no markdown:
{
  "isBidNotification": true or false,
  "contractorName": "<company that submitted the bid, or null>",
  "divisionCode": "<2-digit CSI code best matching the trade, or null>",
  "amount": <bid amount as number, or null if not shown>,
  "notes": "<one sentence: project name/address and scope if visible, or null>"
}`;

        const aiMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: toAscii(prompt) }],
        });

        const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
        let parsed: {
          isBidNotification?: boolean;
          contractorName?: string | null;
          divisionCode?: string | null;
          amount?: number | null;
          notes?: string | null;
        };
        try {
          parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
        } catch {
          errors.push(`JSON parse failed: "${safeSubject.slice(0, 50)}"`);
          continue;
        }

        if (!parsed.isBidNotification) {
          skipped++;
          continue;
        }

        const divCode = parsed.divisionCode ?? "07";
        const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

        const fileUrl = pdfParts.length > 0
          ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
          : `gmail:${msg.id}`;
        const fileName = pdfParts[0]?.filename ?? null;

        // Extract richer data from PDF attachment at sync time
        let bidDate: string | null = null;
        if (pdfParts.length > 0 && pdfParts[0].body?.attachmentId) {
          try {
            const attRes = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: msg.id!,
              id: pdfParts[0].body.attachmentId,
            });
            const pdfBase64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
            if (pdfBase64) {
              const pdfRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
                  "anthropic-version": "2023-06-01",
                  "anthropic-beta": "pdfs-2024-09-25",
                },
                body: JSON.stringify({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 400,
                  messages: [{
                    role: "user",
                    content: [
                      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                      {
                        type: "text",
                        text: `Extract from this subcontractor bid/proposal PDF. Respond ONLY with valid JSON, no markdown:
{
  "contractorName": "<company name that submitted this bid>",
  "contractorAddress": "<full address of the bidding company, or null>",
  "contractorPhone": "<phone number, or null>",
  "contractorEmail": "<email address, or null>",
  "amount": <grand total as number or null>,
  "date": "<proposal/bid date as YYYY-MM-DD or null>",
  "scope": "<one sentence describing the scope of work>"
}`,
                      },
                    ],
                  }],
                }),
              });
              const pdfJson = await pdfRes.json() as { content?: { type: string; text: string }[] };
              const pdfText = pdfJson.content?.[0]?.type === "text" ? pdfJson.content[0].text.trim() : "{}";
              const pdfData = JSON.parse(pdfText.replace(/```json\n?|\n?```/g, ""));
              if (pdfData.amount != null && Number(pdfData.amount) > 0) parsed.amount = Number(pdfData.amount);
              if (pdfData.date && pdfData.date !== "null") bidDate = String(pdfData.date);
              if (pdfData.contractorName) parsed.contractorName = pdfData.contractorName;
              if (pdfData.scope) parsed.notes = pdfData.scope;
            }
          } catch (e) {
            errors.push(`[pdf] ${String(e).slice(0, 60)}`);
          }
        }

        await prisma.subBid.create({
          data: {
            clientId: null,
            companyId: COMPANY_ID,
            divisionCode: division.code,
            divisionName: division.name,
            contractorName: parsed.contractorName ?? null,
            amount: parsed.amount ?? null,
            notes: parsed.notes ?? safeSubject.slice(0, 200),
            fileUrl,
            fileName,
            status: "TRIAGE",
            emailSource: safeSubject || from,
            isPlaceholder: false,
            bidDate: bidDate,
          },
        });
        added++;
      } catch (err) {
        errors.push(String(err).slice(0, 100));
      }
    }

    return NextResponse.json({
      total: allMessages.length,
      new: newMessages.length,
      processed: toProcess.length,
      added,
      skipped,
      remaining: Math.max(0, newMessages.length - toProcess.length),
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("sync-planhub fatal:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
