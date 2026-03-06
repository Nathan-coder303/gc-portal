import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/export/toCsv";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId },
    orderBy: [{ phase: "asc" }, { startDate: "asc" }],
  });

  const rows = tasks.map((t) => ({
    phase: t.phase,
    task_name: t.name,
    duration_days: t.durationDays,
    start_date: t.startDate?.toISOString().split("T")[0] ?? "",
    end_date: t.endDate?.toISOString().split("T")[0] ?? "",
    trade: t.trade ?? "",
    assignee: t.assignee ?? "",
    milestone: t.isMilestone ? "true" : "false",
    status: t.status,
    percent_complete: t.percentComplete,
  }));

  return toCsv(rows, "schedule.csv");
}
