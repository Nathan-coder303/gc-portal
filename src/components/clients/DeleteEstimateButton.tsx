"use client";

import { useState, useTransition } from "react";
import { deleteClientEstimate } from "@/app/[companyId]/clients/actions";

export default function DeleteEstimateButton({
  estimateId,
  clientId,
  companyId,
}: {
  estimateId: string;
  clientId: string;
  companyId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
        <button
          onClick={() => startTransition(async () => {
            await deleteClientEstimate(estimateId, clientId, companyId);
          })}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded disabled:opacity-50"
          style={{ background: "#f87171", color: "#fff" }}
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs px-2 py-1 rounded"
          style={{ color: "#8b949e", border: "1px solid #30373f" }}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs px-2 py-1 rounded"
      style={{ color: "#f87171", border: "1px solid #f8717144" }}
    >
      Delete
    </button>
  );
}
