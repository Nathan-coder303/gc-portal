import Papa from "papaparse";
import { z } from "zod";
import { addDays } from "date-fns";

const TaskRowSchema = z.object({
  phase: z.string().min(1, "Phase required"),
  task_name: z.string().min(1, "Task name required"),
  duration_days: z.string().refine((v) => !isNaN(parseInt(v)) && parseInt(v) >= 0, "Invalid duration"),
  predecessor_task: z.string().optional(),
  trade: z.string().optional(),
  milestone: z.string().optional(),
  default_assignee: z.string().optional(),
});

export type ParsedTaskRow = {
  phase: string;
  name: string;
  durationDays: number;
  predecessorName: string;
  trade: string;
  isMilestone: boolean;
  assignee: string;
  rowIndex: number;
};

export type ScheduleParseResult = {
  tasks: (ParsedTaskRow & { startDate: Date; endDate: Date; predecessorIds: string[] })[];
  errors: { row: number; field: string; message: string }[];
};

export function parseScheduleCsv(csvText: string, projectStartDate: Date): ScheduleParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rawRows: ParsedTaskRow[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    const parsed = TaskRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row: i + 2, field: String(issue.path[0] ?? "unknown"), message: issue.message });
      }
    } else {
      const d = parsed.data;
      rawRows.push({
        phase: d.phase,
        name: d.task_name,
        durationDays: parseInt(d.duration_days),
        predecessorName: d.predecessor_task ?? "",
        trade: d.trade ?? "",
        isMilestone: d.milestone?.toLowerCase() === "true",
        assignee: d.default_assignee ?? "",
        rowIndex: i + 2,
      });
    }
  }

  if (errors.length > 0) return { tasks: [], errors };

  // Build adjacency list for Kahn's topo sort
  const nameToIndex = new Map<string, number>();
  rawRows.forEach((r, i) => nameToIndex.set(r.name, i));

  const inDegree = new Array(rawRows.length).fill(0);
  const adj: number[][] = rawRows.map(() => []);

  for (let i = 0; i < rawRows.length; i++) {
    const predName = rawRows[i].predecessorName;
    if (predName) {
      const predIdx = nameToIndex.get(predName);
      if (predIdx === undefined) {
        errors.push({ row: rawRows[i].rowIndex, field: "predecessor_task", message: `Unknown predecessor: "${predName}"` });
        continue;
      }
      adj[predIdx].push(i);
      inDegree[i]++;
    }
  }

  if (errors.length > 0) return { tasks: [], errors };

  // Kahn's algorithm
  const queue: number[] = [];
  const sortedIndices: number[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  while (queue.length > 0) {
    const idx = queue.shift()!;
    sortedIndices.push(idx);
    for (const neighbor of adj[idx]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sortedIndices.length !== rawRows.length) {
    errors.push({ row: 0, field: "predecessor_task", message: "Cycle detected in task dependencies" });
    return { tasks: [], errors };
  }

  // Forward pass: compute dates
  const offsets = new Array(rawRows.length).fill(0);
  for (const idx of sortedIndices) {
    const predName = rawRows[idx].predecessorName;
    if (predName) {
      const predIdx = nameToIndex.get(predName)!;
      offsets[idx] = offsets[predIdx] + rawRows[predIdx].durationDays;
    }
  }

  // Assign temporary IDs for predecessor resolution
  const tempIds = rawRows.map((_, i) => `temp-${i}`);

  const tasks = rawRows.map((r, i) => {
    const startDate = addDays(projectStartDate, offsets[i]);
    const endDate = r.isMilestone ? startDate : addDays(startDate, r.durationDays - 1);
    const predecessorIds = r.predecessorName
      ? [tempIds[nameToIndex.get(r.predecessorName)!]]
      : [];
    return { ...r, startDate, endDate, predecessorIds };
  });

  return { tasks, errors: [] };
}
