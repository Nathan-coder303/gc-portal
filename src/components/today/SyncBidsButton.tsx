"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncBidsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState("");

  async function sync() {
    setStatus("syncing");
    setResult("");
    let totalAdded = 0;
    let round = 0;

    try {
      while (round < 10) {
        round++;
        const res = await fetch(`/api/${companyId}/sync-starred-bids`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        totalAdded += data.added ?? 0;
        if ((data.remaining ?? 0) === 0) break;
      }
      setResult(totalAdded > 0 ? `+${totalAdded} bids imported` : "No new bids found");
      setStatus("done");
      if (totalAdded > 0) router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs" style={{ color: status === "error" ? "#f85149" : "#22c55e" }}>
          {result}
        </span>
      )}
      <button
        onClick={sync}
        disabled={status === "syncing"}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
        style={{ background: "#0d2318", border: "1px solid #22c55e", color: "#22c55e" }}
        title="Pulls bids from PlanHub notifications + starred emails in Gmail"
      >
        {status === "syncing" ? "Syncing bids…" : "⭐ Sync All Bids"}
      </button>
    </div>
  );
}
