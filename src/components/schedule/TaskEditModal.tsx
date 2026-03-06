"use client";

import { useState } from "react";
import { updateTask } from "@/app/[companyId]/[projectId]/schedule/actions";

type TaskForEdit = {
  id: string;
  name: string;
  phase: string;
  durationDays: number;
  startDate: string | null;
  endDate: string | null;
  trade: string | null;
  assignee: string | null;
  notes: string | null;
  percentComplete: number;
};

export default function TaskEditModal({
  task,
  onClose,
}: {
  task: TaskForEdit;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await updateTask(fd);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-base">Edit Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={task.id} />

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Task Name</label>
            <input type="text" name="name" required defaultValue={task.name} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phase</label>
            <input type="text" name="phase" required defaultValue={task.phase} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duration (days)</label>
            <input type="number" name="durationDays" required min="0" defaultValue={task.durationDays} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
            <input type="date" name="startDate" defaultValue={task.startDate ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
            <input type="date" name="endDate" defaultValue={task.endDate ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Trade</label>
            <input type="text" name="trade" defaultValue={task.trade ?? ""} placeholder="e.g. Concrete" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assignee</label>
            <input type="text" name="assignee" defaultValue={task.assignee ?? ""} placeholder="e.g. Crew A" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">% Complete</label>
            <input type="number" name="percentComplete" min="0" max="100" defaultValue={task.percentComplete} className={field} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input type="text" name="notes" defaultValue={task.notes ?? ""} className={field} />
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-slate-100">
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
