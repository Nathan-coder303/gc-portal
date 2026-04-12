"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { differenceInDays, addDays, format } from "date-fns";

const GOLD = "#C9A84C";
const CELL_WIDTH = 28;
const ROW_HEIGHT = 36;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 240;
const HEADER_H = 22;
const RESIZE_HANDLE_W = 8;

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: GOLD,
  IN_PROGRESS: "#3b82f6",
  DONE: "#22c55e",
  BLOCKED: "#f97316",
};

const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"];

type ClientTask = {
  id: string;
  phase: string;
  name: string;
  durationDays: number;
  startDate: string | null;
  endDate: string | null;
  predecessorIds: string[];
  parentId: string | null;
  trade: string | null;
  assignee: string | null;
  isMilestone: boolean;
  status: string;
  percentComplete: number;
  notes: string | null;
};

type DragState = {
  taskId: string;
  type: "move" | "resize";
  originalStart: Date;
  originalEnd: Date;
  mouseStartX: number;
  currentDeltaDays: number;
};

const INPUT = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  task,
  allTasks,
  companyId,
  clientId,
  onSave,
  onDelete,
  onClose,
}: {
  task: ClientTask;
  allTasks: ClientTask[];
  companyId: string;
  clientId: string;
  onSave: (updated: ClientTask) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: task.name,
    phase: task.phase,
    durationDays: String(task.durationDays),
    startDate: task.startDate ?? "",
    endDate: task.endDate ?? "",
    trade: task.trade ?? "",
    assignee: task.assignee ?? "",
    status: task.status,
    percentComplete: String(task.percentComplete),
    isMilestone: task.isMilestone,
    parentId: task.parentId ?? "",
    predecessorIds: task.predecessorIds,
    notes: task.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parent = allTasks.find(t => t.id === form.parentId);
  const children = allTasks.filter(t => t.parentId === task.id);
  const predecessors = allTasks.filter(t => form.predecessorIds.includes(t.id));

  function togglePredecessor(id: string) {
    setForm(f => ({
      ...f,
      predecessorIds: f.predecessorIds.includes(id)
        ? f.predecessorIds.filter(p => p !== id)
        : [...f.predecessorIds, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const body = {
      name: form.name.trim(),
      phase: form.phase.trim() || "General",
      durationDays: dur,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      trade: form.trade.trim() || null,
      assignee: form.assignee.trim() || null,
      status: form.status,
      percentComplete: Math.min(100, Math.max(0, parseInt(form.percentComplete) || 0)),
      isMilestone: form.isMilestone,
      parentId: form.parentId || null,
      predecessorIds: form.predecessorIds,
      notes: form.notes.trim() || null,
    };
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const updated = await res.json();
      onSave({ ...task, ...updated });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
  }

  const otherTasks = allTasks.filter(t => t.id !== task.id);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Edit Task</h3>
          <div className="flex gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                <button onClick={handleDelete} className="text-xs px-2 py-1 rounded font-bold" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#2d1b1b", color: "#f87171" }}>Delete</button>
            )}
            <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} autoFocus />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} placeholder="General" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={INPUT} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} placeholder="e.g. Framing" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={INPUT} placeholder="e.g. Crew A" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...INPUT, cursor: "pointer" }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>% Complete</label>
              <input type="number" min="0" max="100" value={form.percentComplete} onChange={e => setForm(f => ({ ...f, percentComplete: e.target.value }))} style={INPUT} />
            </div>
          </div>

          {/* Parent task */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Parent Task</label>
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} style={{ ...INPUT, cursor: "pointer" }}>
              <option value="">— None —</option>
              {otherTasks.map(t => (
                <option key={t.id} value={t.id}>{t.phase} / {t.name}</option>
              ))}
            </select>
            {parent && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Parent: <strong style={{ color: GOLD }}>{parent.phase} / {parent.name}</strong>
              </div>
            )}
            {children.length > 0 && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Sub-tasks: {children.map(c => <strong key={c.id} style={{ color: "#94a3b8" }}> {c.name}</strong>)}
              </div>
            )}
          </div>

          {/* Predecessor dependencies */}
          {otherTasks.length > 0 && (
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Dependencies (predecessors)</label>
              <div className="flex flex-wrap gap-1.5">
                {otherTasks.map(t => {
                  const selected = form.predecessorIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => togglePredecessor(t.id)}
                      className="text-[10px] px-2 py-1 rounded font-medium"
                      style={{
                        background: selected ? "#C9A84C22" : "#1e2736",
                        border: `1px solid ${selected ? GOLD : "#30373f"}`,
                        color: selected ? GOLD : "#8b949e",
                      }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
              {predecessors.length > 0 && (
                <div className="mt-1 text-[10px]" style={{ color: "#8b949e" }}>
                  Waiting on: {predecessors.map(p => <strong key={p.id} style={{ color: "#94a3b8" }}> {p.name}</strong>)}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs" style={{ color: "#8b949e" }}>
              <input type="checkbox" checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} />
              Milestone
            </label>
          </div>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...INPUT, resize: "none" }} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} disabled={!form.name.trim() || saving}
            className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────────────────

function AddTaskModal({
  companyId,
  clientId,
  phases,
  onCreate,
  onClose,
}: {
  companyId: string;
  clientId: string;
  phases: string[];
  onCreate: (task: ClientTask) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: "", phase: phases[0] ?? "General", durationDays: "5", startDate: todayStr(), trade: "", assignee: "" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const start = form.startDate ? new Date(form.startDate + "T00:00:00") : new Date();
    const end = addDays(start, dur - 1);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phase: form.phase.trim() || "General",
          durationDays: dur,
          startDate: toDateStr(start),
          endDate: toDateStr(end),
          trade: form.trade.trim() || null,
          assignee: form.assignee.trim() || null,
        }),
      });
      const task = await res.json();
      onCreate(task);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-4" style={{ color: "#e6edf3" }}>Add Task</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} list="phase-list" />
              <datalist id="phase-list">{phases.map(p => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} placeholder="Optional" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleCreate} disabled={!form.name.trim() || saving}
            className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Adding…" : "Add Task"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Gantt Chart ────────────────────────────────────────────────────────────────

function ClientGanttChart({
  tasks,
  projectStart,
  companyId,
  clientId,
  canEdit,
  onTasksChange,
}: {
  tasks: ClientTask[];
  projectStart: Date;
  companyId: string;
  clientId: string;
  canEdit: boolean;
  onTasksChange: (tasks: ClientTask[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<ClientTask | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toggle = (phase: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(phase)) next.delete(phase); else next.add(phase);
    return next;
  });

  // Build phases map
  const phases = useMemo(() => {
    const map = new Map<string, ClientTask[]>();
    for (const t of tasks) {
      const arr = map.get(t.phase) ?? [];
      arr.push(t);
      map.set(t.phase, arr);
    }
    return map;
  }, [tasks]);

  const projectEnd = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
    if (!dates.length) return addDays(projectStart, 30);
    return dates.reduce((max, d) => (d > max ? d : max), dates[0]);
  }, [tasks, projectStart]);

  const totalDays = differenceInDays(projectEnd, projectStart) + 8;
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

  type Row = { kind: "phase"; phase: string; phaseTasks: ClientTask[] } | { kind: "task"; task: ClientTask; rowNum: number };
  const rows: Row[] = [];
  let rowNum = 0;
  for (const [phase, phaseTasks] of Array.from(phases.entries())) {
    rows.push({ kind: "phase", phase, phaseTasks });
    if (!collapsed.has(phase)) {
      for (const task of phaseTasks) { rows.push({ kind: "task", task, rowNum }); rowNum++; }
    }
  }

  let yOffset = HEADER_H;
  const rowYs: number[] = [];
  for (const row of rows) {
    rowYs.push(yOffset);
    yOffset += row.kind === "phase" ? PHASE_ROW_HEIGHT : ROW_HEIGHT;
  }
  const svgHeight = yOffset + 30;
  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;

  const getSvgX = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    return clientX - svgRef.current.getBoundingClientRect().left;
  }, []);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: ClientTask, type: "move" | "resize") => {
    if (!canEdit || task.isMilestone) return;
    e.preventDefault();
    e.stopPropagation();
    const start = parseDate(task.startDate) ?? today;
    const end = parseDate(task.endDate) ?? addDays(start, task.durationDays - 1);
    setDrag({ taskId: task.id, type, originalStart: start, originalEnd: end, mouseStartX: getSvgX(e.clientX), currentDeltaDays: 0 });
  }, [canEdit, getSvgX, today]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const deltaX = getSvgX(e.clientX) - drag.mouseStartX;
    const deltaDays = Math.round(deltaX / CELL_WIDTH);
    setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
  }, [drag, getSvgX]);

  const handleMouseUp = useCallback(async () => {
    if (!drag || drag.currentDeltaDays === 0) { setDrag(null); return; }
    const { taskId, type, originalStart, originalEnd, currentDeltaDays } = drag;
    setDrag(null);

    let newStart: Date, newEnd: Date;
    if (type === "move") {
      newStart = addDays(originalStart, currentDeltaDays);
      newEnd = addDays(originalEnd, currentDeltaDays);
    } else {
      // resize: only end changes, duration grows/shrinks
      newStart = originalStart;
      newEnd = addDays(originalEnd, currentDeltaDays);
      if (newEnd <= newStart) newEnd = addDays(newStart, 0); // min 1 day
    }
    const durationDays = Math.max(1, differenceInDays(newEnd, newStart) + 1);

    setSaving(taskId);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: toDateStr(newStart), endDate: toDateStr(newEnd), durationDays }),
      });
      const updated = await res.json();
      onTasksChange(tasks.map(t => t.id === taskId ? { ...t, ...updated } : t));
    } finally {
      setSaving(null);
    }
  }, [drag, companyId, clientId, tasks, onTasksChange]);

  function handleDoubleClick(task: ClientTask) {
    setEditTask(task);
  }

  return (
    <>
      <div className="overflow-x-auto select-none" style={{ cursor: drag ? "grabbing" : "default" }}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ display: "block" }}
        >
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0d1117" />

          {/* Month headers */}
          {months.map(m => (
            <g key={m.label}>
              <rect x={LABEL_WIDTH + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
              <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>{m.label}</text>
            </g>
          ))}

          {/* Weekend shading + grid lines */}
          {Array.from({ length: totalDays }).map((_, d) => {
            const date = addDays(projectStart, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return <rect key={d} x={LABEL_WIDTH + d * CELL_WIDTH} y={HEADER_H} width={CELL_WIDTH} height={svgHeight - HEADER_H - 30} fill={isWeekend ? "#0a0e14" : "transparent"} />;
          })}
          {Array.from({ length: totalDays }).map((_, d) => (
            <line key={`v${d}`} x1={LABEL_WIDTH + d * CELL_WIDTH} y1={HEADER_H} x2={LABEL_WIDTH + d * CELL_WIDTH} y2={svgHeight - 30} stroke="#30373f" strokeWidth={0.5} />
          ))}

          {/* Today line */}
          {today >= projectStart && today <= addDays(projectEnd, 8) && (() => {
            const x = LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH;
            return (
              <g>
                <line x1={x} y1={0} x2={x} y2={svgHeight - 30} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
                <text x={x + 3} y={13} fontSize={9} fill="#ef4444">TODAY</text>
              </g>
            );
          })()}

          {/* Rows */}
          {rows.map((row, i) => {
            const y = rowYs[i];
            if (row.kind === "phase") {
              const isCollapsed = collapsed.has(row.phase);
              const phaseDates = row.phaseTasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
              if (!phaseDates.length) return (
                <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                  <text x={24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                  <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks)</text>
                </g>
              );
              const phaseStart = phaseDates.reduce((min, d) => d < min ? d : min, phaseDates[0]);
              const phaseEnd = phaseDates.reduce((max, d) => d > max ? d : max, phaseDates[0]);
              const barX = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
              const barW = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
              const done = row.phaseTasks.filter(t => t.status === "DONE").length;
              const pct = Math.round((done / row.phaseTasks.length) * 100);
              return (
                <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                  <text x={24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                  <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks · {pct}%)</text>
                  <rect x={barX} y={y + 7} width={barW} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#30373f" />
                  {pct > 0 && <rect x={barX} y={y + 7} width={(barW * pct) / 100} height={PHASE_ROW_HEIGHT - 14} rx={3} fill={GOLD} opacity={0.5} />}
                </g>
              );
            }

            const { task } = row;
            const isSaving = saving === task.id;
            const isDragging = drag?.taskId === task.id;
            const deltaDays = isDragging ? drag!.currentDeltaDays : 0;

            const startDate = parseDate(task.startDate) ?? today;
            const endDate = parseDate(task.endDate) ?? addDays(startDate, task.durationDays - 1);
            const barColor = STATUS_COLORS[task.status] ?? GOLD;
            const isEven = row.rowNum % 2 === 0;

            let startDay = differenceInDays(startDate, projectStart);
            let endDay = differenceInDays(endDate, projectStart);
            if (drag?.type === "move" && isDragging) { startDay += deltaDays; endDay += deltaDays; }
            if (drag?.type === "resize" && isDragging) { endDay += deltaDays; }
            const barX = LABEL_WIDTH + startDay * CELL_WIDTH;
            const barW = Math.max((endDay - startDay + 1) * CELL_WIDTH, CELL_WIDTH);

            const isChild = !!task.parentId;

            return (
              <g key={task.id}>
                <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT} fill={isEven ? "#0d1117" : "#0a0e14"} />
                <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke="#30373f" strokeWidth={0.3} />

                {/* Label — indent children */}
                <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill={task.status === "DONE" ? "#484f58" : "#e6edf3"}>
                  {task.name.length > 26 ? task.name.slice(0, 26) + "…" : task.name}
                </text>
                {task.trade && (
                  <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT - 5} fontSize={9} fill="#484f58">{task.trade}</text>
                )}

                {/* Status dot */}
                <circle cx={isChild ? 20 : 8} cy={y + ROW_HEIGHT / 2} r={3} fill={barColor} />

                {/* Bar / Milestone */}
                {task.isMilestone ? (
                  <polygon
                    points={`${barX},${y + 6} ${barX + 10},${y + ROW_HEIGHT / 2} ${barX},${y + ROW_HEIGHT - 6} ${barX - 10},${y + ROW_HEIGHT / 2}`}
                    fill="#7c3aed" opacity={isSaving ? 0.4 : 1}
                  />
                ) : (
                  <g>
                    {/* Ghost bar during drag */}
                    {isDragging && drag?.type === "move" && (
                      <rect
                        x={LABEL_WIDTH + differenceInDays(startDate, projectStart) * CELL_WIDTH}
                        y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                        fill={barColor} opacity={0.15} stroke={barColor} strokeWidth={1} strokeDasharray="4,3"
                      />
                    )}
                    {/* Main bar */}
                    <rect
                      x={barX} y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                      fill={barColor} opacity={isSaving ? 0.3 : 0.75}
                      style={{ cursor: canEdit ? "grab" : "default" }}
                      onMouseDown={e => handleBarMouseDown(e, task, "move")}
                      onDoubleClick={() => handleDoubleClick(task)}
                    />
                    {/* Progress fill */}
                    {task.percentComplete > 0 && (
                      <rect x={barX} y={y + 9} width={(barW * task.percentComplete) / 100} height={ROW_HEIGHT - 18} rx={4} fill={barColor} opacity={0.95} />
                    )}
                    {/* Duration label */}
                    {barW > 32 && (
                      <text x={barX + 5} y={y + ROW_HEIGHT / 2 + 4} fontSize={9} fill="#fff" opacity={0.85} style={{ pointerEvents: "none" }}>
                        {task.durationDays}d
                      </text>
                    )}
                    {/* Resize handle (right edge) */}
                    {canEdit && (
                      <rect
                        x={barX + barW - RESIZE_HANDLE_W} y={y + 9} width={RESIZE_HANDLE_W} height={ROW_HEIGHT - 18} rx={4}
                        fill="#fff" opacity={0.15}
                        style={{ cursor: "ew-resize" }}
                        onMouseDown={e => handleBarMouseDown(e, task, "resize")}
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 16})`}>
            {[
              { color: GOLD, label: "Not Started" },
              { color: "#3b82f6", label: "In Progress" },
              { color: "#22c55e", label: "Done" },
              { color: "#f97316", label: "Blocked" },
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
          <p className="text-xs mt-1" style={{ color: "#484f58" }}>
            Drag bars to move · Drag right edge to resize · Double-click to edit
          </p>
        )}
      </div>

      {editTask && (
        <EditModal
          task={editTask}
          allTasks={tasks}
          companyId={companyId}
          clientId={clientId}
          onSave={updated => { onTasksChange(tasks.map(t => t.id === updated.id ? updated : t)); setEditTask(null); }}
          onDelete={id => { onTasksChange(tasks.filter(t => t.id !== id)); setEditTask(null); }}
          onClose={() => setEditTask(null)}
        />
      )}
    </>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export default function ClientScheduleTab({
  companyId,
  clientId,
  initialTasks,
  canEdit,
}: {
  companyId: string;
  clientId: string;
  initialTasks: ClientTask[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<ClientTask[]>(initialTasks);
  const [adding, setAdding] = useState(false);

  const phases = useMemo(() => Array.from(new Set(tasks.map(t => t.phase))), [tasks]);
  const projectStart = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate)]).filter(Boolean) as Date[];
    if (!dates.length) return new Date();
    const earliest = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    return addDays(earliest, -2);
  }, [tasks]);

  const done = tasks.filter(t => t.status === "DONE").length;
  const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter(t => t.status === "BLOCKED").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Schedule</h2>
          {tasks.length > 0 && (
            <div className="flex gap-4 mt-1">
              <span className="text-xs" style={{ color: "#8b949e" }}>Total: <strong style={{ color: "#e6edf3" }}>{tasks.length}</strong></span>
              <span className="text-xs" style={{ color: "#8b949e" }}>Done: <strong style={{ color: "#22c55e" }}>{done}</strong></span>
              {inProgress > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>In progress: <strong style={{ color: "#3b82f6" }}>{inProgress}</strong></span>}
              {blocked > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>Blocked: <strong style={{ color: "#f97316" }}>{blocked}</strong></span>}
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            + Add Task
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12" style={{ color: "#484f58" }}>
          <p className="text-sm">No tasks yet.</p>
          {canEdit && <p className="text-xs mt-1">Click <strong>+ Add Task</strong> to build the project schedule.</p>}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <ClientGanttChart
            tasks={tasks}
            projectStart={projectStart}
            companyId={companyId}
            clientId={clientId}
            canEdit={canEdit}
            onTasksChange={setTasks}
          />
        </div>
      )}

      {adding && (
        <AddTaskModal
          companyId={companyId}
          clientId={clientId}
          phases={phases.length ? phases : ["Pre-Construction", "Construction", "Finishing"]}
          onCreate={task => { setTasks(prev => [...prev, task]); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
