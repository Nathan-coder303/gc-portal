export type GanttTask = {
  id: string;
  phase: string;
  name: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  isMilestone: boolean;
  isOnCriticalPath: boolean;
  predecessorIds: string[];
  status: string;
  percentComplete: number;
  trade: string | null;
  assignee: string | null;
};

export function computeCriticalPath(tasks: GanttTask[]): Set<string> {
  // Find the task(s) with the latest end date - simple critical path by latest end
  if (tasks.length === 0) return new Set();

  const idToTask = new Map(tasks.map((t) => [t.id, t]));
  const maxEnd = tasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), tasks[0].endDate);
  const critical = new Set<string>();

  // Backtrack from latest end task
  function markCritical(taskId: string) {
    if (critical.has(taskId)) return;
    critical.add(taskId);
    const task = idToTask.get(taskId);
    if (!task) return;
    for (const predId of task.predecessorIds) {
      markCritical(predId);
    }
  }

  for (const task of tasks) {
    if (task.endDate.getTime() === maxEnd.getTime()) {
      markCritical(task.id);
    }
  }

  return critical;
}
