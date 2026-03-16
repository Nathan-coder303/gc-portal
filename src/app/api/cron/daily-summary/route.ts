/**
 * GET /api/cron/daily-summary
 * Runs at 11:59 PM ET (04:59 UTC EST / 03:59 UTC EDT).
 * Generates a structured handoff document for the day and saves it to DailySummary.
 * Covers leads, expenses, task updates, journal entries, and new estimates.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Compute today in ET (EDT = UTC-4 Mar–Nov, EST = UTC-5 Nov–Mar)
  const now = new Date();
  const etOffsetHours = now.getMonth() >= 2 && now.getMonth() <= 10 ? 4 : 5;
  const etNow = new Date(now.getTime() - etOffsetHours * 60 * 60 * 1000);
  const todayStr = etNow.toISOString().split("T")[0]; // "YYYY-MM-DD" in ET

  // Query window: midnight ET → midnight ET next day (in UTC)
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  dayStart.setUTCHours(etOffsetHours, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Date key for upsert (UTC midnight for the ET date)
  const summaryDate = new Date(`${todayStr}T00:00:00.000Z`);

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const results: Array<{ company: string; status: string; error?: string }> = [];

  for (const company of companies) {
    try {
      const [leads, expenses, taskChanges, journalEntries, projectEstimates] = await Promise.all([
        // Leads received today
        prisma.lead.findMany({
          where: { companyId: company.id, receivedAt: { gte: dayStart, lte: dayEnd } },
          orderBy: { receivedAt: "asc" },
        }),
        // Expenses created today
        prisma.expense.findMany({
          where: { companyId: company.id, createdAt: { gte: dayStart, lte: dayEnd } },
          include: { project: { select: { name: true } }, costCode: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        // Task status changes today
        prisma.taskChangeLog.findMany({
          where: {
            changedAt: { gte: dayStart, lte: dayEnd },
            task: { project: { companyId: company.id } },
          },
          include: { task: { select: { name: true, project: { select: { name: true } } } } },
          orderBy: { changedAt: "asc" },
        }),
        // Journal entries created today
        prisma.journalEntry.findMany({
          where: { createdAt: { gte: dayStart, lte: dayEnd }, project: { companyId: company.id } },
          include: { project: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        // Estimates created today
        prisma.projectEstimate.findMany({
          where: { createdAt: { gte: dayStart, lte: dayEnd }, project: { companyId: company.id } },
          include: { project: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      // ── Build structured handoff document ──────────────────────────────────
      const lines: string[] = [];

      const dateLabel = new Date(`${todayStr}T12:00:00.000Z`).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
      });
      lines.push(`=== MIBH Construction Portal — Daily Handoff ===`);
      lines.push(`Date: ${dateLabel}`);
      lines.push(`Generated: ${now.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} ET`);
      lines.push(``);

      // LEADS
      lines.push(`### NEW LEADS (${leads.length})`);
      if (leads.length === 0) {
        lines.push(`  No new leads today.`);
      } else {
        leads.forEach((l, i) => {
          const parts = [l.name ?? "(no name)", l.phone ?? "no phone", l.email ?? "no email"];
          if (l.projectType) parts.push(l.projectType);
          if (l.city || l.state) parts.push([l.city, l.state].filter(Boolean).join(", "));
          lines.push(`  ${i + 1}. ${parts.join(" | ")}`);
          if (l.message && l.message.length > 0 && l.message !== l.emailSubject) {
            lines.push(`     Message: ${l.message.slice(0, 120)}`);
          }
        });
      }
      lines.push(``);

      // EXPENSES
      const expTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
      lines.push(`### EXPENSES (${expenses.length} transaction${expenses.length !== 1 ? "s" : ""}${expenses.length > 0 ? ` — $${fmt(expTotal)} total` : ""})`);
      if (expenses.length === 0) {
        lines.push(`  No expenses logged today.`);
      } else {
        expenses.forEach(e => {
          lines.push(`  • [${e.project.name}] ${e.vendor} — ${e.category}${e.costCode ? ` (${e.costCode.name})` : ""} — $${fmt(Number(e.amount))}`);
          if (e.description) lines.push(`    "${e.description}"`);
        });
      }
      lines.push(``);

      // TASK UPDATES
      lines.push(`### TASK UPDATES (${taskChanges.length})`);
      if (taskChanges.length === 0) {
        lines.push(`  No task changes today.`);
      } else {
        taskChanges.forEach(tc => {
          lines.push(`  • [${tc.task.project.name}] "${tc.task.name}" — ${tc.field}: ${tc.oldValue ?? "—"} → ${tc.newValue ?? "—"}`);
        });
      }
      lines.push(``);

      // ESTIMATES
      lines.push(`### NEW ESTIMATES (${projectEstimates.length})`);
      if (projectEstimates.length === 0) {
        lines.push(`  No new estimates today.`);
      } else {
        projectEstimates.forEach(pe => {
          lines.push(`  • [${pe.project.name}] "${pe.name}" — ${pe.status}`);
        });
      }
      lines.push(``);

      // JOURNAL ENTRIES
      lines.push(`### JOURNAL ENTRIES (${journalEntries.length})`);
      if (journalEntries.length === 0) {
        lines.push(`  No journal entries today.`);
      } else {
        journalEntries.forEach(je => {
          lines.push(`  • [${(je as { project: { name: string } }).project.name}] ${je.memo}${je.reference ? ` (ref: ${je.reference})` : ""}`);
        });
      }
      lines.push(``);

      // Activity flag
      const hasActivity = leads.length + expenses.length + taskChanges.length + journalEntries.length + projectEstimates.length > 0;
      if (!hasActivity) {
        lines.push(`No activity recorded today.`);
        lines.push(``);
      }

      lines.push(`=== END HANDOFF ===`);
      const content = lines.join("\n");

      await prisma.dailySummary.upsert({
        where: { companyId_date: { companyId: company.id, date: summaryDate } },
        create: { companyId: company.id, date: summaryDate, content },
        update: { content },
      });

      results.push({ company: company.name, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`DailySummary error for ${company.name}:`, err);
      results.push({ company: company.name, status: "error", error: msg });
    }
  }

  return NextResponse.json({ date: todayStr, results });
}
