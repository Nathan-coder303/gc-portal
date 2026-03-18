"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncLabelBidsButton({
  companyId,
  clientId,
}: {
  companyId: string;
  clientId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState("");

  async function sync() {
    setStatus("syncing");
    setResult("Checking 7729 bids label…");
    let totalAdded = 0;
    let round = 0;

    try {
      while (round < 10) {
        round++;
        const res = await fetch(`/api/${companyId}/clients/${clientId}/sync-label-bids`, { method: "POST" });
        const text = await res.text();
        let data: { error?: string; detail?: string; added?: number; remaining?: number };
        try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 200)}`); }
        if (!res.ok) throw new Error([data.error, data.detail].filter(Boolean).join(": "));

        totalAdded += data.added ?? 0;
        const remaining = data.remaining ?? 0;
        setResult(`Round ${round}: ${totalAdded} bids saved · ${remaining} left…`);
        if (remaining === 0) break;
      }

      setResult(totalAdded > 0 ? `Done: +${totalAdded} bids imported` : "No new bids found in 7729 bids label");
      setStatus("done");
      if (totalAdded > 0) router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  const resultColor = status === "error" ? "#f85149" : status === "done" ? "#22c55e" : "#8b949e";

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs max-w-xs truncate" style={{ color: resultColor }} title={result}>
          {result}
        </span>
      )}
      <button
        onClick={sync}
        disabled={status === "syncing"}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
        style={{ background: "#0d1020", border: "1px solid #7c3aed", color: "#a78bfa" }}
        title="Import bids from Gmail label: 7729 bids"
      >
        {status === "syncing" ? "Syncing…" : "📥 Sync 7729 Bids"}
      </button>
    </div>
  );
}
