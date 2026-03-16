/**
 * POST /api/cron/clear-summaries
 * One-time endpoint to delete all DailySummary records for a company.
 * Protected by CRON_SECRET.
 * Usage: curl -X POST https://gc-portal-two.vercel.app/api/cron/clear-summaries \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.dailySummary.deleteMany({});
  return NextResponse.json({ deleted: count });
}
