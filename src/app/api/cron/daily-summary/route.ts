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

  // Compute today's window in ET time (UTC-4 EDT / UTC-5 EST)
  const now = new Date();
  const etOffsetHours = now.getMonth() >= 2 && now.getMonth() <= 10 ? 4 : 5; // hours behind UTC
  const etNow = new Date(now.getTime() - etOffsetHours * 60 * 60 * 1000);
  const todayStr = etNow.toISOString().split("T")[0]; // "YYYY-MM-DD" in ET

  // Convert ET midnight → UTC for DB queries
  const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
  dayStart.setTime(dayStart.getTime() + etOffsetHours * 60 * 60 * 1000); // midnight ET in UTC
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59 ET in UTC

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results: Array<{ company: string; status: string }> = [];

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
        }),
      ]);

      const hasActivity =
        expenses.length > 0 ||
        taskChanges.length > 0 ||
        journalEntries.length > 0 ||
        projectEstimates.length > 0 ||
        newTemplates.length > 0;

      let content: string;

      if (!hasActivity) {
        content = "No activity recorded today.";
      } else {
        const dataBlob = JSON.stringify({
          date: todayStr,
          company: company.name,
          expenses: expenses.map(e => ({
            project: e.project.name,
            vendor: e.vendor,
            amount: Number(e.amount),
            category: e.category,
            costCode: e.costCode?.name ?? null,
            description: e.description,
          })),
          taskChanges: taskChanges.map(tc => ({
            task: tc.task.name,
            project: tc.task.project.name,
            field: tc.field,
            from: tc.oldValue,
            to: tc.newValue,
          })),
          journalEntries: journalEntries.map(je => ({
            project: (je as { project: { name: string } }).project.name,
            memo: je.memo,
            reference: je.reference,
          })),
          projectEstimates: projectEstimates.map(pe => ({
            project: pe.project.name,
            name: pe.name,
            status: pe.status,
          })),
          newEstimateTemplates: newTemplates.map(t => ({ name: t.name, description: t.description })),
        }, null, 2);

        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `You are an assistant that writes concise daily activity summaries for a construction project management company. Write a short, plain-English paragraph (3–6 sentences) summarizing today's activity from the data below. Cover expenses, task progress, journal entries, new estimates, and new estimate templates created. Use dollar amounts and names. Be direct and factual.\n\n${dataBlob}`,
          }],
        });

        content = message.content[0].type === "text"
          ? message.content[0].text.trim()
          : "Summary generation failed.";
      }

      await prisma.dailySummary.upsert({
        where: { companyId_date: { companyId: company.id, date: dayStart } },
        create: { companyId: company.id, date: dayStart, content },
        update: { content },
      });

      results.push({ company: company.name, status: "ok" });
    } catch (err) {
      console.error(`DailySummary error for ${company.name}:`, err);
      results.push({ company: company.name, status: "error" });
    }
  }

  return NextResponse.json({ date: todayStr, results });
}
