import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { STANDARD_DIVISIONS } from "@/lib/divisions";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gmail search query — picks up emails likely to contain sub bids (no is:unread so we don't miss already-opened emails)
const GMAIL_QUERY = "has:attachment filename:pdf (bid OR estimate OR proposal OR quote)";

function decodeBase64(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Recursively find all PDF parts (handles nested multipart emails)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data).toString("utf-8");
  if (payload.parts) {
    // Recursively search all parts — prefer text/plain
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailAuth = await getGmailOAuth(process.env.SMS_COMPANY_ID);
  const gmail = google.gmail({ version: "v1", auth: gmailAuth });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch all clients and their addresses for matching
  const clients = await prisma.client.findMany({
    select: { id: true, companyId: true, name: true, address: true, city: true, state: true },
  });

  // Search Gmail — paginate to get all matching messages
  const messages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: GMAIL_QUERY,
      maxResults: 100,
      pageToken,
    });
    messages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken && messages.length < 500);

  const results: { subject: string; status: string; client?: string; division?: string; amount?: number; error?: string }[] = [];

  for (const msg of messages) {
    try {
      // Dedup: skip messages already imported
      const existing = await prisma.subBid.findFirst({
        where: { fileUrl: { startsWith: `gmail:${msg.id}` } },
      });
      if (existing) continue;

      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;

      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);

      // Recursively find PDF attachments (handles nested multipart emails)
      const pdfParts = extractPdfParts(payload);

      const clientList = clients.map(c =>
        `ID:${c.id} | ${c.name} | ${[c.address, c.city, c.state].filter(Boolean).join(", ")}`
      ).join("\n");

      const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

      const prompt = `You are parsing a construction subcontractor bid email to extract bid details.

FROM: ${from}
SUBJECT: ${subject}
EMAIL BODY:
${bodyText.slice(0, 2000)}

AVAILABLE CLIENTS (match by address/name in subject or body):
${clientList}

AVAILABLE DIVISIONS (pick the best match for this trade/scope):
${divisionList}

Extract the following and respond ONLY with valid JSON, no markdown:
{
  "clientId": "<client ID from the list above, or null if unclear>",
  "divisionCode": "<2-digit code from list above, or null if unclear>",
  "contractorName": "<company or person sending the bid>",
  "amount": <number without $ or commas, or null if not found>,
  "notes": "<brief 1-sentence summary of scope if mentioned>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: { clientId?: string; divisionCode?: string; contractorName?: string; amount?: number | null; notes?: string };
      try {
        parsed = JSON.parse(aiText);
      } catch {
        results.push({ subject, status: "parse-error" });
        continue;
      }

      if (!parsed.clientId || !parsed.divisionCode) {
        results.push({ subject, status: "skipped-no-match" });
        // Mark as read so we don't reprocess
        await gmail.users.messages.modify({ userId: "me", id: msg.id!, requestBody: { removeLabelIds: ["UNREAD"] } });
        continue;
      }

      const client = clients.find(c => c.id === parsed.clientId);
      const division = STANDARD_DIVISIONS.find(d => d.code === parsed.divisionCode);

      if (!client || !division) {
        results.push({ subject, status: "skipped-invalid-ref" });
        continue;
      }

      // Always store msg ID in fileUrl for dedup on future runs
      const fileUrl = pdfParts.length > 0
        ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
        : `gmail:${msg.id}`;
      const fileName = pdfParts[0]?.filename ?? null;

      await prisma.subBid.create({
        data: {
          clientId: client.id,
          companyId: client.companyId,
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

      // Mark email as read so we don't reprocess it
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id!,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });

      results.push({
        subject,
        status: "ok",
        client: client.name,
        division: division.name,
        amount: parsed.amount ?? undefined,
      });
    } catch (err) {
      results.push({ subject: msg.id ?? "?", status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
