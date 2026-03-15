"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncLeadsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "backfilling" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function sync(backfill = false) {
    setStatus(backfill ? "backfilling" : "syncing");
    setResult("");
    try {
      const res = await fetch(`/api/${companyId}/fetch-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backfill }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(`+${data.added} leads${data.remaining > 0 ? ` (${data.remaining} more, sync again)` : ""}`);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  const isBusy = status === "syncing" || status === "backfilling";

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs" style={{ color: status === "error" ? "#f85149" : "#3fb950" }}>
          {result}
        </span>
      )}
      <button
        onClick={() => sync(false)}
        disabled={isBusy}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
        style={{ background: "#238636", color: "#fff" }}
      >
        {status === "syncing" ? "Syncing…" : "Sync Leads"}
      </button>
      <button
        onClick={() => sync(true)}
        disabled={isBusy}
        title="Import all historical leads from Gmail"
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
      >
        {status === "backfilling" ? "Importing…" : "Backfill All"}
      </button>
    </div>
  );
}
