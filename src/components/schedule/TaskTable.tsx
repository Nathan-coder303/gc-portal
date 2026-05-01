"use client";

import { useState, useEffect, useRef } from "react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import {
  updateTaskStatus,
  createTasksForPhase,
  archiveTask,
  restoreTask,
} from "@/app/[companyId]/[projectId]/schedule/actions";
import { TaskStatus } from "@prisma/client";
import type { GanttTask } from "@/lib/schedule/gantt";
import TaskEditModal from "./TaskEditModal";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

const statusColors: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  BLOCKED: "bg-orange-100 text-orange-700",
  DONE: "bg-green-100 text-green-700",
};
const statusLabel: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

type EditingTask = {
  id: string; name: string; phase: string; durationDays: number;
  startDate: string | null; endDate: string | null; trade: string | null;
  assignee: string | null; notes: string | null; percentComplete: number;
};

type TaskRow = { name: string; durationDays: number; startDate: string; trade: string };

type UndoEntry =
  | { label: string; kind: "archive_task"; taskId: string; snapshot: GanttTask }
  | { label: string; kind: "archive_phase"; phase: string; taskIds: string[]; snapshots: GanttTask[] }
  | { label: string; kind: "create"; taskIds: string[]; snapshots: GanttTask[] };

type CtxMenu =
  | { kind: "phase"; phase: string; x: number; y: number }
  | { kind: "task"; taskId: string; taskName: string; phase: string; x: number; y: number };

// ─── Add Phase Modal ──────────────────────────────────────────────────────────
function AddPhaseModal({
  projectId,
  initialPhase = "",
  onCreated,
  onClose,
}: {
  projectId: string;
  initialPhase?: string;
  onCreated: (tasks: GanttTask[]) => void;
  onClose: () => void;
}) {
  const [phaseName, setPhaseName] = useState(initialPhase);
  const [rows, setRows] = useState<TaskRow[]>([{ name: "", durationDays: 1, startDate: "", trade: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addRow() {
    setRows(r => [...r, { name: "", durationDays: 1, startDate: "", trade: "" }]);
  }
  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof TaskRow, value: string | number) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function handleCreate() {
    if (!phaseName.trim()) { setError("Phase name is required."); return; }
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) { setError("Add at least one task."); return; }
    setSaving(true);
    try {
      const result = await createTasksForPhase(projectId, phaseName.trim(), validRows);
      if (result.success) {
        onCreated(result.tasks);
        onClose();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>
            {initialPhase ? `Add Tasks to "${initialPhase}"` : "Add Phase"}
          </h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>

        {!initialPhase && (
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Phase Name</label>
            <input
              autoFocus
              value={phaseName}
              onChange={e => setPhaseName(e.target.value)}
              placeholder="e.g. Foundation, Framing, Electrical…"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold px-1" style={{ color: "#8b949e" }}>
            <span className="col-span-5">Task Name</span>
            <span className="col-span-2">Duration (days)</span>
            <span className="col-span-3">Start Date</span>
            <span className="col-span-1">Trade</span>
            <span className="col-span-1"></span>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={row.name}
                onChange={e => updateRow(i, "name", e.target.value)}
                placeholder="Task name"
                className="col-span-5 rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              />
              <input
                type="number"
                min={1}
                value={row.durationDays}
                onChange={e => updateRow(i, "durationDays", parseInt(e.target.value) || 1)}
                className="col-span-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              />
              <input
                type="date"
                value={row.startDate}
                onChange={e => updateRow(i, "startDate", e.target.value)}
                className="col-span-3 rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              />
              <input
                value={row.trade}
                onChange={e => updateRow(i, "trade", e.target.value)}
                placeholder="Trade"
                className="col-span-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg disabled:opacity-30"
                style={{ color: "#f85149" }}
              >
                <TrashIcon size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633" }}
          >
            + Add Task
          </button>
        </div>

        {error && <p className="text-xs" style={{ color: "#f85149" }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            {saving ? "Saving…" : initialPhase ? "Add Tasks" : "Create Phase"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm"
            style={{ background: "#30373f", color: "#e6edf3" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TaskTable ───────────────────────────────────────────────────────────
export default function TaskTable({
  tasks: initialTasks,
  projectId,
  canEdit = false,
}: {
  tasks: GanttTask[];
  projectId: string;
  canEdit?: boolean;
}) {
  const [localTasks, setLocalTasks] = useState<GanttTask[]>(initialTasks);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [addPhaseModal, setAddPhaseModal] = useState<{ initialPhase?: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const in7 = addDays(today, 7);
  const in14 = addDays(today, 14);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    function handler(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  function push(entry: UndoEntry) {
    setUndoStack(s => [...s.slice(-19), entry]);
    setRedoStack([]);
  }

  async function handleStatusChange(taskId: string, status: string) {
    setUpdating(taskId);
    const pct = status === "DONE" ? 100 : status === "IN_PROGRESS" ? 50 : 0;
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, percentComplete: pct } : t));
    await updateTaskStatus(taskId, status as TaskStatus, pct);
    setUpdating(null);
  }

  async function handleDeleteTask(taskId: string) {
    const snapshot = localTasks.find(t => t.id === taskId);
    if (!snapshot) return;
    setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    push({ label: `"${snapshot.name}"`, kind: "archive_task", taskId, snapshot });
    await archiveTask(taskId);
    setCtxMenu(null);
  }

  async function handleDeletePhase(phase: string) {
    const snapshots = localTasks.filter(t => t.phase === phase);
    const taskIds = snapshots.map(t => t.id);
    setLocalTasks(prev => prev.filter(t => t.phase !== phase));
    push({ label: `Phase "${phase}"`, kind: "archive_phase", phase, taskIds, snapshots });
    await Promise.all(taskIds.map(id => archiveTask(id)));
    setCtxMenu(null);
  }

  async function handleUndo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, entry]);

    if (entry.kind === "archive_task") {
      setLocalTasks(prev => [...prev, entry.snapshot]);
      await restoreTask(entry.taskId);
    } else if (entry.kind === "archive_phase") {
      setLocalTasks(prev => [...prev, ...entry.snapshots]);
      await Promise.all(entry.taskIds.map(id => restoreTask(id)));
    } else if (entry.kind === "create") {
      setLocalTasks(prev => prev.filter(t => !entry.taskIds.includes(t.id)));
      await Promise.all(entry.taskIds.map(id => archiveTask(id)));
    }
  }

  async function handleRedo() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, entry]);

    if (entry.kind === "archive_task") {
      setLocalTasks(prev => prev.filter(t => t.id !== entry.taskId));
      await archiveTask(entry.taskId);
    } else if (entry.kind === "archive_phase") {
      setLocalTasks(prev => prev.filter(t => !entry.taskIds.includes(t.id)));
      await Promise.all(entry.taskIds.map(id => archiveTask(id)));
    } else if (entry.kind === "create") {
      setLocalTasks(prev => [...prev, ...entry.snapshots]);
      await Promise.all(entry.taskIds.map(id => restoreTask(id)));
    }
  }

  function handlePhaseCtx(e: React.MouseEvent, phase: string) {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ kind: "phase", phase, x: e.clientX, y: e.clientY });
  }

  function handleTaskCtx(e: React.MouseEvent, t: GanttTask) {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ kind: "task", taskId: t.id, taskName: t.name, phase: t.phase, x: e.clientX, y: e.clientY });
  }

  const toggle = (phase: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });

  const grouped = new Map<string, GanttTask[]>();
  for (const t of localTasks) {
    const arr = grouped.get(t.phase) ?? [];
    arr.push(t);
    grouped.set(t.phase, arr);
  }

  return (
    <div>
      {/* Header toolbar */}
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid #30373f" }}>
        <div>
          <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>Task List</span>
          <span className="text-xs ml-2" style={{ color: "#8b949e" }}>Right-click phase or task to delete</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={undoStack.length > 0 ? `Undo: ${undoStack[undoStack.length - 1].label}` : "Nothing to undo"}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 flex items-center gap-1"
              style={{ background: "#30373f", color: "#e6edf3" }}
            >
              ↩ Undo
            </button>
            {/* Redo */}
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title={redoStack.length > 0 ? `Redo: ${redoStack[redoStack.length - 1].label}` : "Nothing to redo"}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 flex items-center gap-1"
              style={{ background: "#30373f", color: "#e6edf3" }}
            >
              ↪ Redo
            </button>
            {/* Add Phase */}
            <button
              onClick={() => setAddPhaseModal({})}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            >
              + Add Phase
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingTask && <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} />}
      {addPhaseModal !== null && (
        <AddPhaseModal
          projectId={projectId}
          initialPhase={addPhaseModal.initialPhase}
          onCreated={newTasks => {
            setLocalTasks(prev => [...prev, ...newTasks]);
            push({ label: `Phase "${newTasks[0]?.phase ?? ""}"`, kind: "create", taskIds: newTasks.map(t => t.id), snapshots: newTasks });
          }}
          onClose={() => setAddPhaseModal(null)}
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 rounded-xl py-1 shadow-2xl"
          style={{ top: ctxMenu.y, left: ctxMenu.x, background: "#161b22", border: "1px solid #30373f", minWidth: "180px" }}
        >
          {ctxMenu.kind === "phase" ? (
            <>
              <button
                onClick={() => { setAddPhaseModal({ initialPhase: ctxMenu.phase }); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                style={{ color: "#3b82f6" }}
              >
                + Add Task to Phase
              </button>
              <div style={{ borderTop: "1px solid #30373f" }} />
              <button
                onClick={() => handleDeletePhase(ctxMenu.phase)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-red-950"
                style={{ color: "#f85149" }}
              >
                🗑 Delete Phase ({grouped.get(ctxMenu.phase)?.length ?? 0} tasks)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  const t = localTasks.find(t => t.id === ctxMenu.taskId);
                  if (!t) return;
                  setEditingTask({
                    id: t.id, name: t.name, phase: t.phase, durationDays: t.durationDays,
                    startDate: format(t.startDate, "yyyy-MM-dd"),
                    endDate: format(t.endDate, "yyyy-MM-dd"),
                    trade: t.trade, assignee: t.assignee, notes: null,
                    percentComplete: t.percentComplete,
                  });
                  setCtxMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                style={{ color: "#e6edf3" }}
              >
                ✎ Edit Task
              </button>
              <div style={{ borderTop: "1px solid #30373f" }} />
              <button
                onClick={() => handleDeleteTask(ctxMenu.taskId)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-red-950"
                style={{ color: "#f85149" }}
              >
                🗑 Delete "{ctxMenu.taskName}"
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {localTasks.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm" style={{ color: "#8b949e" }}>
          No tasks yet.{canEdit && " Click \"+ Add Phase\" to get started."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Task</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Start</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">End</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Dur</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Trade</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Assignee</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">%</th>
                {canEdit && <th className="px-4 py-2.5 w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([phase, phaseTasks]) => {
                const isCollapsed = collapsed.has(phase);
                const done = phaseTasks.filter(t => t.status === "DONE").length;
                const late = phaseTasks.filter(t => t.status !== "DONE" && isBefore(t.endDate, today)).length;

                return [
                  <tr
                    key={`phase-${phase}`}
                    className="bg-slate-100 border-b border-slate-200 cursor-pointer hover:bg-slate-200 select-none"
                    onClick={() => toggle(phase)}
                    onContextMenu={e => handlePhaseCtx(e, phase)}
                  >
                    <td colSpan={canEdit ? 9 : 8} className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs">{isCollapsed ? "▶" : "▼"}</span>
                        <span className="font-semibold text-slate-700">{phase}</span>
                        <span className="text-xs text-slate-400">{phaseTasks.length} tasks · {done}/{phaseTasks.length} done</span>
                        {late > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{late} late</span>
                        )}
                      </div>
                    </td>
                  </tr>,

                  ...(!isCollapsed
                    ? phaseTasks.map(t => {
                        const isLate = t.status !== "DONE" && isBefore(t.endDate, today);
                        const isDueIn7 = t.status !== "DONE" && !isLate && !isAfter(t.endDate, in7);
                        const isDueIn14 = t.status !== "DONE" && !isLate && !isDueIn7 && !isAfter(t.endDate, in14);

                        return (
                          <tr
                            key={t.id}
                            className={`border-b border-slate-50 hover:bg-slate-50 ${isLate ? "bg-red-50" : ""}`}
                            onContextMenu={e => handleTaskCtx(e, t)}
                          >
                            <td className="px-4 py-2 font-medium text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.isMilestone && <span className="inline-block w-2 h-2 bg-violet-500 rotate-45" />}
                                {t.name}
                                {isLate && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Late</span>}
                                {isDueIn7 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Due 7d</span>}
                                {isDueIn14 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Due 14d</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">{format(t.startDate, "MMM d")}</td>
                            <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">{t.isMilestone ? "—" : format(t.endDate, "MMM d")}</td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{t.isMilestone ? "★" : `${t.durationDays}d`}</td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{t.trade ?? "—"}</td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{t.assignee ?? "—"}</td>
                            <td className="px-4 py-2">
                              <select
                                value={t.status}
                                onChange={e => handleStatusChange(t.id, e.target.value)}
                                disabled={updating === t.id}
                                className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${statusColors[t.status]}`}
                              >
                                {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500 text-xs">{t.percentComplete}%</td>
                            {canEdit && (
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => setEditingTask({
                                    id: t.id, name: t.name, phase: t.phase, durationDays: t.durationDays,
                                    startDate: format(t.startDate, "yyyy-MM-dd"),
                                    endDate: format(t.endDate, "yyyy-MM-dd"),
                                    trade: t.trade, assignee: t.assignee, notes: null,
                                    percentComplete: t.percentComplete,
                                  })}
                                  className="w-7 h-7 rounded flex items-center justify-center"
                                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                                  title="Edit"
                                >
                                  <PencilIcon size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    : []),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
