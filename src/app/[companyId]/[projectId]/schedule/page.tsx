import { prisma } from "@/lib/prisma";
import { addDays, format } from "date-fns";
import GanttChart from "@/components/schedule/GanttChart";
import TaskTable from "@/components/schedule/TaskTable";
import LoadTemplateButton from "@/components/schedule/LoadTemplateButton";
import { computeCriticalPath } from "@/lib/schedule/gantt";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;
const CARD_RED = { background: "#2d1b1b", border: "1px solid #6b2a2a" } as const;
const CARD_AMBER = { background: "#2d2410", border: "1px solid #6b4f10" } as const;

export default async function SchedulePage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  const canEdit = can(session?.user.role ?? "PARTNER", "task:edit");
  const isPartner = session?.user.role === "PARTNER";
  const userName = session?.user.name?.trim() ?? null;

  // PARTNER: filter tasks to only those assigned to them
  const taskWhere = isPartner && userName
    ? { projectId: params.projectId, archivedAt: null, assignee: { contains: userName, mode: "insensitive" as const } }
    : { projectId: params.projectId, archivedAt: null };

  const [tasks, project, recentLogs] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
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

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const lateTasks = tasks.filter((t) => t.status !== "DONE" && t.endDate && t.endDate < today).length;
  const dueSoon7 = tasks.filter((t) => t.status !== "DONE" && t.endDate && t.endDate >= today && t.endDate <= in7).length;
  const dueSoon14 = tasks.filter((t) => t.status !== "DONE" && t.endDate && t.endDate > in7 && t.endDate <= in14).length;
  const criticalPathIds = computeCriticalPath(ganttTasks);
  const criticalCount = criticalPathIds.size;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Schedule</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
            {totalTasks} tasks · Project start:{" "}
            {project?.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <LoadTemplateButton projectId={params.projectId} />}
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/schedule`}
            className="px-3 py-1.5 text-sm rounded-lg font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            Export CSV
          </a>
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl p-4" style={CARD}>
            <div className="text-2xl font-bold" style={{ color: "#e6edf3" }}>{doneTasks}/{totalTasks}</div>
            <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Tasks Complete</div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
              <div className="h-full rounded-full" style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`, background: "#4ade80" }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={lateTasks > 0 ? CARD_RED : CARD}>
            <div className="text-2xl font-bold" style={{ color: lateTasks > 0 ? "#f87171" : "#e6edf3" }}>{lateTasks}</div>
            <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Late Tasks</div>
          </div>
          <div className="rounded-xl p-4" style={dueSoon7 > 0 ? CARD_AMBER : CARD}>
            <div className="text-2xl font-bold" style={{ color: dueSoon7 > 0 ? "#fbbf24" : "#e6edf3" }}>{dueSoon7}</div>
            <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Due in 7 Days</div>
          </div>
          <div className="rounded-xl p-4" style={CARD}>
            <div className="text-2xl font-bold" style={{ color: "#e6edf3" }}>{dueSoon14}</div>
            <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Due in 14 Days</div>
          </div>
          <div className="rounded-xl p-4" style={CARD}>
            <div className="text-2xl font-bold" style={{ color: "#e6edf3" }}>{criticalCount}</div>
            <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
              Critical Path{" "}
              <span className="text-xs px-1 rounded" style={{ background: "#30373f", color: "#8b949e" }}>beta</span>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={CARD}>
          <p style={{ color: "#8b949e" }}>No tasks yet.</p>
          <p className="text-sm mt-2" style={{ color: "#484f58" }}>Use the template dropdown above to get started, or import a CSV in Settings.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden" style={CARD}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
              <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Gantt Chart</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Click phase headers to expand/collapse</p>
            </div>
            <div className="p-4">
              <GanttChart tasks={ganttTasks} projectStart={project?.startDate ?? new Date()} canEdit={canEdit} />
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={CARD}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
              <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Task List</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Click phase headers to expand/collapse · Select status to update</p>
            </div>
            <TaskTable tasks={ganttTasks} projectId={params.projectId} canEdit={canEdit} />
          </div>

          {recentLogs.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={CARD}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
                <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Recent Changes</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Task</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Field</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>From</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>To</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #30373f" }}>
                      <td className="px-4 py-2 font-medium" style={{ color: "#e6edf3" }}>
                        <span className="text-xs mr-1" style={{ color: "#8b949e" }}>{log.task.phase}</span>
                        {log.task.name}
                      </td>
                      <td className="px-4 py-2 capitalize" style={{ color: "#8b949e" }}>{log.field}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: "#8b949e" }}>{log.oldValue ?? "—"}</td>
                      <td className="px-4 py-2 text-xs font-medium" style={{ color: "#e6edf3" }}>{log.newValue ?? "—"}</td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: "#8b949e" }}>
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
