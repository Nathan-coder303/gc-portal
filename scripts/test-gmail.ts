import { google } from "googleapis";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
  }
}
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob"
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

async function countQuery(label: string, q: string) {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({ userId: "me", q, maxResults: 500, pageToken });
    total += res.data.messages?.length ?? 0;
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  console.log(`[${label}] → ${total} emails`);
  return total;
}

async function main() {
  console.log("Testing Gmail connection...\n");

  // Test basic connection
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log("Connected as:", profile.data.emailAddress);
  console.log("Total messages in mailbox:", profile.data.messagesTotal);
  console.log("");

  // Count all bid emails (existing query)
  const bidTotal = await countQuery(
    "All bid/estimate emails",
    "has:attachment filename:pdf (bid OR estimate OR proposal OR quote)"
  );

  // Count address-specific emails
  const addr7729 = await countQuery("Contains '7729'", "7729");
  const addrFull  = await countQuery("Contains full address '7729 NW'", "\"7729 NW\"");

  console.log("\n── Summary ──");
  console.log(`Total bid emails found:           ${bidTotal}`);
  console.log(`Emails mentioning '7729':         ${addr7729}`);
  console.log(`Emails mentioning '7729 NW' (full): ${addrFull}`);

  // Also show a sample of bid emails to see what's there
  console.log("\n── First 5 bid emails ──");
  const sample = await gmail.users.messages.list({
    userId: "me",
    q: "has:attachment filename:pdf (bid OR estimate OR proposal OR quote)",
    maxResults: 5,
  });
  for (const msg of sample.data.messages ?? []) {
    const full = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "metadata", metadataHeaders: ["Subject", "From", "Date"] });
    const h = full.data.payload?.headers ?? [];
    const subject = h.find(x => x.name === "Subject")?.value ?? "(no subject)";
    const from = h.find(x => x.name === "From")?.value ?? "";
    const date = h.find(x => x.name === "Date")?.value ?? "";
    console.log(`  [${date}] From: ${from}\n   Subject: ${subject}`);
  }
}

main().catch(e => {
  console.error("ERROR:", e.message ?? e);
  if (e.message?.includes("invalid_grant") || e.message?.includes("Token")) {
    console.error("\nToken issue — refresh token may be expired or revoked.");
    console.error("You may need to re-authorize the Google OAuth app.");
  }
  process.exit(1);
});
