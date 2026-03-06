import { prisma } from "@/lib/prisma";
import GanttChart from "@/components/schedule/GanttChart";
import TaskTable from "@/components/schedule/TaskTable";

export default async function SchedulePage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const tasks = await prisma.task.findMany({
    where: { projectId: params.projectId },
    orderBy: [{ phase: "asc" }, { startDate: "asc" }],
  });

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tasks.length} tasks · Project start:{" "}
            {project?.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <a
          href={`/api/${params.companyId}/${params.projectId}/export/schedule`}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Export CSV
        </a>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No tasks yet. Import a schedule CSV in Settings.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Gantt Chart</h2>
            </div>
            <div className="p-4">
              <GanttChart tasks={ganttTasks} projectStart={project?.startDate ?? new Date()} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Task List</h2>
            </div>
            <TaskTable tasks={ganttTasks} projectId={params.projectId} />
          </div>
        </div>
      )}
    </div>
  );
}
