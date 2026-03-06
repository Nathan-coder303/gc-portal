"use client";

import { useState } from "react";
import { updateProject } from "@/app/[companyId]/[projectId]/settings/actions";

type Project = {
  id: string;
  name: string;
  code: string;
  startDate: string; // "YYYY-MM-DD"
  budget: number;
  status: string;
};

export default function ProjectEditor({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    try {
      await updateProject(fd);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Project Info</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Edit
          </button>
        )}
        {success && <span className="text-xs text-green-600 font-medium">Saved!</span>}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project Name</label>
            <input type="text" name="name" required defaultValue={project.name} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
            <input type="text" name="code" required defaultValue={project.code} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
            <input type="date" name="startDate" required defaultValue={project.startDate} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Budget ($)</label>
            <input type="number" name="budget" required min="0" step="0.01"
              defaultValue={project.budget.toFixed(2)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select name="status" defaultValue={project.status} className={field}>
              {["ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3 pt-1 border-t border-slate-100">
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setError(""); }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Project Name</dt>
            <dd className="font-medium text-slate-800">{project.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Code</dt>
            <dd className="font-medium text-slate-800">{project.code}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Start Date</dt>
            <dd className="font-medium text-slate-800">{project.startDate}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Budget</dt>
            <dd className="font-medium text-slate-800">
              ${project.budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium text-slate-800">{project.status}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
