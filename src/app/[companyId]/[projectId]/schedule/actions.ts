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

  const { tasks, errors, cycleChains } = parseScheduleCsv(csvText, project.startDate);
  if (errors.length > 0) return { success: false, errors, cycleChains, imported: 0 };

  // Delete existing tasks (and their change logs) then re-import
  await prisma.taskChangeLog.deleteMany({
    where: { task: { projectId } },
  });
  await prisma.task.deleteMany({ where: { projectId } });

  // First pass: create tasks with empty predecessorIds
  const nameToId = new Map<string, string>();
  const created: { taskId: string; predecessorNames: string[] }[] = [];

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
        trade: t.trade || null,
        assignee: t.assignee || null,
        isMilestone: t.isMilestone,
        status: TaskStatus.NOT_STARTED,
        percentComplete: 0,
        createdBy: session.user.id,
      },
    });
    nameToId.set(t.name, task.id);
    created.push({ taskId: task.id, predecessorNames: t.predecessorNames });
  }

  // Second pass: resolve predecessor IDs
  for (const { taskId, predecessorNames } of created) {
    const predecessorIds = predecessorNames
      .map((name) => nameToId.get(name))
      .filter((id): id is string => !!id);
    if (predecessorIds.length > 0) {
      await prisma.task.update({
        where: { id: taskId },
        data: { predecessorIds },
      });
    }
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/schedule`);
  return { success: true, errors: [], cycleChains: [], imported: tasks.length };
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  percentComplete: number
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task not found");

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status, percentComplete },
  });

  // Write change logs for each changed field
  const logs: { taskId: string; field: string; oldValue: string; newValue: string; changedBy: string }[] = [];

  if (existing.status !== status) {
    logs.push({
      taskId,
      field: "status",
      oldValue: existing.status,
      newValue: status,
      changedBy: session.user.id,
    });
  }
  if (existing.percentComplete !== percentComplete) {
    logs.push({
      taskId,
      field: "percentComplete",
      oldValue: String(existing.percentComplete),
      newValue: String(percentComplete),
      changedBy: session.user.id,
    });
  }

  if (logs.length > 0) {
    await prisma.taskChangeLog.createMany({ data: logs });
  }

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
