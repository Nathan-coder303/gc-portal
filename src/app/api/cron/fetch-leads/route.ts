/**
 * GET /api/cron/fetch-leads — runs daily at 8am.
 * Picks up new emails from info@emailings.mibhconstruction-services.com.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const COMPANY_ID = "cmmij161r000004jm8il8bd0e";
const LEAD_SENDER = "info@emailings.mibhconstruction-services.com";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allParts: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collect = (parts: any[]) => { for (const p of parts) { allParts.push(p); if (p.parts) collect(p.parts); } };
    collect(payload.parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = allParts.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = allParts.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function field(text: string, key: string): string | null {
  const pattern = new RegExp(`${key}:\\s*([^\\n]+?)(?=\\s+(?:Name|Email|Phone|Service|Address|City|State|Message):|$)`, "i");
  const m = text.match(pattern);
  const val = m?.[1]?.trim().replace(/\s+/g, " ") ?? null;
  return val && val.length > 0 && val !== "N/A" ? val : null;
}

function parseLead(subject: string, body: string) {
  const source = `${subject}\n${body}`;
  const name = field(source, "Name");
  const email = field(source, "Email");
  const phone = field(source, "Phone");
  const address = field(source, "Address");
  const city = field(source, "City");
  const state = field(source, "State");
  const service = field(source, "Service");
  const msg = field(source, "Message");

  if (!name && !phone) {
    const cb = source.match(/give\s+(.+?)\s+a\s+call\s+at\s+([\d\s().+\-]+)/i);
    if (cb) return { name: cb[1].trim(), email: null, phone: cb[2].trim(), address, city, state, projectType: service, message: subject.slice(0, 200) };
  }
  return { name, email, phone, address, city, state, projectType: service, message: msg ?? subject.slice(0, 200) };
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

  const since = Math.floor(Date.now() / 1000) - 86400;
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `from:${LEAD_SENDER} after:${since}`,
    maxResults: 100,
  });
  const messages = listRes.data.messages ?? [];
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
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const dateHeader = headers.find(h => h.name === "Date")?.value;
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      const bodyText = extractBody(payload);
      const parsed = parseLead(subject, bodyText);

      await prisma.lead.create({
        data: {
          companyId: COMPANY_ID,
          gmailMsgId: msg.id!,
          emailFrom: from, emailSubject: subject, receivedAt,
          source: "email", status: "NEW",
          name: parsed.name, email: parsed.email, phone: parsed.phone,
          address: parsed.address, city: parsed.city, state: parsed.state,
          projectType: parsed.projectType, message: parsed.message,
        },
      });
      added++;
    } catch (err) { errors.push(String(err)); }
  }

  return NextResponse.json({ checked: messages.length, added, errors: errors.slice(0, 5) });
}
