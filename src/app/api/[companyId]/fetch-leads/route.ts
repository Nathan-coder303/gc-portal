/**
 * POST /api/[companyId]/fetch-leads
 * Fetches emails from info@emailings.mibhconstruction-services.com,
 * parses contact info from the structured subject line (no Claude needed),
 * and stores them as Lead records.
 *
 * Body: { backfill: true } → import all history, default → new only
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  // Match "Key: value" up to the next known key or end of string
  const pattern = new RegExp(`${key}:\\s*([^\\n]+?)(?=\\s+(?:Name|Email|Phone|Service|Address|City|State|Message):|$)`, "i");
  const m = text.match(pattern);
  const val = m?.[1]?.trim().replace(/\s+/g, " ") ?? null;
  return val && val.length > 0 && val !== "N/A" ? val : null;
}

interface ParsedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  projectType: string | null;
  message: string | null;
}

function parseLead(subject: string, body: string): ParsedLead {
  // The emails use a structured format: "Name: X Email: Y Phone: Z Service: W"
  // Try subject first (it's already pre-truncated by Gmail but full in the API)
  // then fall back to body which has the same fields
  const source = `${subject}\n${body}`;

  const name = field(source, "Name");
  const email = field(source, "Email");
  const phone = field(source, "Phone");
  const address = field(source, "Address");
  const city = field(source, "City");
  const state = field(source, "State");
  const service = field(source, "Service");
  const msg = field(source, "Message");

  // Callback alert format: "give [Name] a call at [Phone]"
  if (!name && !phone) {
    const callbackMatch = source.match(/give\s+(.+?)\s+a\s+call\s+at\s+([\d\s().+\-]+)/i);
    if (callbackMatch) {
      return {
        name: callbackMatch[1].trim(),
        email: null,
        phone: callbackMatch[2].trim(),
        address, city, state,
        projectType: service,
        message: subject.replace(/^NSA New Callback Alert\s*[-–]\s*/i, "").trim() || null,
      };
    }
  }

  return {
    name,
    email,
    phone,
    address,
    city,
    state,
    projectType: service,
    message: msg ?? (subject.length > 20 ? subject.slice(0, 200) : null),
  };
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

  const authClient = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth: authClient });

  // Fetch one page of message IDs only (no pagination) to stay within
  // Vercel Hobby's 10-second function timeout.
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: GMAIL_QUERY,
    maxResults: 200,
  });
  const allMessages = listRes.data.messages ?? [];

  // Bulk dedup — collect all processed msg IDs (primary + linked)
  const existingLeads = await prisma.lead.findMany({
    where: { companyId: params.companyId },
    select: { id: true, gmailMsgId: true, linkedMsgIds: true, name: true, email: true, phone: true, address: true, city: true, state: true, projectType: true, message: true },
  });
  const importedIds = new Set<string>([
    ...existingLeads.map(l => l.gmailMsgId).filter(Boolean) as string[],
    ...existingLeads.flatMap(l => (l.linkedMsgIds ?? "").split(" ").filter(Boolean)),
  ]);
  // Name-to-lead map for merge detection
  const byName = new Map(existingLeads.filter(l => l.name).map(l => [l.name!.toLowerCase().trim(), l]));

  const newMessages = allMessages.filter(m => m.id && !importedIds.has(m.id));
  // Process 5 per call — Vercel Hobby has a hard 10s timeout.
  // Each Gmail full-message fetch ~300-500ms; 5 = ~2-3s, safely within limit.
  const toProcess = newMessages.slice(0, 5);

  let added = 0;
  let merged = 0;
  const errors: string[] = [];

  for (const msg of toProcess) {
    try {
      // Fetch full message (needed to get full subject — metadata truncates it)
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];

      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const dateHeader = headers.find(h => h.name === "Date")?.value;
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
      const bodyText = extractBody(payload);

      const parsed = parseLead(subject, bodyText);

      // Check for name-based duplicate
      const nameKey = parsed.name?.toLowerCase().trim();
      const existingByName = nameKey ? byName.get(nameKey) : undefined;

      if (existingByName) {
        // Merge: fill in any missing fields, append msgId to linkedMsgIds
        const linked = [existingByName.linkedMsgIds, msg.id!].filter(Boolean).join(" ");
        await prisma.lead.update({
          where: { id: existingByName.id },
          data: {
            linkedMsgIds: linked,
            email: existingByName.email ?? parsed.email,
            phone: existingByName.phone ?? parsed.phone,
            address: existingByName.address ?? parsed.address,
            city: existingByName.city ?? parsed.city,
            state: existingByName.state ?? parsed.state,
            projectType: existingByName.projectType ?? parsed.projectType,
            message: existingByName.message ?? parsed.message,
          },
        });
        // Update local map so subsequent messages for same name are also deduplicated
        importedIds.add(msg.id!);
        existingByName.linkedMsgIds = linked;
        merged++;
      } else {
        const newLead = await prisma.lead.create({
          data: {
            companyId: params.companyId,
            gmailMsgId: msg.id!,
            emailFrom: from,
            emailSubject: subject,
            receivedAt,
            source: "email",
            status: "NEW",
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            address: parsed.address,
            city: parsed.city,
            state: parsed.state,
            projectType: parsed.projectType,
            message: parsed.message,
          },
        });
        // Store email message as first note
        if (parsed.message) {
          await prisma.note.create({
            data: {
              companyId: params.companyId,
              leadId: newLead.id,
              content: parsed.message,
              noteDate: receivedAt,
            },
          });
        }
        // Add to local map for subsequent dedup in same run
        if (nameKey && parsed.name) {
          byName.set(nameKey, { id: "", gmailMsgId: msg.id!, linkedMsgIds: null, name: parsed.name, email: parsed.email, phone: parsed.phone, address: parsed.address, city: parsed.city, state: parsed.state, projectType: parsed.projectType, message: parsed.message });
        }
        added++;
      }
    } catch (err) {
      errors.push(String(err));
    }
  }

  await prisma.company.update({
    where: { id: params.companyId },
    data: { leadsLastSyncedAt: new Date() },
  });

  return NextResponse.json({
    found: allMessages.length,
    alreadyImported: importedIds.size,
    processed: toProcess.length,
    added,
    merged,
    remaining: Math.max(0, newMessages.length - toProcess.length),
    errors: errors.slice(0, 10),
  });
}
