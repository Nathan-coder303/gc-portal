"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "./actions";

export default function DeleteProjectButton({
  projectId,
  projectName,
  companyId,
}: {
  projectId: string;
  projectName: string;
  companyId: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      await deleteProject(projectId);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
      >
        Delete
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Project</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-slate-900">{projectName}</span>?
              All expenses, estimates, ledger entries, and schedule data will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Yes, Delete Project"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
