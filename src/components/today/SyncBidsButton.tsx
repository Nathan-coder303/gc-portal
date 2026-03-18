"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncBidsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState("");

  async function sync() {
    setStatus("syncing");
    setResult("Starting…");
    let totalAdded = 0;
    let totalNotBid = 0;
    let totalNoClient = 0;
    let round = 0;

    try {
      while (round < 15) {
        round++;
        const res = await fetch(`/api/${companyId}/sync-starred-bids`, { method: "POST" });
        const text = await res.text();
        let data: { error?: string; added?: number; notBid?: number; noClient?: number; remaining?: number };
        try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 200)}`); }
        if (!res.ok) throw new Error([data.error, (data as Record<string,unknown>).detail].filter(Boolean).join(": "));

        totalAdded += data.added ?? 0;
        totalNotBid += data.notBid ?? 0;
        totalNoClient += data.noClient ?? 0;

        const remaining = data.remaining ?? 0;
        setResult(
          `Round ${round}: ${totalAdded} bids saved · ${totalNoClient} unmatched · ${totalNotBid} not bids · ${remaining} left…`
        );

        // Stop if nothing left or no progress being made
        if (remaining === 0) break;
        // If we processed a batch but added nothing AND matched nothing, we're stuck — stop
        if ((data.added ?? 0) === 0 && (data.noClient ?? 0) === 0 && (data.notBid ?? 0) > 0) break;
      }

      if (totalAdded > 0) {
        setResult(`Done: +${totalAdded} bids imported · ${totalNoClient} could not match client · ${totalNotBid} not bids`);
        router.refresh();
      } else {
        setResult(
          totalNoClient > 0
            ? `0 bids saved — ${totalNoClient} emails found but couldn't match to a client. ${totalNotBid} were not bids.`
            : `No new bids found (${totalNotBid} emails were not bids)`
        );
      }
      setStatus("done");
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span
          className="text-xs max-w-xs truncate"
          style={{ color: status === "error" ? "#f85149" : status === "done" && result.startsWith("0") ? "#f0a500" : "#22c55e" }}
          title={result}
        >
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
        {status === "syncing" ? "Syncing…" : "⭐ Sync All Bids"}
      </button>
    </div>
  );
}
