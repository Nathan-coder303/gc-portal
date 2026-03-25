/**
 * scripts/load-handoff.ts
 * Seals the day's notes into a dated MD file in Claude Code memory.
 * Combines:
 *   1. MEMORY_DIR/YYYY-MM-DD.md  — session notes written by Claude during the day
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
const MEMORY_INDEX = path.join(MEMORY_DIR, "MEMORY.md");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const now = new Date();
    const etOffset = now.getMonth() >= 2 && now.getMonth() <= 10 ? 4 : 5;
    const etNow = new Date(now.getTime() - etOffset * 60 * 60 * 1000);
    const dateLabel = etNow.toISOString().split("T")[0]; // day being sealed

    const datedFile = path.join(MEMORY_DIR, `${dateLabel}.md`);

    // 1. Read session notes written by Claude during the day
    let existingNotes = "";
    try {
      const raw = fs.readFileSync(datedFile, "utf-8").trim();
      // Strip frontmatter so we can re-wrap it cleanly
      existingNotes = raw.replace(/^---[\s\S]*?---\n\n?/, "").trim();
    } catch { /* none yet */ }

    // 2. Read latest portal summary from DB
    const latest = await prisma.dailySummary.findFirst({
      where: { companyId: COMPANY_ID },
      orderBy: { date: "desc" },
    });

    const portalSection = latest ? latest.content : "No portal activity recorded today.";

    // 3. Seal the dated file with portal activity appended
    const sealed = `---
name: Session Notes — ${dateLabel}
description: All work done on ${dateLabel} — session notes + portal activity
type: project
---

${existingNotes || "_No session notes recorded._"}

## MIBH Portal Activity — ${dateLabel}

${portalSection}

_Sealed: ${now.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ET_
`;

    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(datedFile, sealed, "utf-8");

    // 4. Create fresh dated file for the NEW day
    const nextEtNow = new Date(now.getTime() + 60 * 1000 - etOffset * 60 * 60 * 1000);
    const nextDateLabel = nextEtNow.toISOString().split("T")[0];
    const nextDatedFile = path.join(MEMORY_DIR, `${nextDateLabel}.md`);

    if (!fs.existsSync(nextDatedFile)) {
      fs.writeFileSync(nextDatedFile, `---
name: Session Notes — ${nextDateLabel}
description: All work done on ${nextDateLabel}
type: project
---

## ${nextDateLabel}

`, "utf-8");
    }

    // 5. Update MEMORY.md index
    let index = "";
    try { index = fs.readFileSync(MEMORY_INDEX, "utf-8"); } catch { /* first run */ }

    const sealedLine = `- [${dateLabel}](${dateLabel}.md) — Sealed: session notes + portal activity`;
    const todayLine = `- [${nextDateLabel} (today)](${nextDateLabel}.md) — Today's running session notes`;

    // Remove old handoff_latest line, stale today line, and duplicate dated lines
    index = index
      .replace(/- \[Daily Handoff.*handoff_latest\.md\).*\n?/g, "")
      .replace(/- \[.*\(today\)\].*\.md\).*\n?/g, "")
      .replace(new RegExp(`- \\[${dateLabel}\\].*\n?`, "g"), "")
      .trimEnd();

    index += `\n${sealedLine}\n${todayLine}\n`;
    fs.writeFileSync(MEMORY_INDEX, index, "utf-8");

    console.log(`Sealed ${dateLabel}.md. Created ${nextDateLabel}.md for tomorrow.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
