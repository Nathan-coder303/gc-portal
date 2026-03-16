/**
 * scripts/load-handoff.ts
 * Fetches the latest daily handoff document from the DB and writes it to
 * Claude Code memory so it's available at the start of each session.
 *
 * Run: npx tsx scripts/load-handoff.ts
 * Crontab (12:01 AM ET = 5:01 AM UTC): 1 5 * * * cd /Users/mike/gc-portal && npx tsx scripts/load-handoff.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const COMPANY_ID = "cmmij161r000004jm8il8bd0e";
const MEMORY_DIR = "/Users/mike/.claude/projects/-Users-mike/memory";
const MEMORY_FILE = path.join(MEMORY_DIR, "handoff_latest.md");
const MEMORY_INDEX = path.join(MEMORY_DIR, "MEMORY.md");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const latest = await prisma.dailySummary.findFirst({
      where: { companyId: COMPANY_ID },
      orderBy: { date: "desc" },
    });

    if (!latest) {
      console.log("No handoff document found.");
      return;
    }

    const dateLabel = latest.date.toISOString().split("T")[0];

    // Ensure memory dir exists
    fs.mkdirSync(MEMORY_DIR, { recursive: true });

    // Write the handoff memory file
    const content = `---
name: Daily Handoff — ${dateLabel}
description: Handoff document from ${dateLabel} covering leads, expenses, task updates, and estimates
type: project
---

${latest.content}
`;
    fs.writeFileSync(MEMORY_FILE, content, "utf-8");

    // Update MEMORY.md index — replace or add handoff_latest entry
    let index = "";
    try { index = fs.readFileSync(MEMORY_INDEX, "utf-8"); } catch { /* first run */ }

    const handoffLine = `- [Daily Handoff (latest: ${dateLabel})](handoff_latest.md) — Yesterday's leads, expenses, tasks, and estimates`;
    if (index.includes("handoff_latest.md")) {
      index = index.replace(/- \[Daily Handoff.*handoff_latest\.md\).*\n?/, handoffLine + "\n");
    } else {
      index = index.trimEnd() + "\n" + handoffLine + "\n";
    }
    fs.writeFileSync(MEMORY_INDEX, index, "utf-8");

    console.log(`Handoff for ${dateLabel} written to Claude memory.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
