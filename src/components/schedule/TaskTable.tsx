"use client";

import { useState } from "react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { updateTaskStatus } from "@/app/[companyId]/[projectId]/schedule/actions";
import { TaskStatus } from "@prisma/client";
import type { GanttTask } from "@/lib/schedule/gantt";
import TaskEditModal from "./TaskEditModal";

const statusColors: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS:  "bg-blue-100 text-blue-700",
  BLOCKED:      "bg-orange-100 text-orange-700",
  DONE:         "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS:  "In Progress",
  BLOCKED:      "Blocked",
  DONE:         "Done",
};

type EditingTask = { id: string; name: string; phase: string; durationDays: number; startDate: string | null; endDate: string | null; trade: string | null; assignee: string | null; notes: string | null; percentComplete: number };

export default function TaskTable({ tasks, canEdit = false }: { tasks: GanttTask[]; projectId: string; canEdit?: boolean }) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);

  const today = new Date();
  const in7 = addDays(today, 7);
  const in14 = addDays(today, 14);

  async function handleStatusChange(taskId: string, status: string) {
    setUpdating(taskId);
    const pct = status === "DONE" ? 100 : status === "IN_PROGRESS" ? 50 : 0;
    await updateTaskStatus(taskId, status as TaskStatus, pct);
    setUpdating(null);
  }

  const grouped = new Map<string, GanttTask[]>();
  for (const t of tasks) {
    const arr = grouped.get(t.phase) ?? [];
    arr.push(t);
    grouped.set(t.phase, arr);
  }

  const toggle = (phase: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      {editingTask && (
        <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Task</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Start</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">End</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Dur</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Trade</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Assignee</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
            <th className="text-right px-4 py-2.5 text-slate-500 font-medium">%</th>
            {canEdit && <th className="px-4 py-2.5 w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {Array.from(grouped.entries()).map(([phase, phaseTasks]) => {
            const isCollapsed = collapsed.has(phase);
            const done = phaseTasks.filter((t) => t.status === "DONE").length;
            const late = phaseTasks.filter(
              (t) => t.status !== "DONE" && isBefore(t.endDate, today)
            ).length;

            return [
              // Phase header row
              <tr
                key={`phase-${phase}`}
                className="bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-200"
                onClick={() => toggle(phase)}
              >
                <td colSpan={canEdit ? 9 : 8} className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="font-semibold text-slate-700">{phase}</span>
                    <span className="text-xs text-slate-400">
                      {phaseTasks.length} tasks · {done}/{phaseTasks.length} done
                    </span>
                    {late > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {late} late
                      </span>
                    )}
                  </div>
                </td>
              </tr>,

              // Task rows (hidden when collapsed)
              ...(!isCollapsed
                ? phaseTasks.map((t) => {
                    const isLate = t.status !== "DONE" && isBefore(t.endDate, today);
                    const isDueIn7 = t.status !== "DONE" && !isLate && !isAfter(t.endDate, in7);
                    const isDueIn14 = t.status !== "DONE" && !isLate && !isDueIn7 && !isAfter(t.endDate, in14);

                    return (
                      <tr key={t.id} className={`border-b border-slate-50 hover:bg-slate-50 ${isLate ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            {t.isMilestone && (
                              <span className="inline-block w-2 h-2 bg-violet-500 rotate-45" />
                            )}
                            {t.name}
                            {isLate && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Late</span>
                            )}
                            {isDueIn7 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Due 7d</span>
                            )}
                            {isDueIn14 && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Due 14d</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                          {format(t.startDate, "MMM d")}
                        </td>
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                          {t.isMilestone ? "—" : format(t.endDate, "MMM d")}
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-xs">
                          {t.isMilestone ? "★" : `${t.durationDays}d`}
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{t.trade ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{t.assignee ?? "—"}</td>
                        <td className="px-4 py-2">
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                            disabled={updating === t.id}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${statusColors[t.status]}`}
                          >
                            {Object.entries(statusLabel).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500 text-xs">{t.percentComplete}%</td>
                        {canEdit && (
                          <td className="px-4 py-2">
                            <button
                              onClick={() => setEditingTask({
                                id: t.id,
                                name: t.name,
                                phase: t.phase,
                                durationDays: t.durationDays,
                                startDate: t.startDate ? format(t.startDate, "yyyy-MM-dd") : null,
                                endDate: t.endDate ? format(t.endDate, "yyyy-MM-dd") : null,
                                trade: t.trade ?? null,
                                assignee: t.assignee ?? null,
                                notes: null,
                                percentComplete: t.percentComplete,
                              })}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
