/**
 * GET /api/cron/fetch-leads
 * Called by Vercel Cron every 10 minutes.
 * Picks up new emails from info@emailings.mibhconstruction-services.com
 * and stores them as Lead records for MIBH.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMPANY_ID = "cmmij161r000004jm8il8bd0e";
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Gmail credentials not configured" }, { status: 500 });
  }

  const authClient = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: authClient });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Only look at emails from the last 24h to keep the cron fast
  const since = Math.floor(Date.now() / 1000) - 86400;
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `${GMAIL_QUERY} after:${since}`,
    maxResults: 50,
  });
  const messages = listRes.data.messages ?? [];

  // Dedup against already-imported IDs
  const msgIds = messages.map(m => m.id!).filter(Boolean);
  const existing = await prisma.lead.findMany({
    where: { gmailMsgId: { in: msgIds } },
    select: { gmailMsgId: true },
  });
  const importedIds = new Set(existing.map(l => l.gmailMsgId!));
  const newMessages = messages.filter(m => m.id && !importedIds.has(m.id));

  let added = 0;
  const errors: string[] = [];

  for (const msg of newMessages) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const dateHeader = headers.find(h => h.name === "Date")?.value;
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      const bodyText = extractBody(payload);

      const prompt = `You are parsing a lead inquiry email received by MIBH Construction.

FROM: ${from}
SUBJECT: ${subject}
EMAIL BODY:
${bodyText.slice(0, 3000)}

Extract contact info. Respond ONLY with valid JSON, no markdown:
{
  "name": "<full name or null>",
  "email": "<their email or null>",
  "phone": "<phone number or null>",
  "address": "<property address or null>",
  "city": "<city or null>",
  "state": "<state abbreviation or null>",
  "projectType": "<type of work e.g. Kitchen Remodel, Roofing, Addition, etc. or null>",
  "message": "<brief summary max 200 chars>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: {
        name?: string | null; email?: string | null; phone?: string | null;
        address?: string | null; city?: string | null; state?: string | null;
        projectType?: string | null; message?: string | null;
      };
      try { parsed = JSON.parse(aiText); } catch { errors.push(`parse-error ${msg.id}`); continue; }

      await prisma.lead.create({
        data: {
          companyId: COMPANY_ID,
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

  return NextResponse.json({ checked: messages.length, added, errors: errors.slice(0, 5) });
}
