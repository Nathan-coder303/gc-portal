"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseScheduleCsv } from "@/lib/csv/parseSchedule";
import { toCsv } from "@/lib/export/toCsv";
import { TaskStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/permissions";

export async function importScheduleCsv(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "task:import");

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

  await writeAuditLog({
    companyId: session.user.companyId,
    projectId,
    entityType: "TASK",
    entityId: projectId,
    action: "IMPORT",
    changes: [{ field: "count", oldValue: null, newValue: String(tasks.length) }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

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
  requirePermission(session, "task:updateStatus");

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
    await writeAuditLog({
      companyId: session.user.companyId,
      projectId: existing.projectId,
      entityType: "TASK",
      entityId: taskId,
      action: "UPDATE",
      changes: logs.map((l) => ({ field: l.field, oldValue: l.oldValue, newValue: l.newValue })),
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}/${task.projectId}/schedule`);
  return { success: true };
}

export async function updateTask(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "task:edit");

  const id = formData.get("id") as string;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");

  const name = (formData.get("name") as string).trim();
  const phase = (formData.get("phase") as string).trim();
  const durationDays = Math.max(0, parseInt(formData.get("durationDays") as string, 10) || 0);
  const trade = (formData.get("trade") as string).trim() || null;
  const assignee = (formData.get("assignee") as string).trim() || null;
  const notes = (formData.get("notes") as string).trim() || null;
  const percentComplete = Math.min(100, Math.max(0, parseInt(formData.get("percentComplete") as string, 10) || 0));
  const startDateStr = (formData.get("startDate") as string) || "";
  const endDateStr = (formData.get("endDate") as string) || "";
  const startDate = startDateStr ? new Date(startDateStr + "T00:00:00") : existing.startDate;
  const endDate = endDateStr ? new Date(endDateStr + "T00:00:00") : existing.endDate;

  if (!name || !phase) throw new Error("Name and phase are required");

  await prisma.task.update({
    where: { id },
    data: { name, phase, durationDays, trade, assignee, notes, percentComplete, startDate, endDate, updatedBy: session.user.id },
  });

  // Build diffs for both TaskChangeLog and AuditLog
  type LogRow = { taskId: string; field: string; oldValue: string; newValue: string; changedBy: string };
  const logRows: LogRow[] = [];
  const pairs: [string, string | number | null, string | number | null][] = [
    ["name", existing.name, name],
    ["phase", existing.phase, phase],
    ["durationDays", existing.durationDays, durationDays],
    ["trade", existing.trade, trade],
    ["assignee", existing.assignee, assignee],
    ["notes", existing.notes, notes],
    ["percentComplete", existing.percentComplete, percentComplete],
    ["startDate", existing.startDate?.toISOString().split("T")[0] ?? null, startDateStr || null],
    ["endDate", existing.endDate?.toISOString().split("T")[0] ?? null, endDateStr || null],
  ];
  for (const [field, oldVal, newVal] of pairs) {
    const o = oldVal == null ? "" : String(oldVal);
    const n = newVal == null ? "" : String(newVal);
    if (o !== n) logRows.push({ taskId: id, field, oldValue: o, newValue: n, changedBy: session.user.id });
  }

  if (logRows.length > 0) {
    await prisma.taskChangeLog.createMany({ data: logRows });
    await writeAuditLog({
      companyId: session.user.companyId,
      projectId: existing.projectId,
      entityType: "TASK",
      entityId: id,
      action: "UPDATE",
      changes: logRows.map((r) => ({ field: r.field, oldValue: r.oldValue || null, newValue: r.newValue || null })),
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}/${existing.projectId}/schedule`);
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
