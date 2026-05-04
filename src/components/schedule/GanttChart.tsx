"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { differenceInDays, addDays, format } from "date-fns";
import { computeCriticalPath, parsePredLink, type GanttTask, type LinkType } from "@/lib/schedule/gantt";
import {
  rescheduleTask,
  updateTaskPredecessorLink,
  archiveTask,
} from "@/app/[companyId]/[projectId]/schedule/actions";

const CELL_WIDTH = 28;
const ROW_HEIGHT = 34;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 230;
const CIRCLE_R = 5;
const SNAP_DIST = 14;

const LINK_COLORS: Record<LinkType, string> = {
  FS: "#4b9cf5",
  SS: "#22c55e",
  FF: "#a855f7",
  SF: "#f97316",
};

function getLinkType(srcEnd: "start" | "finish", tgtEnd: "start" | "finish"): LinkType {
  if (srcEnd === "finish" && tgtEnd === "start") return "FS";
  if (srcEnd === "finish" && tgtEnd === "finish") return "FF";
  if (srcEnd === "start" && tgtEnd === "start") return "SS";
  return "SF";
}

type BarPos = { startX: number; finishX: number; centerY: number };

type DragState = {
  taskId: string;
  originalStart: Date;
  originalEnd: Date;
  startDayOffset: number;
  pointerStartX: number;
  currentDeltaDays: number;
};

type LinkDragState = {
  sourceTaskId: string;
  sourceEnd: "start" | "finish";
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
  snapTarget: { taskId: string; end: "start" | "finish" } | null;
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
  const [linkDrag, setLinkDrag] = useState<LinkDragState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [deletingPhase, setDeletingPhase] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const barPosRef = useRef<Map<string, BarPos>>(new Map());

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
    return new Map<string, GanttTask[]>(
      Array.from(map.entries()).sort(([, aT], [, bT]) => {
        const aMin = Math.min(...aT.map((t: GanttTask) => t.startDate.getTime()));
        const bMin = Math.min(...bT.map((t: GanttTask) => t.startDate.getTime()));
        return aMin - bMin;
      })
    );
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

  // Build bar positions — used for link drag snapping and arrow rendering
  const barPos = new Map<string, BarPos>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind !== "task") continue;
    const { task } = row;
    const y = rowYs[i];
    const startDay = differenceInDays(task.startDate, projectStart);
    const bx = LABEL_WIDTH + startDay * CELL_WIDTH;
    const bw = Math.max(task.durationDays * CELL_WIDTH, CELL_WIDTH);
    barPos.set(task.id, { startX: bx, finishX: bx + bw, centerY: y + ROW_HEIGHT / 2 });
  }
  barPosRef.current = barPos;

  // SVG coordinate helpers — work for both mouse and touch via PointerEvent
  const getSvgX = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    return clientX - svgRef.current.getBoundingClientRect().left;
  }, []);

  const getSvgY = useCallback((clientY: number) => {
    if (!svgRef.current) return 0;
    return clientY - svgRef.current.getBoundingClientRect().top;
  }, []);

  // Bar drag — pointer events work for mouse and touch
  const handleBarPointerDown = useCallback((e: React.PointerEvent, task: GanttTask) => {
    if (!canEdit || task.isMilestone || linkDrag) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      taskId: task.id,
      originalStart: task.startDate,
      originalEnd: task.endDate,
      startDayOffset: differenceInDays(task.startDate, projectStart),
      pointerStartX: getSvgX(e.clientX),
      currentDeltaDays: 0,
    });
  }, [canEdit, getSvgX, projectStart, linkDrag]);

  // Circle drag
  const handleCirclePointerDown = useCallback((
    e: React.PointerEvent,
    task: GanttTask,
    end: "start" | "finish",
    cx: number,
    cy: number,
  ) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setLinkDrag({ sourceTaskId: task.id, sourceEnd: end, sourceX: cx, sourceY: cy, currentX: cx, currentY: cy, snapTarget: null });
  }, [canEdit]);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag && !linkDrag) return;
    const svgX = getSvgX(e.clientX);

    if (drag) {
      const deltaDays = Math.round((svgX - drag.pointerStartX) / CELL_WIDTH);
      setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
      return;
    }

    if (linkDrag) {
      const svgY = getSvgY(e.clientY);
      let snapTarget: LinkDragState["snapTarget"] = null;
      for (const [taskId, pos] of Array.from(barPosRef.current)) {
        if (taskId === linkDrag.sourceTaskId) continue;
        if (Math.hypot(svgX - pos.startX, svgY - pos.centerY) < SNAP_DIST) {
          snapTarget = { taskId, end: "start" };
          break;
        }
        if (Math.hypot(svgX - pos.finishX, svgY - pos.centerY) < SNAP_DIST) {
          snapTarget = { taskId, end: "finish" };
          break;
        }
      }
      setLinkDrag(prev => prev ? { ...prev, currentX: svgX, currentY: svgY, snapTarget } : null);
    }
  }, [drag, linkDrag, getSvgX, getSvgY]);

  const handleSvgPointerUp = useCallback(async () => {
    // Bar drag
    if (drag) {
      const { taskId, originalStart, originalEnd, currentDeltaDays } = drag;
      setDrag(null);
      if (currentDeltaDays === 0) return;
      const newStart = addDays(originalStart, currentDeltaDays);
      const newEnd = addDays(originalEnd, currentDeltaDays);
      setSaving(taskId);
      try { await rescheduleTask(taskId, newStart, newEnd); }
      finally { setSaving(null); }
      return;
    }

    // Link drag
    if (linkDrag) {
      const { sourceTaskId, sourceEnd, snapTarget } = linkDrag;
      setLinkDrag(null);
      if (!snapTarget) return;
      const type = getLinkType(sourceEnd, snapTarget.end);
      await updateTaskPredecessorLink(snapTarget.taskId, sourceTaskId, type);
    }
  }, [drag, linkDrag]);

  const handleSvgPointerCancel = useCallback(() => {
    setDrag(null);
    setLinkDrag(null);
  }, []);

  const getBarColor = (task: GanttTask, isCritical: boolean) => {
    if (isCritical) return "#ef4444";
    if (task.status === "DONE") return "#22c55e";
    if (task.status === "IN_PROGRESS") return "#3b82f6";
    if (task.status === "BLOCKED") return "#f97316";
    return "#C9A84C";
  };

  const isDraggingAny = drag !== null || linkDrag !== null;
  const svgCursor = linkDrag ? "crosshair" : drag ? "grabbing" : "default";

  return (
    <div className="overflow-x-auto select-none" style={{ cursor: svgCursor }}>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerLeave={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerCancel}
        style={{
          display: "block",
          touchAction: isDraggingAny ? "none" : "pan-x pan-y",
        }}
      >
        {/* Arrow marker defs */}
        <defs>
          {(["FS", "SS", "FF", "SF"] as LinkType[]).map(t => (
            <marker key={t} id={`arr-${t}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L0,8 L8,4 z" fill={LINK_COLORS[t]} opacity={0.7} />
            </marker>
          ))}
          <marker id="arr-drag" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L0,8 L8,4 z" fill="#C9A84C" opacity={0.9} />
          </marker>
          <marker id="arr-snap" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L0,8 L8,4 z" fill="#22c55e" opacity={0.9} />
          </marker>
        </defs>

        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0d1117" />

        {/* Month headers */}
        {months.map((m) => (
          <g key={m.label}>
            <rect x={LABEL_WIDTH + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
            <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>{m.label}</text>
          </g>
        ))}

        {/* Day grid */}
        {Array.from({ length: totalDays }).map((_, d) => {
          const date = addDays(projectStart, d);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <rect key={d} x={LABEL_WIDTH + d * CELL_WIDTH} y={HEADER_H} width={CELL_WIDTH} height={svgHeight - HEADER_H - 30}
              fill={isWeekend ? "#0a0e14" : "transparent"} />
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
              x1={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH} y1={0}
              x2={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH} y2={svgHeight - 30}
              stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3"
            />
            <text x={LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH + 3} y={13} fontSize={9} fill="#ef4444">TODAY</text>
          </g>
        )}

        {/* Task rows */}
        {rows.map((row, i) => {
          const y = rowYs[i];

          if (row.kind === "phase") {
            const isCollapsed = collapsed.has(row.phase);
            const phaseStart = row.phaseTasks.reduce((min, t) => (t.startDate < min ? t.startDate : min), row.phaseTasks[0].startDate);
            const phaseEnd = row.phaseTasks.reduce((max, t) => (t.endDate > max ? t.endDate : max), row.phaseTasks[0].endDate);
            const bx = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
            const bw = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
            const done = row.phaseTasks.filter(t => t.status === "DONE").length;
            const pct = Math.round((done / row.phaseTasks.length) * 100);
            const isDeleting = deletingPhase === row.phase;
            return (
              <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                <text x={24} y={y + 17} fontSize={11} fill="#C9A84C" fontWeight={700}>{row.phase}</text>
                <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58">{" "}({row.phaseTasks.length} tasks · {pct}%)</text>
                <rect x={bx} y={y + 7} width={bw} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#30373f" />
                {pct > 0 && <rect x={bx} y={y + 7} width={(bw * pct) / 100} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#C9A84C" opacity={0.5} />}
                {canEdit && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDeleting) return;
                      setDeletingPhase(row.phase);
                      Promise.all(row.phaseTasks.map((t) => archiveTask(t.id))).finally(() =>
                        setDeletingPhase(null)
                      );
                    }}
                    style={{ cursor: isDeleting ? "wait" : "pointer" }}
                  >
                    <rect x={LABEL_WIDTH - 26} y={y + 5} width={18} height={18} rx={3} fill={isDeleting ? "#30373f" : "#3d1515"} />
                    <text x={LABEL_WIDTH - 19} y={y + 17} fontSize={11} fill={isDeleting ? "#484f58" : "#f87171"} fontWeight={700} textAnchor="middle">
                      {isDeleting ? "…" : "✕"}
                    </text>
                  </g>
                )}
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
          const isLinkSource = linkDrag?.sourceTaskId === task.id;
          // Circles: visible at 0.5 always (mobile-friendly), brighter on hover or during any drag
          const circleOpacity = isLinkSource ? 0 : (hoveredTaskId === task.id || linkDrag ? 0.9 : 0.5);
          const circleY = y + ROW_HEIGHT / 2;
          const isStartSnap = linkDrag?.snapTarget?.taskId === task.id && linkDrag.snapTarget.end === "start";
          const isFinishSnap = linkDrag?.snapTarget?.taskId === task.id && linkDrag.snapTarget.end === "finish";

          return (
            <g key={task.id}>
              <rect
                x={0} y={y} width={svgWidth} height={ROW_HEIGHT}
                fill={isEven ? "#0d1117" : "#0a0e14"}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => { if (!linkDrag) setHoveredTaskId(null); }}
              />
              <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke="#30373f" strokeWidth={0.3} />

              {/* Label */}
              <text x={16} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill={isCritical ? "#ef4444" : "#e6edf3"}>
                {task.name.length > 28 ? task.name.slice(0, 28) + "…" : task.name}
              </text>
              {task.trade && <text x={16} y={y + ROW_HEIGHT - 4} fontSize={9} fill="#484f58">{task.trade}</text>}

              {/* Bar */}
              {task.isMilestone ? (
                <polygon
                  points={`${barX},${y + 6} ${barX + 10},${y + ROW_HEIGHT / 2} ${barX},${y + ROW_HEIGHT - 6} ${barX - 10},${y + ROW_HEIGHT / 2}`}
                  fill="#7c3aed" opacity={isSaving ? 0.4 : 1}
                />
              ) : (
                <g>
                  {isDragging && (
                    <rect
                      x={LABEL_WIDTH + differenceInDays(task.startDate, projectStart) * CELL_WIDTH}
                      y={y + 8} width={width} height={ROW_HEIGHT - 16} rx={4}
                      fill={barColor} opacity={0.2} strokeDasharray="4,3" stroke={barColor} strokeWidth={1}
                    />
                  )}
                  <rect
                    x={barX} y={y + 8} width={width} height={ROW_HEIGHT - 16} rx={4}
                    fill={barColor} opacity={isSaving ? 0.4 : isDragging ? 0.9 : 0.75}
                    style={{ cursor: canEdit && !linkDrag ? "grab" : "default" }}
                    onPointerDown={(e) => handleBarPointerDown(e, task)}
                  />
                  {task.percentComplete > 0 && (
                    <rect x={barX} y={y + 8} width={(width * task.percentComplete) / 100} height={ROW_HEIGHT - 16} rx={4} fill={barColor} opacity={0.95} />
                  )}
                  {width > 32 && (
                    <text x={barX + 5} y={y + ROW_HEIGHT / 2 + 4} fontSize={9} fill="#fff" opacity={0.85}>{task.durationDays}d</text>
                  )}
                </g>
              )}

              {/* Connection circles (start + finish) */}
              {canEdit && !task.isMilestone && (
                <g>
                  <circle
                    cx={barX} cy={circleY} r={CIRCLE_R}
                    fill={isStartSnap ? "#22c55e" : "#161b22"}
                    stroke={isStartSnap ? "#22c55e" : "#8b949e"}
                    strokeWidth={1.5} opacity={isStartSnap ? 1 : circleOpacity}
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(e) => handleCirclePointerDown(e, task, "start", barX, circleY)}
                  />
                  <circle
                    cx={barX + width} cy={circleY} r={CIRCLE_R}
                    fill={isFinishSnap ? "#22c55e" : "#161b22"}
                    stroke={isFinishSnap ? "#22c55e" : "#8b949e"}
                    strokeWidth={1.5} opacity={isFinishSnap ? 1 : circleOpacity}
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(e) => handleCirclePointerDown(e, task, "finish", barX + width, circleY)}
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Predecessor link arrows */}
        <g style={{ pointerEvents: "none" }}>
          {tasks.flatMap((task) => {
            const succPos = barPos.get(task.id);
            if (!succPos) return [];
            return task.predecessorIds.map((encoded) => {
              const { id: predId, type } = parsePredLink(encoded);
              const predPos = barPos.get(predId);
              if (!predPos) return null;
              const x1 = (type === "FS" || type === "FF") ? predPos.finishX : predPos.startX;
              const y1 = predPos.centerY;
              const x2 = (type === "FS" || type === "SF") ? succPos.startX : succPos.finishX;
              const y2 = succPos.centerY;
              const color = LINK_COLORS[type];
              const cx1 = x1 + 36, cx2 = x2 - 36;
              return (
                <path
                  key={`${predId}-${task.id}-${type}`}
                  d={`M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                  stroke={color} strokeWidth={1.5} fill="none" opacity={0.55}
                  markerEnd={`url(#arr-${type})`}
                />
              );
            }).filter(Boolean);
          })}
        </g>

        {/* Link drag line */}
        {linkDrag && (() => {
          const snap = linkDrag.snapTarget;
          const snapPos = snap ? barPos.get(snap.taskId) : null;
          const tx = snap && snapPos ? (snap.end === "start" ? snapPos.startX : snapPos.finishX) : linkDrag.currentX;
          const ty = snap && snapPos ? snapPos.centerY : linkDrag.currentY;
          const snapped = !!snap;
          return (
            <line
              x1={linkDrag.sourceX} y1={linkDrag.sourceY}
              x2={tx} y2={ty}
              stroke={snapped ? "#22c55e" : "#C9A84C"}
              strokeWidth={2} strokeDasharray="7,4" opacity={0.9}
              markerEnd={snapped ? "url(#arr-snap)" : "url(#arr-drag)"}
              style={{ pointerEvents: "none" }}
            />
          );
        })()}

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
          Drag bars to reschedule · Drag the ○ circles on bar edges to link tasks (FS / SS / FF / SF)
        </p>
      )}
    </div>
  );
}
