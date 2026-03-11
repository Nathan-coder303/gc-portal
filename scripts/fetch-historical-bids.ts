/**
 * One-time script to fetch ALL historical bid emails (read + unread)
 * and match them against clients AND projects by name/address.
 *
 * Run: npx tsx scripts/fetch-historical-bids.ts
 */

import "dotenv/config";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STANDARD_DIVISIONS } from "../src/lib/divisions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Search all bid-related emails with PDF attachments (no date limit)
const GMAIL_QUERY = "has:attachment filename:pdf (bid OR estimate OR proposal OR quote OR subcontractor)";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:4000/callback"
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
    function collectParts(parts: any[]) {
      for (const p of parts) {
        allParts.push(p);
        if (p.parts) collectParts(p.parts);
      }
    }
    collectParts(payload.parts);
    const plain = allParts.find(p => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data).toString("utf-8");
    const html = allParts.find(p => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).toString("utf-8").replace(/<[^>]+>/g, " ");
  }
  return "";
}

async function main() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("❌ Missing Google credentials in .env");
    process.exit(1);
  }

  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch clients
  const clients = await prisma.client.findMany({
    select: { id: true, companyId: true, name: true, address: true, city: true, state: true },
  });

  // Fetch projects (to help match by project name/address)
  const projects = await prisma.project.findMany({
    select: { id: true, companyId: true, name: true, address: true, city: true, state: true },
  });

  // Build a combined reference list: clients + projects (with their companyId)
  // We'll try to map project matches back to a client by address
  const clientList = clients.map(c =>
    `CLIENT:${c.id} | ${c.name} | ${[c.address, c.city, c.state].filter(Boolean).join(", ")}`
  ).join("\n");

  const projectList = projects.map(p =>
    `PROJECT:${p.id} | ${p.name} | ${[p.address, p.city, p.state].filter(Boolean).join(", ")}`
  ).join("\n");

  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  console.log(`\n📋 Loaded ${clients.length} clients, ${projects.length} projects`);
  console.log(`🔍 Searching Gmail for historical bid emails...\n`);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: GMAIL_QUERY,
    maxResults: 200,
  });

  const messages = listRes.data.messages ?? [];
  console.log(`📬 Found ${messages.length} emails to process\n`);

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;

      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);

      const pdfParts = (payload.parts ?? []).filter(
        p => p.mimeType === "application/pdf" || p.filename?.endsWith(".pdf")
      );

      const prompt = `Parse this construction bid email. Output ONLY a JSON object — no explanation, no markdown, no extra text.

FROM: ${from}
SUBJECT: ${subject}
BODY:
${bodyText.slice(0, 4000)}

CLIENTS (format: CLIENT:<id> | <name> | <address>):
${clientList}

PROJECTS (use to identify job site, then find matching client):
${projectList}

DIVISIONS (format: <code> - <name>):
${divisionList}

Rules:
- clientId: exact ID string from CLIENT list (e.g. "cm123abc") or null
- divisionCode: 2-digit string from DIVISIONS (e.g. "03") or null
- contractorName: company/person name from FROM field or email body
- amount: numeric value only (no $ or commas) or null
- notes: one sentence about scope or null

Output exactly this JSON and nothing else:
{"clientId":null,"divisionCode":null,"contractorName":null,"amount":null,"notes":null}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const rawText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      // Strip markdown code fences if present
      const aiText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      let parsed: { clientId?: string; divisionCode?: string; contractorName?: string; amount?: number | null; notes?: string };
      try {
        parsed = JSON.parse(aiText);
      } catch {
        console.log(`  ⚠️  [${subject.slice(0, 50)}] — JSON parse error`);
        errors++;
        continue;
      }

      if (!parsed.clientId || !parsed.divisionCode) {
        console.log(`  ⏭️  [${subject.slice(0, 50)}] — no client/division match`);
        skipped++;
        continue;
      }

      const client = clients.find(c => c.id === parsed.clientId);
      const division = STANDARD_DIVISIONS.find(d => d.code === parsed.divisionCode);

      if (!client || !division) {
        console.log(`  ⏭️  [${subject.slice(0, 50)}] — invalid client/division ref`);
        skipped++;
        continue;
      }

      const fileUrl = pdfParts.length > 0
        ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
        : null;
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

      console.log(`  ✅ [${subject.slice(0, 50)}] → ${client.name} / ${division.name}${parsed.amount ? ` / $${parsed.amount.toLocaleString()}` : ""}`);
      saved++;

    } catch (err) {
      console.log(`  ❌ [${msg.id}] — ${String(err)}`);
      errors++;
    }
  }

  console.log(`\n📊 Done: ${saved} saved, ${skipped} skipped, ${errors} errors`);
  await prisma.$disconnect();
}

main().catch(console.error);
