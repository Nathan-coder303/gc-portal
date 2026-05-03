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

export type LinkType = "FS" | "SS" | "FF" | "SF";

// Encoded as "predId|TYPE" (e.g. "cm123|FS"). Legacy bare IDs default to FS.
export function parsePredLink(encoded: string): { id: string; type: LinkType } {
  if (encoded.includes("|")) {
    const sep = encoded.lastIndexOf("|");
    const id = encoded.slice(0, sep);
    const raw = encoded.slice(sep + 1);
    if (raw === "SS" || raw === "FF" || raw === "SF") return { id, type: raw };
    return { id, type: "FS" };
  }
  return { id: encoded, type: "FS" };
}

export function computeCriticalPath(tasks: GanttTask[]): Set<string> {
  if (tasks.length === 0) return new Set();

  const idToTask = new Map(tasks.map((t) => [t.id, t]));
  const maxEnd = tasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), tasks[0].endDate);
  const critical = new Set<string>();

  function markCritical(taskId: string) {
    if (critical.has(taskId)) return;
    critical.add(taskId);
    const task = idToTask.get(taskId);
    if (!task) return;
    for (const encoded of task.predecessorIds) {
      markCritical(parsePredLink(encoded).id);
    }
  }

  for (const task of tasks) {
    if (task.endDate.getTime() === maxEnd.getTime()) {
      markCritical(task.id);
    }
  }

  return critical;
}
