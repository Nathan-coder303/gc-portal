import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Compute today in ET (UTC-4 EDT / UTC-5 EST)
  const now = new Date();
  const etOffsetHours = now.getMonth() >= 2 && now.getMonth() <= 10 ? 4 : 5;
  const etNow = new Date(now.getTime() - etOffsetHours * 60 * 60 * 1000);
  const todayStr = etNow.toISOString().split("T")[0]; // "YYYY-MM-DD" in ET

  // Query window: midnight ET → midnight ET next day (both in UTC)
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  dayStart.setUTCHours(etOffsetHours, 0, 0, 0); // shift to ET midnight
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Use clean midnight UTC for DB date key (avoids upsert conflicts)
  const summaryDate = new Date(`${todayStr}T00:00:00.000Z`);

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results: Array<{ company: string; status: string; error?: string }> = [];

  for (const company of companies) {
    try {
      const [expenses, taskChanges, journalEntries, projectEstimates, newTemplates] = await Promise.all([
        prisma.expense.findMany({
          where: { companyId: company.id, createdAt: { gte: dayStart, lte: dayEnd } },
          include: { project: { select: { name: true } }, costCode: { select: { name: true } } },
        }),
        prisma.taskChangeLog.findMany({
          where: { changedAt: { gte: dayStart, lte: dayEnd }, task: { project: { companyId: company.id } } },
          include: { task: { select: { name: true, project: { select: { name: true } } } } },
        }),
        prisma.journalEntry.findMany({
          where: { createdAt: { gte: dayStart, lte: dayEnd }, project: { companyId: company.id } },
          include: { project: { select: { name: true } } },
        }),
        prisma.projectEstimate.findMany({
          where: { createdAt: { gte: dayStart, lte: dayEnd }, project: { companyId: company.id } },
          include: { project: { select: { name: true } } },
        }),
        prisma.estimateTemplate.findMany({
          where: { companyId: company.id, type: "TEMPLATE", createdAt: { gte: dayStart, lte: dayEnd } },
          select: { name: true, description: true },
        }),
      ]);

      const hasActivity =
        expenses.length > 0 || taskChanges.length > 0 ||
        journalEntries.length > 0 || projectEstimates.length > 0 || newTemplates.length > 0;

      let content: string;

      if (!hasActivity) {
        content = "No activity recorded today.";
      } else {
        const dataBlob = JSON.stringify({
          date: todayStr,
          company: company.name,
          expenses: expenses.map(e => ({
            project: e.project.name, vendor: e.vendor, amount: Number(e.amount),
            category: e.category, costCode: e.costCode?.name ?? null, description: e.description,
          })),
          taskChanges: taskChanges.map(tc => ({
            task: tc.task.name, project: tc.task.project.name, field: tc.field,
            from: tc.oldValue, to: tc.newValue,
          })),
          journalEntries: journalEntries.map(je => ({
            project: (je as { project: { name: string }; memo: string; reference: string | null }).project.name,
            memo: je.memo, reference: je.reference,
          })),
          projectEstimates: projectEstimates.map(pe => ({
            project: pe.project.name, name: pe.name, status: pe.status,
          })),
          newEstimateTemplates: newTemplates.map(t => ({ name: t.name, description: t.description })),
        }, null, 2);

        try {
          const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 512,
            messages: [{
              role: "user",
              content: `You are an assistant that writes concise daily activity summaries for a construction project management company. Write a short plain-English paragraph (3–6 sentences) summarizing today's activity. Cover expenses, task progress, journal entries, new estimates, and new templates created. Be direct and factual.\n\n${dataBlob}`,
            }],
          });
          content = message.content[0].type === "text" ? message.content[0].text.trim() : "Summary generation failed.";
        } catch (aiErr) {
          // Fallback: plain text summary without AI
          const parts: string[] = [];
          if (expenses.length > 0) parts.push(`${expenses.length} expense(s) logged totaling $${expenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString()}`);
          if (taskChanges.length > 0) parts.push(`${taskChanges.length} task update(s)`);
          if (journalEntries.length > 0) parts.push(`${journalEntries.length} journal entry/entries`);
          if (projectEstimates.length > 0) parts.push(`${projectEstimates.length} project estimate(s) created`);
          if (newTemplates.length > 0) parts.push(`${newTemplates.length} estimate template(s) created: ${newTemplates.map(t => t.name).join(", ")}`);
          content = `Activity on ${todayStr}: ${parts.join("; ")}. (AI summary unavailable: ${aiErr instanceof Error ? aiErr.message : "unknown error"})`;
        }
      }

      await prisma.dailySummary.upsert({
        where: { companyId_date: { companyId: company.id, date: summaryDate } },
        create: { companyId: company.id, date: summaryDate, content },
        update: { content },
      });

      results.push({ company: company.name, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? `${err.message} ${err.stack?.split("\n")[1] ?? ""}` : String(err);
      console.error(`DailySummary error for ${company.name}:`, err);
      results.push({ company: company.name, status: "error", error: msg });
    }
  }

  return NextResponse.json({ date: todayStr, dayStart, dayEnd, results });
}
