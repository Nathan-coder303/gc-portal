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

  const inputClass =
    "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]";
  const labelClass = "block text-sm font-semibold text-slate-800 mb-1";
  const helperClass = "text-xs text-slate-400 mt-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Project Name */}
      <div>
        <label className={labelClass}>
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g., Downtown Office Building"
          className={inputClass}
        />
        <p className={helperClass}>Choose a descriptive name for your project</p>
      </div>

      {/* Address */}
      <div>
        <label className={labelClass}>Project Address</label>
        <input
          type="text"
          name="address"
          placeholder="e.g., 123 Main St, Hollywood, FL 33020"
          className={inputClass}
        />
        <p className={helperClass}>Optional: physical location of the project</p>
      </div>

      {/* Start Date + Budget side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={TODAY}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Budget ($) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="budget"
            required
            min="1"
            step="1000"
            placeholder="e.g. 500,000"
            className={inputClass}
          />
        </div>
      </div>

      {/* Status */}
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue="ACTIVE" className={inputClass}>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETE">Complete</option>
        </select>
      </div>

      {/* Info box */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Default settings
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Accounts created automatically: Cash, Partner Capital, Expenses, Owner Draws
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          These settings can be modified later in project settings
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push(`/${companyId}/projects`)}
          className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 text-white text-sm rounded-lg font-semibold disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "#C9A84C" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#b8963d")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#C9A84C")}
        >
          {loading ? "Creating..." : "Create project"}
        </button>
      </div>
    </form>
  );
}
