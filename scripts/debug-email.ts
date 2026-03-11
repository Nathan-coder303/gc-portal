/**
 * Debug a specific email to see what Claude sees and returns.
 * Run: npx tsx scripts/debug-email.ts
 */
import "dotenv/config";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STANDARD_DIVISIONS } from "../src/lib/divisions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GMAIL_QUERY = "NEW Bid Proposal 7729 Carlyle";

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
      for (const p of parts) { allParts.push(p); if (p.parts) collectParts(p.parts); }
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
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const clients = await prisma.client.findMany({
    select: { id: true, companyId: true, name: true, address: true, city: true, state: true },
  });
  const projects = await prisma.project.findMany({
    select: { id: true, companyId: true, name: true, address: true, city: true, state: true },
  });

  const listRes = await gmail.users.messages.list({ userId: "me", q: GMAIL_QUERY, maxResults: 3 });
  const messages = listRes.data.messages ?? [];
  console.log(`Found ${messages.length} emails\n`);

  for (const msg of messages.slice(0, 2)) {
    const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
    const payload = full.data.payload!;
    const headers = payload.headers ?? [];
    const subject = headers.find(h => h.name === "Subject")?.value ?? "";
    const from = headers.find(h => h.name === "From")?.value ?? "";
    const bodyText = extractBody(payload);

    console.log("═".repeat(60));
    console.log(`SUBJECT: ${subject}`);
    console.log(`FROM: ${from}`);
    console.log(`\nBODY (first 2000 chars):\n${bodyText.slice(0, 2000)}`);
    console.log("\n" + "─".repeat(60));

    const clientList = clients.map(c =>
      `CLIENT:${c.id} | ${c.name} | ${[c.address, c.city, c.state].filter(Boolean).join(", ")}`
    ).join("\n");
    const projectList = projects.map(p =>
      `PROJECT:${p.id} | ${p.name} | ${[p.address, p.city, p.state].filter(Boolean).join(", ")}`
    ).join("\n");
    const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

    const aiMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: `Parse this bid email. Return JSON only.\n\nFROM: ${from}\nSUBJECT: ${subject}\nBODY:\n${bodyText.slice(0, 4000)}\n\nCLIENTS:\n${clientList}\n\nPROJECTS:\n${projectList}\n\nDIVISIONS:\n${divisionList}\n\n{"clientId":null,"divisionCode":null,"contractorName":null,"amount":null,"notes":null}` }],
    });

    const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
    console.log(`\nAI RESPONSE:\n${aiText}\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
