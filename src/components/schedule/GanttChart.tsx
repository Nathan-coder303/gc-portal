"use client";

import { useMemo, useState } from "react";
import { differenceInDays, addDays, format } from "date-fns";
import { computeCriticalPath, type GanttTask } from "@/lib/schedule/gantt";

const CELL_WIDTH = 24;
const ROW_HEIGHT = 32;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 220;

export default function GanttChart({
  tasks,
  projectStart,
}: {
  tasks: GanttTask[];
  projectStart: Date;
}) {
  const criticalPath = useMemo(() => computeCriticalPath(tasks), [tasks]);

  // Group tasks by phase
  const phases = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.phase) ?? [];
      arr.push(t);
      map.set(t.phase, arr);
    }
    return map;
  }, [tasks]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (phase: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const projectEnd = useMemo(() => {
    if (!tasks.length) return addDays(projectStart, 30);
    return tasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), tasks[0].endDate);
  }, [tasks, projectStart]);

  const totalDays = differenceInDays(projectEnd, projectStart) + 2;
  const today = new Date();

  // Month headers
  const months: { label: string; startDay: number; days: number }[] = [];
  let cursor = new Date(projectStart);
  while (cursor <= projectEnd) {
    const startDay = differenceInDays(cursor, projectStart);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const end = monthEnd < projectEnd ? monthEnd : projectEnd;
    const days = differenceInDays(end, cursor) + 1;
    months.push({ label: format(cursor, "MMM yyyy"), startDay, days });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Build rows: phase header + (if not collapsed) task rows
  type Row =
    | { kind: "phase"; phase: string; phaseTasks: GanttTask[] }
    | { kind: "task"; task: GanttTask; rowNum: number };

  const rows: Row[] = [];
  let rowNum = 0;
  for (const [phase, phaseTasks] of Array.from(phases.entries())) {
    rows.push({ kind: "phase", phase, phaseTasks });
    if (!collapsed.has(phase)) {
      for (const task of phaseTasks) {
        rows.push({ kind: "task", task, rowNum });
        rowNum++;
      }
    }
  }

  const HEADER_H = 20;
  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;
  let yOffset = HEADER_H;
  const rowYs: number[] = [];
  for (const row of rows) {
    rowYs.push(yOffset);
    yOffset += row.kind === "phase" ? PHASE_ROW_HEIGHT : ROW_HEIGHT;
  }
  const svgHeight = yOffset + 28; // +legend

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="text-xs select-none">
        {/* Month headers */}
        {months.map((m) => (
          <g key={m.label}>
            <rect
              x={LABEL_WIDTH + m.startDay * CELL_WIDTH}
              y={0}
              width={m.days * CELL_WIDTH}
              height={HEADER_H}
              fill="#f1f5f9"
              stroke="#e2e8f0"
            />
            <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 4} y={14} fontSize={10} fill="#64748b" fontWeight={600}>
              {m.label}
            </text>
          </g>
        ))}

        {/* Day grid lines */}
        {Array.from({ length: totalDays }).map((_, d) => (
          <line
            key={d}
            x1={LABEL_WIDTH + d * CELL_WIDTH}
            y1={HEADER_H}
            x2={LABEL_WIDTH + d * CELL_WIDTH}
            y2={svgHeight - 28}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}

        {/* Today line */}
        {today >= projectStart && today <= projectEnd && (
          <line
            x1={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH}
            y1={0}
            x2={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH}
            y2={svgHeight - 28}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}

        {/* Rows */}
        {rows.map((row, i) => {
          const y = rowYs[i];
          if (row.kind === "phase") {
            const isCollapsed = collapsed.has(row.phase);
            // Phase summary bar (min/max of tasks)
            const phaseStart = row.phaseTasks.reduce(
              (min, t) => (t.startDate < min ? t.startDate : min),
              row.phaseTasks[0].startDate
            );
            const phaseEnd = row.phaseTasks.reduce(
              (max, t) => (t.endDate > max ? t.endDate : max),
              row.phaseTasks[0].endDate
            );
            const barX = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
            const barW = Math.max(
              (differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH,
              CELL_WIDTH
            );
            const done = row.phaseTasks.filter((t) => t.status === "DONE").length;
            const pct = Math.round((done / row.phaseTasks.length) * 100);

            return (
              <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#f8fafc" />
                {/* Collapse arrow */}
                <text x={6} y={y + 18} fontSize={10} fill="#475569" fontWeight={700}>
                  {isCollapsed ? "▶" : "▼"}
                </text>
                <text x={22} y={y + 18} fontSize={11} fill="#1e293b" fontWeight={700}>
                  {row.phase}
                </text>
                <text x={22 + row.phase.length * 7} y={y + 18} fontSize={10} fill="#94a3b8">
                  {" "}({row.phaseTasks.length} tasks · {pct}% done)
                </text>
                {/* Phase bar */}
                <rect x={barX} y={y + 6} width={barW} height={PHASE_ROW_HEIGHT - 12} rx={3} fill="#cbd5e1" opacity={0.7} />
                {pct > 0 && (
                  <rect x={barX} y={y + 6} width={(barW * pct) / 100} height={PHASE_ROW_HEIGHT - 12} rx={3} fill="#64748b" />
                )}
              </g>
            );
          }

          // Task row
          const { task } = row;
          const isCritical = criticalPath.has(task.id);
          const startX = LABEL_WIDTH + differenceInDays(task.startDate, projectStart) * CELL_WIDTH;
          const width = Math.max(task.durationDays * CELL_WIDTH, CELL_WIDTH);
          const barColor = isCritical
            ? "#ef4444"
            : task.status === "DONE"
            ? "#22c55e"
            : task.status === "IN_PROGRESS"
            ? "#3b82f6"
            : task.status === "BLOCKED"
            ? "#f97316"
            : "#94a3b8";
          const isEven = row.rowNum % 2 === 0;

          return (
            <g key={task.id}>
              <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT} fill={isEven ? "#fff" : "#f8fafc"} />
              <text x={16} y={y + 20} fontSize={11} fill="#334155">
                {task.name.length > 26 ? task.name.slice(0, 26) + "…" : task.name}
              </text>
              {task.isMilestone ? (
                <polygon
                  points={`${startX},${y + 8} ${startX + 8},${y + 16} ${startX},${y + 24} ${startX - 8},${y + 16}`}
                  fill="#7c3aed"
                />
              ) : (
                <g>
                  <rect x={startX} y={y + 8} width={width} height={ROW_HEIGHT - 16} rx={3} fill={barColor} opacity={0.8} />
                  {task.percentComplete > 0 && (
                    <rect
                      x={startX}
                      y={y + 8}
                      width={(width * task.percentComplete) / 100}
                      height={ROW_HEIGHT - 16}
                      rx={3}
                      fill={barColor}
                    />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 18})`}>
          {[
            { color: "#ef4444", label: "Critical Path" },
            { color: "#3b82f6", label: "In Progress" },
            { color: "#22c55e", label: "Done" },
            { color: "#f97316", label: "Blocked" },
            { color: "#94a3b8", label: "Not Started" },
            { color: "#7c3aed", label: "Milestone" },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 115}, 0)`}>
              <rect x={0} y={-8} width={10} height={10} fill={item.color} rx={2} />
              <text x={13} y={0} fontSize={10} fill="#64748b">{item.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
