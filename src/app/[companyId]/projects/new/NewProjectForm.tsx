"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "../actions";

const TODAY = new Date().toISOString().split("T")[0];

export default function NewProjectForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await createProject(new FormData(e.currentTarget));
      router.push(`/${result.companyId}/${result.projectId}/dashboard`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  }

  const field = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" required placeholder="e.g. Downtown Office Renovation"
            className={field} />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Project Address</label>
          <input type="text" name="address" placeholder="e.g. 123 Main St, City, State"
            className={field} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select name="status" defaultValue="ACTIVE" className={field}>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input type="date" name="startDate" required defaultValue={TODAY}
            className={field} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Budget ($) <span className="text-red-500">*</span>
          </label>
          <input type="number" name="budget" required min="1" step="1000"
            placeholder="e.g. 500000"
            className={field} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${companyId}/projects`)}
          className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Cash, Partner Capital, Project Expenses, and Owner Draws accounts will be created automatically.
      </p>
    </form>
  );
}
