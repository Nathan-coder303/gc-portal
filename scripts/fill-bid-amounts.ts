/**
 * For bids with null amounts and gmail PDF attachments,
 * download the PDF and use Claude to extract the dollar amount.
 *
 * Run: npx tsx scripts/fill-bid-amounts.ts
 */
import "dotenv/config";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:4000/callback"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

async function main() {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Find all bids with null amount and a gmail fileUrl
  const bids = await prisma.subBid.findMany({
    where: { amount: null, fileUrl: { startsWith: "gmail:" }, isPlaceholder: false },
    include: { client: { select: { name: true } } },
  });

  console.log(`Found ${bids.length} bids with null amount and Gmail PDF attachment\n`);

  let updated = 0;
  let failed = 0;

  for (const bid of bids) {
    const parts = bid.fileUrl!.split(":");
    const msgId = parts[1];
    const attachmentId = parts[2];

    if (!msgId || !attachmentId) {
      console.log(`  ⚠️  [${bid.contractorName ?? bid.id}] — invalid fileUrl format`);
      failed++;
      continue;
    }

    try {
      // Download the attachment
      const attRes = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: msgId,
        id: attachmentId,
      });

      const data = attRes.data.data;
      if (!data) {
        console.log(`  ⚠️  [${bid.contractorName ?? bid.id}] — no attachment data`);
        failed++;
        continue;
      }

      // Convert gmail's URL-safe base64 to standard base64
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");

      // Ask Claude to read the PDF and extract the total bid amount
      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `This is a construction subcontractor bid proposal PDF.
Extract the TOTAL bid/proposal amount (the grand total dollar amount).

Respond ONLY with valid JSON and nothing else:
{"amount": <number without $ or commas, or null if not found>}

Examples:
- If total is $27,500.00 → {"amount": 27500}
- If total is $1,234,567 → {"amount": 1234567}
- If no clear total found → {"amount": null}`,
              },
            ],
          },
        ],
      });

      const rawText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      const cleanText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

      let parsed: { amount?: number | null };
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        console.log(`  ⚠️  [${bid.contractorName ?? bid.id}] — JSON parse error: ${cleanText.slice(0, 50)}`);
        failed++;
        continue;
      }

      if (parsed.amount == null || isNaN(Number(parsed.amount))) {
        console.log(`  ⏭️  [${bid.contractorName ?? bid.id}] — no amount found in PDF`);
        failed++;
        continue;
      }

      await prisma.subBid.update({
        where: { id: bid.id },
        data: { amount: parsed.amount, status: "RECEIVED" },
      });

      console.log(`  ✅ [${(bid.client.name + " / " + bid.divisionCode).padEnd(30)}] ${bid.contractorName ?? "unknown"} → $${Number(parsed.amount).toLocaleString()}`);
      updated++;

    } catch (err) {
      console.log(`  ❌ [${bid.contractorName ?? bid.id}] — ${String(err).slice(0, 80)}`);
      failed++;
    }
  }

  console.log(`\n📊 Done: ${updated} updated, ${failed} skipped/failed`);
  await prisma.$disconnect();
}

main().catch(console.error);
