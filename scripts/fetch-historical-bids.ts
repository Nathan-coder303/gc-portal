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

// Search since 02/28/2026, all bid-related emails with PDF attachments
const GMAIL_QUERY = "has:attachment filename:pdf (bid OR estimate OR proposal OR quote OR subcontractor) after:2026/02/28";

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
  if (payload?.body?.data) return decodeBase64(payload.body.data).toString("utf-8");
  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data)
        return decodeBase64(part.body.data).toString("utf-8");
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data)
        return decodeBase64(part.body.data).toString("utf-8").replace(/<[^>]+>/g, " ");
    }
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

      const prompt = `You are parsing a construction subcontractor bid email to extract bid details.

FROM: ${from}
SUBJECT: ${subject}
EMAIL BODY:
${bodyText.slice(0, 4000)}

AVAILABLE CLIENTS (match by address, name, or project name in subject/body):
${clientList}

AVAILABLE PROJECTS (use these to help identify the job site):
${projectList}

AVAILABLE DIVISIONS (pick the best match for this trade/scope):
${divisionList}

Instructions:
- Match the email to a CLIENT by comparing the job address, project name, or client name mentioned in the email
- If you find a project match, look for a client with the same address
- Return the clientId from the CLIENT list (starts with CLIENT:)

Extract and respond ONLY with valid JSON, no markdown:
{
  "clientId": "<client ID from CLIENT list, or null if unclear>",
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

      await prisma.subBid.upsert({
        where: { clientId_divisionCode: { clientId: client.id, divisionCode: division.code } },
        create: {
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
        },
        update: {
          contractorName: parsed.contractorName ?? from,
          amount: parsed.amount ?? null,
          notes: parsed.notes ?? null,
          fileUrl,
          fileName,
          status: "RECEIVED",
          emailSource: from,
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
