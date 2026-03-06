import { prisma } from "@/lib/prisma";
import { addDays, format } from "date-fns";
import GanttChart from "@/components/schedule/GanttChart";
import TaskTable from "@/components/schedule/TaskTable";
import { computeCriticalPath } from "@/lib/schedule/gantt";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export default async function SchedulePage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  const canEdit = can(session?.user.role ?? "PARTNER", "task:edit");

  const [tasks, project, recentLogs] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      orderBy: [{ phase: "asc" }, { startDate: "asc" }],
    }),
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.taskChangeLog.findMany({
      where: { task: { projectId: params.projectId } },
      include: { task: { select: { name: true, phase: true } } },
      orderBy: { changedAt: "desc" },
      take: 20,
    }),
  ]);

  const today = new Date();
  const in7 = addDays(today, 7);
  const in14 = addDays(today, 14);

  const ganttTasks = tasks.map((t) => ({
    id: t.id,
    phase: t.phase,
    name: t.name,
    startDate: t.startDate ?? new Date(),
    endDate: t.endDate ?? new Date(),
    durationDays: t.durationDays,
    isMilestone: t.isMilestone,
    isOnCriticalPath: false,
    predecessorIds: t.predecessorIds,
    status: t.status,
    percentComplete: t.percentComplete,
    trade: t.trade,
    assignee: t.assignee,
  }));

  // KPIs
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const lateTasks = tasks.filter(
    (t) => t.status !== "DONE" && t.endDate && t.endDate < today
  ).length;
  const dueSoon7 = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      t.endDate &&
      t.endDate >= today &&
      t.endDate <= in7
  ).length;
  const dueSoon14 = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      t.endDate &&
      t.endDate > in7 &&
      t.endDate <= in14
  ).length;
  const criticalPathIds = computeCriticalPath(ganttTasks);
  const criticalCount = criticalPathIds.size;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalTasks} tasks · Project start:{" "}
            {project?.startDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <a
          href={`/api/${params.companyId}/${params.projectId}/export/schedule`}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Export CSV
        </a>
      </div>

      {/* KPI cards */}
      {totalTasks > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-900">{doneTasks}/{totalTasks}</div>
            <div className="text-xs text-slate-500 mt-0.5">Tasks Complete</div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className={`bg-white rounded-xl border p-4 ${lateTasks > 0 ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
            <div className={`text-2xl font-bold ${lateTasks > 0 ? "text-red-600" : "text-slate-900"}`}>{lateTasks}</div>
            <div className="text-xs text-slate-500 mt-0.5">Late Tasks</div>
          </div>
          <div className={`bg-white rounded-xl border p-4 ${dueSoon7 > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
            <div className={`text-2xl font-bold ${dueSoon7 > 0 ? "text-amber-600" : "text-slate-900"}`}>{dueSoon7}</div>
            <div className="text-xs text-slate-500 mt-0.5">Due in 7 Days</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-900">{dueSoon14}</div>
            <div className="text-xs text-slate-500 mt-0.5">Due in 14 Days</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-900">{criticalCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Critical Path{" "}
              <span className="text-xs bg-slate-100 text-slate-500 px-1 rounded">beta</span>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No tasks yet. Import a schedule CSV in Settings.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Gantt Chart</h2>
              <p className="text-xs text-slate-400 mt-0.5">Click phase headers to expand/collapse</p>
            </div>
            <div className="p-4">
              <GanttChart tasks={ganttTasks} projectStart={project?.startDate ?? new Date()} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Task List</h2>
              <p className="text-xs text-slate-400 mt-0.5">Click phase headers to expand/collapse · Select status to update</p>
            </div>
            <TaskTable tasks={ganttTasks} projectId={params.projectId} canEdit={canEdit} />
          </div>

          {/* Recent change log */}
          {recentLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800">Recent Changes</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Task</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Field</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">From</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">To</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">
                        <span className="text-xs text-slate-400 mr-1">{log.task.phase}</span>
                        {log.task.name}
                      </td>
                      <td className="px-4 py-2 text-slate-500 capitalize">{log.field}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">
                        {log.oldValue ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-800 text-xs font-medium">
                        {log.newValue ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">
                        {format(log.changedAt, "MMM d, h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
