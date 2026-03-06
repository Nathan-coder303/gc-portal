import Papa from "papaparse";
import { z } from "zod";
import { addDays } from "date-fns";

// Accepts ProjectManager.com export columns as well as native format.
// Column aliases — header is normalized to lowercase + underscores.
const ALIASES: Record<string, string[]> = {
  phase:        ["phase", "wbs_phase", "group", "wbs"],
  task_name:    ["task_name", "name", "task_name", "task"],
  duration_days:["duration_days", "duration", "days"],
  predecessor:  ["predecessor", "predecessors", "predecessor_task", "predecessor_id", "depends_on"],
  trade:        ["trade", "resource_names", "resource", "resources"],
  milestone:    ["milestone", "is_milestone", "type"],
  assignee:     ["assignee", "default_assignee", "assigned_to", "owner"],
};

const TaskRowSchema = z.object({
  phase:         z.string().min(1, "Phase required"),
  task_name:     z.string().min(1, "Task name required"),
  duration_days: z.string().refine(
    (v) => !isNaN(parseInt(v.replace(/[^0-9]/g, ""))) && parseInt(v.replace(/[^0-9]/g, "")) >= 0,
    "Invalid duration"
  ),
  predecessor:   z.string().optional(),
  trade:         z.string().optional(),
  milestone:     z.string().optional(),
  assignee:      z.string().optional(),
});

export type ParsedTaskRow = {
  phase: string;
  name: string;
  durationDays: number;
  predecessorNames: string[]; // may be multiple
  trade: string;
  isMilestone: boolean;
  assignee: string;
  rowIndex: number;
};

export type ScheduleParseResult = {
  tasks: (ParsedTaskRow & { startDate: Date; endDate: Date; predecessorIds: string[] })[];
  errors: { row: number; field: string; message: string }[];
  cycleChains: string[][]; // task names forming each cycle
};

/** Normalize a raw CSV header object to our canonical field names */
function normalizeRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  // Build a lookup: normalized header → original value
  const headerMap = new Map<string, string>();
  for (const [key, val] of Object.entries(raw)) {
    headerMap.set(key.trim().toLowerCase().replace(/[\s\-/]+/g, "_"), val);
  }
  for (const [field, aliasList] of Object.entries(ALIASES)) {
    for (const alias of aliasList) {
      if (headerMap.has(alias)) {
        out[field] = headerMap.get(alias) ?? "";
        break;
      }
    }
    if (!out[field]) out[field] = "";
  }
  return out;
}

/** DFS cycle detection — returns arrays of indices forming cycles */
function findCycleChains(adj: number[][]): number[][] {
  const n = adj.length;
  const color = new Array(n).fill(0); // 0=white 1=gray 2=black
  const parent = new Array(n).fill(-1);
  const cycles: number[][] = [];

  function dfs(u: number) {
    color[u] = 1;
    for (const v of adj[u]) {
      if (color[v] === 1) {
        // Found back edge u→v — trace chain from v back to v through parent
        const chain: number[] = [v];
        let cur = u;
        while (cur !== v && cur !== -1) {
          chain.unshift(cur);
          cur = parent[cur];
        }
        chain.unshift(v); // close the loop label
        cycles.push(chain);
      } else if (color[v] === 0) {
        parent[v] = u;
        dfs(v);
      }
    }
    color[u] = 2;
  }

  for (let i = 0; i < n; i++) {
    if (color[i] === 0) dfs(i);
  }
  return cycles;
}

export function parseScheduleCsv(csvText: string, projectStartDate: Date): ScheduleParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rawRows: ParsedTaskRow[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const normalized = normalizeRow(result.data[i]);
    const parsed = TaskRowSchema.safeParse(normalized);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row: i + 2, field: String(issue.path[0] ?? "unknown"), message: issue.message });
      }
    } else {
      const d = parsed.data;
      const durationStr = d.duration_days.replace(/[^0-9]/g, "");
      const duration = parseInt(durationStr) || 0;

      // Predecessors may be comma-separated names or IDs
      const predRaw = d.predecessor?.trim() ?? "";
      const predecessorNames = predRaw
        ? predRaw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
        : [];

      const milestoneVal = d.milestone?.toLowerCase() ?? "";
      const isMilestone =
        milestoneVal === "true" ||
        milestoneVal === "yes" ||
        milestoneVal === "1" ||
        milestoneVal === "milestone" ||
        duration === 0;

      rawRows.push({
        phase: d.phase,
        name: d.task_name,
        durationDays: duration,
        predecessorNames,
        trade: d.trade ?? "",
        isMilestone,
        assignee: d.assignee ?? "",
        rowIndex: i + 2,
      });
    }
  }

  if (errors.length > 0) return { tasks: [], errors, cycleChains: [] };

  // Build adjacency list
  const nameToIndex = new Map<string, number>();
  rawRows.forEach((r, i) => nameToIndex.set(r.name, i));

  const inDegree = new Array(rawRows.length).fill(0);
  const adj: number[][] = rawRows.map(() => []);

  for (let i = 0; i < rawRows.length; i++) {
    for (const predName of rawRows[i].predecessorNames) {
      const predIdx = nameToIndex.get(predName);
      if (predIdx === undefined) {
        errors.push({
          row: rawRows[i].rowIndex,
          field: "predecessor",
          message: `Unknown predecessor: "${predName}"`,
        });
      } else {
        adj[predIdx].push(i);
        inDegree[i]++;
      }
    }
  }

  if (errors.length > 0) return { tasks: [], errors, cycleChains: [] };

  // Kahn's topological sort
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
    // Cycle detected — find chains and report them
    const rawCycles = findCycleChains(adj);
    const cycleChains = rawCycles.map((chain) =>
      chain.map((idx) => rawRows[idx]?.name ?? `task[${idx}]`)
    );
    const chainDesc = cycleChains
      .slice(0, 3)
      .map((c) => c.join(" → "))
      .join("; ");
    errors.push({
      row: 0,
      field: "predecessor",
      message: `Circular dependency detected: ${chainDesc}`,
    });
    return { tasks: [], errors, cycleChains };
  }

  // Forward pass: compute start/end dates
  // offsets[i] = number of days from projectStart to task i's start
  const offsets = new Array(rawRows.length).fill(0);
  for (const idx of sortedIndices) {
    let maxPredEnd = 0;
    for (const predName of rawRows[idx].predecessorNames) {
      const predIdx = nameToIndex.get(predName)!;
      maxPredEnd = Math.max(maxPredEnd, offsets[predIdx] + rawRows[predIdx].durationDays);
    }
    offsets[idx] = maxPredEnd;
  }

  const tempIds = rawRows.map((_, i) => `temp-${i}`);

  const tasks = rawRows.map((r, i) => {
    const startDate = addDays(projectStartDate, offsets[i]);
    const endDate = r.isMilestone ? startDate : addDays(startDate, r.durationDays - 1);
    const predecessorIds = r.predecessorNames.map(
      (name) => tempIds[nameToIndex.get(name)!]
    );
    return { ...r, startDate, endDate, predecessorIds };
  });

  return { tasks, errors: [], cycleChains: [] };
}
