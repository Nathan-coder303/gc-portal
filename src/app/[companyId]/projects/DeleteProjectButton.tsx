"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "./actions";
import { TrashIcon } from "@/components/ui/icons";

export default function DeleteProjectButton({
  projectId,
  projectName,
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
        className="w-7 h-7 rounded flex items-center justify-center transition-colors"
        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
        title="Delete project"
      >
        <TrashIcon size={13} />
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
            style={{ background: "#1e2736", border: "1px solid #30373f" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#2d1010" }}>
                <svg className="w-5 h-5" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: "#e6edf3" }}>Delete Project</h3>
                <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm mb-6" style={{ color: "#8b949e" }}>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold" style={{ color: "#e6edf3" }}>{projectName}</span>?
              All expenses, estimates, ledger entries, and schedule data will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ background: "#ef4444", color: "#fff", opacity: isPending ? 0.5 : 1 }}
              >
                {isPending ? "Deleting..." : "Yes, Delete Project"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-sm rounded-lg"
                style={{ border: "1px solid #30373f", color: "#8b949e" }}
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
