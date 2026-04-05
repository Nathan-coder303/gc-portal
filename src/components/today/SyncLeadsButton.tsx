"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SyncLeadsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "backfilling" | "deduping" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");
  const [lastSynced, setLastSynced] = useState<string>("");

  async function fetchLastSynced() {
    try {
      const res = await fetch(`/api/${companyId}/leads-sync-status`);
      const data = await res.json();
      if (data.leadsLastSyncedAt) {
        setLastSynced(new Date(data.leadsLastSyncedAt).toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        }));
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchLastSynced();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function sync(backfill = false) {
    setStatus(backfill ? "backfilling" : "syncing");
    setResult("");
    let totalAdded = 0;
    let totalMerged = 0;
    try {
      do {
        const res = await fetch(`/api/${companyId}/fetch-leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backfill }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        totalAdded += data.added ?? 0;
        totalMerged += data.merged ?? 0;
        if (data.remaining > 0) {
          setResult(`Importing… +${totalAdded} so far, ${data.remaining} remaining`);
        }
        if (!backfill || (data.remaining ?? 0) === 0) break;
      } while (true);

      const parts: string[] = [];
      if (totalAdded > 0) parts.push(`+${totalAdded} new`);
      if (totalMerged > 0) parts.push(`${totalMerged} merged`);
      if (parts.length === 0) parts.push("up to date");
      setResult(parts.join(" · "));
      setStatus("done");
      await fetchLastSynced();
      router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  async function dedup() {
    setStatus("deduping");
    setResult("");
    try {
      const res = await fetch(`/api/${companyId}/dedup-leads`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const parts: string[] = [];
      if (data.merged > 0) parts.push(`${data.merged} groups merged`);
      if (data.deleted > 0) parts.push(`${data.deleted} duplicates removed`);
      if (parts.length === 0) parts.push("no duplicates found");
      setResult(parts.join(" · "));
      setStatus("done");
      router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  const isBusy = status === "syncing" || status === "backfilling" || status === "deduping";

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {(result || lastSynced) && (
        <span
          className="text-[10px] max-w-[200px] truncate"
          style={{ color: status === "error" ? "#f85149" : result ? "#C9A84C" : "#484f58" }}
          title={result || `Last synced: ${lastSynced}`}
        >
          {result || `Last synced: ${lastSynced}`}
        </span>
      )}
      <button
        onClick={() => sync(false)}
        disabled={isBusy}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#C9A84C", color: "#0d1117" }}
      >
        {status === "syncing" ? "Syncing…" : "Sync Leads"}
      </button>
      <button
        onClick={() => sync(true)}
        disabled={isBusy}
        title="Import all historical leads from Gmail"
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
      >
        {status === "backfilling" ? "Importing…" : "Backfill All"}
      </button>
      <button
        onClick={dedup}
        disabled={isBusy}
        title="Merge duplicate leads with same name"
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
      >
        {status === "deduping" ? "Merging…" : "Merge Dupes"}
      </button>
    </div>
  );
}
