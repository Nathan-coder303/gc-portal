"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { differenceInDays, addDays, format } from "date-fns";
import { computeCriticalPath, type GanttTask } from "@/lib/schedule/gantt";
import { rescheduleTask } from "@/app/[companyId]/[projectId]/schedule/actions";

const CELL_WIDTH = 28;
const ROW_HEIGHT = 34;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 230;

type DragState = {
  taskId: string;
  originalStart: Date;
  originalEnd: Date;
  startDayOffset: number; // day index of original bar start
  mouseStartX: number;    // svg-relative x at drag start
  currentDeltaDays: number;
};

export default function GanttChart({
  tasks,
  projectStart,
  canEdit,
}: {
  tasks: GanttTask[];
  projectStart: Date;
  canEdit?: boolean;
}) {
  const criticalPath = useMemo(() => computeCriticalPath(tasks), [tasks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toggle = (phase: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const phases = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.phase) ?? [];
      arr.push(t);
      map.set(t.phase, arr);
    }
    return map;
  }, [tasks]);

  const projectEnd = useMemo(() => {
    if (!tasks.length) return addDays(projectStart, 30);
    return tasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), tasks[0].endDate);
  }, [tasks, projectStart]);

  const totalDays = differenceInDays(projectEnd, projectStart) + 4;
  const today = new Date();

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

  const HEADER_H = 22;
  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;
  let yOffset = HEADER_H;
  const rowYs: number[] = [];
  for (const row of rows) {
    rowYs.push(yOffset);
    yOffset += row.kind === "phase" ? PHASE_ROW_HEIGHT : ROW_HEIGHT;
  }
  const svgHeight = yOffset + 30;

  // Drag handlers
  const getSvgX = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return clientX - rect.left;
  }, []);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: GanttTask) => {
    if (!canEdit || task.isMilestone) return;
    e.preventDefault();
    e.stopPropagation();
    const svgX = getSvgX(e.clientX);
    setDrag({
      taskId: task.id,
      originalStart: task.startDate,
      originalEnd: task.endDate,
      startDayOffset: differenceInDays(task.startDate, projectStart),
      mouseStartX: svgX,
      currentDeltaDays: 0,
    });
  }, [canEdit, getSvgX, projectStart]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const svgX = getSvgX(e.clientX);
    const deltaX = svgX - drag.mouseStartX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);
    setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
  }, [drag, getSvgX]);

  const handleSvgMouseUp = useCallback(async () => {
    if (!drag) return;
    const { taskId, originalStart, originalEnd, currentDeltaDays } = drag;
    setDrag(null);
    if (currentDeltaDays === 0) return;

    const newStart = addDays(originalStart, currentDeltaDays);
    const newEnd = addDays(originalEnd, currentDeltaDays);
    setSaving(taskId);
    try {
      await rescheduleTask(taskId, newStart, newEnd);
    } finally {
      setSaving(null);
    }
  }, [drag]);

  const getBarColor = (task: GanttTask, isCritical: boolean) => {
    if (isCritical) return "#ef4444";
    if (task.status === "DONE") return "#22c55e";
    if (task.status === "IN_PROGRESS") return "#3b82f6";
    if (task.status === "BLOCKED") return "#f97316";
    return "#C9A84C";
  };

  return (
    <div className="overflow-x-auto select-none" style={{ cursor: drag ? "grabbing" : "default" }}>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
        style={{ display: "block" }}
      >
        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0d1117" />

        {/* Month headers */}
        {months.map((m) => (
          <g key={m.label}>
            <rect x={LABEL_WIDTH + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
            <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>
              {m.label}
            </text>
          </g>
        ))}

        {/* Day grid lines */}
        {Array.from({ length: totalDays }).map((_, d) => {
          const date = addDays(projectStart, d);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <rect
              key={d}
              x={LABEL_WIDTH + d * CELL_WIDTH}
              y={HEADER_H}
              width={CELL_WIDTH}
              height={svgHeight - HEADER_H - 30}
              fill={isWeekend ? "#0a0e14" : "transparent"}
            />
          );
        })}

        {/* Vertical grid lines */}
        {Array.from({ length: totalDays }).map((_, d) => (
          <line key={`v${d}`} x1={LABEL_WIDTH + d * CELL_WIDTH} y1={HEADER_H} x2={LABEL_WIDTH + d * CELL_WIDTH} y2={svgHeight - 30} stroke="#30373f" strokeWidth={0.5} />
        ))}

        {/* Today line */}
        {today >= projectStart && today <= addDays(projectEnd, 4) && (
          <g>
            <line
              x1={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH}
              y1={0}
              x2={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH}
              y2={svgHeight - 30}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
            <text x={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH + 3} y={13} fontSize={9} fill="#ef4444">TODAY</text>
          </g>
        )}

        {/* Rows */}
        {rows.map((row, i) => {
          const y = rowYs[i];

          if (row.kind === "phase") {
            const isCollapsed = collapsed.has(row.phase);
            const phaseStart = row.phaseTasks.reduce((min, t) => (t.startDate < min ? t.startDate : min), row.phaseTasks[0].startDate);
            const phaseEnd = row.phaseTasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), row.phaseTasks[0].endDate);
            const barX = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
            const barW = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
            const done = row.phaseTasks.filter((t) => t.status === "DONE").length;
            const pct = Math.round((done / row.phaseTasks.length) * 100);

            return (
              <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                <text x={24} y={y + 17} fontSize={11} fill="#C9A84C" fontWeight={700}>{row.phase}</text>
                <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58">
                  {" "}({row.phaseTasks.length} tasks · {pct}%)
                </text>
                {/* Phase rollup bar */}
                <rect x={barX} y={y + 7} width={barW} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#30373f" />
                {pct > 0 && <rect x={barX} y={y + 7} width={(barW * pct) / 100} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#C9A84C" opacity={0.5} />}
              </g>
            );
          }

          const { task } = row;
          const isCritical = criticalPath.has(task.id);
          const isSaving = saving === task.id;
          const isDragging = drag?.taskId === task.id;
          const deltaDays = isDragging ? drag!.currentDeltaDays : 0;

          const startDay = differenceInDays(task.startDate, projectStart) + deltaDays;
          const barX = LABEL_WIDTH + startDay * CELL_WIDTH;
          const width = Math.max(task.durationDays * CELL_WIDTH, CELL_WIDTH);
          const barColor = getBarColor(task, isCritical);
          const isEven = row.rowNum % 2 === 0;

          return (
            <g key={task.id}>
              <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT} fill={isEven ? "#0d1117" : "#0a0e14"} />
              <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke="#30373f" strokeWidth={0.3} />

              {/* Label */}
              <text x={16} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill={isCritical ? "#ef4444" : "#e6edf3"}>
                {task.name.length > 28 ? task.name.slice(0, 28) + "…" : task.name}
              </text>
              {task.trade && (
                <text x={16} y={y + ROW_HEIGHT - 4} fontSize={9} fill="#484f58">{task.trade}</text>
              )}

              {/* Bar / Milestone */}
              {task.isMilestone ? (
                <polygon
                  points={`${barX},${y + 6} ${barX + 10},${y + ROW_HEIGHT / 2} ${barX},${y + ROW_HEIGHT - 6} ${barX - 10},${y + ROW_HEIGHT / 2}`}
                  fill="#7c3aed"
                  opacity={isSaving ? 0.4 : 1}
                />
              ) : (
                <g>
                  {/* Ghost bar during drag */}
                  {isDragging && (
                    <rect
                      x={LABEL_WIDTH + differenceInDays(task.startDate, projectStart) * CELL_WIDTH}
                      y={y + 8}
                      width={width}
                      height={ROW_HEIGHT - 16}
                      rx={4}
                      fill={barColor}
                      opacity={0.2}
                      strokeDasharray="4,3"
                      stroke={barColor}
                      strokeWidth={1}
                    />
                  )}
                  <rect
                    x={barX}
                    y={y + 8}
                    width={width}
                    height={ROW_HEIGHT - 16}
                    rx={4}
                    fill={barColor}
                    opacity={isSaving ? 0.4 : isDragging ? 0.9 : 0.75}
                    style={{ cursor: canEdit ? "grab" : "default" }}
                    onMouseDown={(e) => handleBarMouseDown(e, task)}
                  />
                  {/* Progress fill */}
                  {task.percentComplete > 0 && (
                    <rect
                      x={barX}
                      y={y + 8}
                      width={(width * task.percentComplete) / 100}
                      height={ROW_HEIGHT - 16}
                      rx={4}
                      fill={barColor}
                      opacity={0.95}
                    />
                  )}
                  {/* Duration label inside bar */}
                  {width > 32 && (
                    <text x={barX + 5} y={y + ROW_HEIGHT / 2 + 4} fontSize={9} fill="#fff" opacity={0.85}>
                      {task.durationDays}d
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 16})`}>
          {[
            { color: "#ef4444", label: "Critical" },
            { color: "#3b82f6", label: "In Progress" },
            { color: "#22c55e", label: "Done" },
            { color: "#f97316", label: "Blocked" },
            { color: "#C9A84C", label: "Not Started" },
            { color: "#7c3aed", label: "Milestone" },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 105}, 0)`}>
              <rect x={0} y={-8} width={10} height={10} fill={item.color} rx={2} />
              <text x={13} y={0} fontSize={10} fill="#484f58">{item.label}</text>
            </g>
          ))}
        </g>
      </svg>

      {canEdit && (
        <p className="text-xs mt-2" style={{ color: "#484f58" }}>
          Drag bars left/right to reschedule · Weekends shown in darker columns
        </p>
      )}
    </div>
  );
}
