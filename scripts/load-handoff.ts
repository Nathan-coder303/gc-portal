/**
 * scripts/load-handoff.ts
 * Seals the day's handoff document and writes it to Claude Code memory.
 * Combines:
 *   1. /Users/mike/.claude/today.md  — general daily notes from all Claude sessions
 *   2. Latest DailySummary from DB   — MIBH portal activity (leads, expenses, tasks, estimates)
 *
 * Run: npx tsx scripts/load-handoff.ts
 * Crontab (12:01 AM ET = 5:01 AM UTC): 1 5 * * * /Users/mike/gc-portal/scripts/load-handoff.sh
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
const TODAY_NOTES = "/Users/mike/.claude/today.md";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Read today's general notes
    let todayNotes = "";
    try { todayNotes = fs.readFileSync(TODAY_NOTES, "utf-8").trim(); } catch { /* none yet */ }

    // 2. Read latest portal summary from DB
    const latest = await prisma.dailySummary.findFirst({
      where: { companyId: COMPANY_ID },
      orderBy: { date: "desc" },
    });

    const now = new Date();
    const etOffset = now.getMonth() >= 2 && now.getMonth() <= 10 ? 4 : 5;
    const etNow = new Date(now.getTime() - etOffset * 60 * 60 * 1000);
    const dateLabel = etNow.toISOString().split("T")[0];

    // 3. Build combined handoff
    const sections: string[] = [];

    sections.push(`=== DAILY HANDOFF — ${dateLabel} ===`);
    sections.push(`Sealed: ${now.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ET`);
    sections.push(`This document covers ALL subjects from the day's work.`);
    sections.push(``);

    // General notes section (all subjects)
    if (todayNotes) {
      sections.push(`── GENERAL SESSION NOTES ──────────────────────────────────────────────`);
      sections.push(todayNotes);
      sections.push(``);
    } else {
      sections.push(`── GENERAL SESSION NOTES ──────────────────────────────────────────────`);
      sections.push(`No session notes recorded today.`);
      sections.push(``);
    }

    // Portal DB section
    sections.push(`── MIBH PORTAL ACTIVITY ────────────────────────────────────────────────`);
    if (latest) {
      sections.push(latest.content);
    } else {
      sections.push(`No portal activity recorded today.`);
    }
    sections.push(``);
    sections.push(`=== END HANDOFF ===`);

    const combined = sections.join("\n");

    // Ensure memory dir exists
    fs.mkdirSync(MEMORY_DIR, { recursive: true });

    // Write handoff memory file
    const fileContent = `---
name: Daily Handoff — ${dateLabel}
description: Handoff document from ${dateLabel} — all subjects: session notes + portal activity
type: project
---

${combined}
`;
    fs.writeFileSync(MEMORY_FILE, fileContent, "utf-8");

    // Update MEMORY.md index
    let index = "";
    try { index = fs.readFileSync(MEMORY_INDEX, "utf-8"); } catch { /* first run */ }

    const handoffLine = `- [Daily Handoff (latest: ${dateLabel})](handoff_latest.md) — Yesterday's notes across all subjects + portal activity`;
    if (index.includes("handoff_latest.md")) {
      index = index.replace(/- \[Daily Handoff.*handoff_latest\.md\).*\n?/, handoffLine + "\n");
    } else {
      index = index.trimEnd() + "\n" + handoffLine + "\n";
    }
    fs.writeFileSync(MEMORY_INDEX, index, "utf-8");

    // Reset today.md for the new day
    const newDayDate = new Date(now.getTime() + 60 * 1000); // 12:01 AM
    const newDayLabel = new Date(newDayDate.getTime() - etOffset * 60 * 60 * 1000).toISOString().split("T")[0];
    fs.writeFileSync(TODAY_NOTES, `# Daily Notes — ${newDayLabel}\n\n_Updated throughout the day during Claude sessions._\n\n---\n\n`, "utf-8");

    console.log(`Handoff for ${dateLabel} written to Claude memory. today.md reset for ${newDayLabel}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
