/**
 * POST /api/[companyId]/fetch-leads
 * Fetches emails from info@emailings.mibhconstruction-services.com,
 * parses contact info with Claude, and stores them as Lead records.
 *
 * Body (optional):
 *   { backfill: true }  → scans ALL historical emails (no date limit)
 *   (default)           → only emails not yet imported
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const LEAD_SENDER = "info@emailings.mibhconstruction-services.com";
const GMAIL_QUERY = `from:${LEAD_SENDER}`;

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
    const allParts: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collect = (parts: any[]) => { for (const p of parts) { allParts.push(p); if (p.parts) collect(p.parts); } };
    collect(payload.parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = allParts.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data).toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = allParts.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).toString("utf-8").replace(/<[^>]+>/g, " ");
  }
  return "";
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

  const body = await req.json().catch(() => ({}));
  const backfill = !!(body as { backfill?: boolean }).backfill;

  const authClient = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: authClient });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Paginate through ALL matching messages
  const allMessages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: GMAIL_QUERY,
      maxResults: 500,
      pageToken,
    });
    allMessages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken);

  // Bulk dedup — get all already-imported gmail IDs
  const existing = await prisma.lead.findMany({
    where: { companyId: params.companyId, gmailMsgId: { not: null } },
    select: { gmailMsgId: true },
  });
  const importedIds = new Set(existing.map(l => l.gmailMsgId!));

  const newMessages = allMessages.filter(m => m.id && !importedIds.has(m.id));
  // For backfill: process everything; for normal: cap at 50 to stay under timeout
  const toProcess = backfill ? newMessages : newMessages.slice(0, 50);

  let added = 0;
  const errors: string[] = [];

  for (const msg of toProcess) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const dateHeader = headers.find(h => h.name === "Date")?.value;
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      const bodyText = extractBody(payload);

      const prompt = `You are parsing a lead inquiry email received by a construction company (MIBH Construction).

FROM: ${from}
SUBJECT: ${subject}
EMAIL BODY:
${bodyText.slice(0, 3000)}

Extract the contact information from this lead/inquiry email. Respond ONLY with valid JSON, no markdown:
{
  "name": "<full name of the person inquiring, or null>",
  "email": "<their reply-to email address, or null>",
  "phone": "<their phone number, or null>",
  "address": "<property/project address if mentioned, or null>",
  "city": "<city, or null>",
  "state": "<state abbreviation, or null>",
  "projectType": "<type of work requested e.g. Kitchen Remodel, Bathroom Addition, Roofing, etc., or null>",
  "message": "<brief summary of what they are requesting, max 200 chars>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        projectType?: string | null;
        message?: string | null;
      };
      try {
        parsed = JSON.parse(aiText);
      } catch {
        errors.push(`parse-error on ${msg.id}`);
        continue;
      }

      await prisma.lead.create({
        data: {
          companyId: params.companyId,
          gmailMsgId: msg.id!,
          emailFrom: from,
          emailSubject: subject,
          receivedAt,
          source: "email",
          status: "NEW",
          name: parsed.name ?? null,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          address: parsed.address ?? null,
          city: parsed.city ?? null,
          state: parsed.state ?? null,
          projectType: parsed.projectType ?? null,
          message: parsed.message ?? null,
        },
      });

      added++;
    } catch (err) {
      errors.push(String(err));
    }
  }

  return NextResponse.json({
    found: allMessages.length,
    alreadyImported: importedIds.size,
    processed: toProcess.length,
    added,
    remaining: backfill ? 0 : Math.max(0, newMessages.length - toProcess.length),
    errors: errors.slice(0, 10),
  });
}
