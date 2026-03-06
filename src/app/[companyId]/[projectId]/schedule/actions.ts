"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseScheduleCsv } from "@/lib/csv/parseSchedule";
import { toCsv } from "@/lib/export/toCsv";
import { TaskStatus } from "@prisma/client";

export async function importScheduleCsv(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const csvText = formData.get("csv") as string;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const { tasks, errors } = parseScheduleCsv(csvText, project.startDate);
  if (errors.length > 0) return { success: false, errors, imported: 0 };

  // Delete existing tasks and re-import
  await prisma.task.deleteMany({ where: { projectId } });

  // Create tasks first pass (no predecessor IDs yet)
  const nameToId = new Map<string, string>();
  const created = [];

  for (const t of tasks) {
    const task = await prisma.task.create({
      data: {
        projectId,
        phase: t.phase,
        name: t.name,
        durationDays: t.durationDays,
        startDate: t.startDate,
        endDate: t.endDate,
        predecessorIds: [],
        trade: t.trade,
        assignee: t.assignee,
        isMilestone: t.isMilestone,
        status: TaskStatus.NOT_STARTED,
        percentComplete: 0,
        createdBy: session.user.id,
      },
    });
    nameToId.set(t.name, task.id);
    created.push({ task, predecessorName: t.predecessorName });
  }

  // Second pass: update predecessor IDs with real DB IDs
  for (const { task, predecessorName } of created) {
    if (predecessorName) {
      const predId = nameToId.get(predecessorName);
      if (predId) {
        await prisma.task.update({
          where: { id: task.id },
          data: { predecessorIds: [predId] },
        });
      }
    }
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/schedule`);
  return { success: true, errors: [], imported: tasks.length };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, percentComplete: number) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status, percentComplete },
  });

  revalidatePath(`/${session.user.companyId}/${task.projectId}/schedule`);
  return { success: true };
}

export async function exportScheduleCsv(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
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
