"use client";

import { useMemo } from "react";
import { differenceInDays, addDays, format } from "date-fns";
import { computeCriticalPath, type GanttTask } from "@/lib/schedule/gantt";

const CELL_WIDTH = 24; // pixels per day
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 200;

export default function GanttChart({
  tasks,
  projectStart,
}: {
  tasks: GanttTask[];
  projectStart: Date;
}) {
  const criticalPath = useMemo(() => computeCriticalPath(tasks), [tasks]);

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

  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;
  const svgHeight = (tasks.length + 1) * ROW_HEIGHT + 40;

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="text-xs">
        {/* Month headers */}
        {months.map((m) => (
          <g key={m.label}>
            <rect
              x={LABEL_WIDTH + m.startDay * CELL_WIDTH}
              y={0}
              width={m.days * CELL_WIDTH}
              height={20}
              fill="#f1f5f9"
              stroke="#e2e8f0"
            />
            <text
              x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 4}
              y={14}
              fontSize={10}
              fill="#64748b"
              fontWeight={600}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Day grid lines */}
        {Array.from({ length: totalDays }).map((_, d) => (
          <line
            key={d}
            x1={LABEL_WIDTH + d * CELL_WIDTH}
            y1={20}
            x2={LABEL_WIDTH + d * CELL_WIDTH}
            y2={svgHeight}
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
            y2={svgHeight}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}

        {/* Tasks */}
        {tasks.map((task, i) => {
          const y = 20 + i * ROW_HEIGHT + 4;
          const startX = LABEL_WIDTH + differenceInDays(task.startDate, projectStart) * CELL_WIDTH;
          const width = Math.max(task.durationDays * CELL_WIDTH, CELL_WIDTH);
          const isCritical = criticalPath.has(task.id);
          const barColor = isCritical
            ? "#ef4444"
            : task.status === "DONE"
            ? "#22c55e"
            : task.status === "IN_PROGRESS"
            ? "#3b82f6"
            : task.status === "BLOCKED"
            ? "#f97316"
            : "#94a3b8";

          return (
            <g key={task.id}>
              {/* Row background */}
              <rect x={0} y={20 + i * ROW_HEIGHT} width={svgWidth} height={ROW_HEIGHT} fill={i % 2 === 0 ? "#fff" : "#f8fafc"} />

              {/* Task label */}
              <text x={4} y={y + 16} fontSize={11} fill="#334155" className="font-medium">
                {task.name.length > 22 ? task.name.slice(0, 22) + "…" : task.name}
              </text>

              {task.isMilestone ? (
                // Diamond for milestones
                <polygon
                  points={`${startX},${y + 8} ${startX + 8},${y + 16} ${startX},${y + 24} ${startX - 8},${y + 16}`}
                  fill="#7c3aed"
                />
              ) : (
                // Bar
                <g>
                  <rect
                    x={startX}
                    y={y + 6}
                    width={width}
                    height={ROW_HEIGHT - 14}
                    rx={3}
                    fill={barColor}
                    opacity={0.85}
                  />
                  {task.percentComplete > 0 && (
                    <rect
                      x={startX}
                      y={y + 6}
                      width={(width * task.percentComplete) / 100}
                      height={ROW_HEIGHT - 14}
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
        <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 20})`}>
          {[
            { color: "#ef4444", label: "Critical Path" },
            { color: "#3b82f6", label: "In Progress" },
            { color: "#22c55e", label: "Done" },
            { color: "#94a3b8", label: "Not Started" },
            { color: "#7c3aed", label: "Milestone" },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 110}, 0)`}>
              <rect x={0} y={-8} width={10} height={10} fill={item.color} rx={2} />
              <text x={13} y={0} fontSize={10} fill="#64748b">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
