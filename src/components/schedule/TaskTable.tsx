"use client";

import { useState } from "react";
import { format } from "date-fns";
import { updateTaskStatus } from "@/app/[companyId]/[projectId]/schedule/actions";
import { TaskStatus } from "@prisma/client";
import type { GanttTask } from "@/lib/schedule/gantt";

const statusColors: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  BLOCKED: "bg-orange-100 text-orange-700",
  DONE: "bg-green-100 text-green-700",
};

export default function TaskTable({ tasks }: { tasks: GanttTask[]; projectId: string }) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleStatusChange(taskId: string, status: string) {
    setUpdating(taskId);
    await updateTaskStatus(taskId, status as TaskStatus, status === "DONE" ? 100 : status === "IN_PROGRESS" ? 50 : 0);
    setUpdating(null);
  }

  const grouped = tasks.reduce((acc, t) => {
    acc[t.phase] = acc[t.phase] ?? [];
    acc[t.phase].push(t);
    return acc;
  }, {} as Record<string, GanttTask[]>);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Task</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Phase</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Start</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">End</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Duration</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Trade</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Assignee</th>
            <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
            <th className="text-right px-4 py-2.5 text-slate-500 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([phase, phaseTasks]) =>
            phaseTasks.map((t, i) => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {t.isMilestone && (
                    <span className="inline-block w-2 h-2 bg-violet-500 rotate-45 mr-2 mb-0.5" />
                  )}
                  {t.name}
                </td>
                <td className="px-4 py-2 text-slate-500">{i === 0 ? phase : ""}</td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                  {format(t.startDate, "MMM d")}
                </td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                  {t.isMilestone ? "—" : format(t.endDate, "MMM d")}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {t.isMilestone ? "Milestone" : `${t.durationDays}d`}
                </td>
                <td className="px-4 py-2 text-slate-500">{t.trade ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{t.assignee ?? "—"}</td>
                <td className="px-4 py-2">
                  <select
                    value={t.status}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    disabled={updating === t.id}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${statusColors[t.status]}`}
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="DONE">Done</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right text-slate-500">{t.percentComplete}%</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
