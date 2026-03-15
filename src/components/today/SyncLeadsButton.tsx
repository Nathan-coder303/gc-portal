"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const LAST_SYNC_KEY = "leadsLastSynced";

export default function SyncLeadsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "backfilling" | "deduping" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");
  const [lastSynced, setLastSynced] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) setLastSynced(stored);
  }, []);

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
      const added = data.added ?? 0;
      const merged = data.merged ?? 0;
      const parts: string[] = [];
      if (added > 0) parts.push(`+${added} new`);
      if (merged > 0) parts.push(`${merged} merged`);
      if (parts.length === 0) parts.push("up to date");
      if (data.remaining > 0) parts.push(`${data.remaining} more — sync again`);
      setResult(parts.join(" · "));
      setStatus("done");
      const now = new Date().toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSynced(now);
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {result && (
          <span className="text-xs" style={{ color: status === "error" ? "#f85149" : "#C9A84C" }}>
            {result}
          </span>
        )}
        <button
          onClick={() => sync(false)}
          disabled={isBusy}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
          style={{ background: "#C9A84C", color: "#0d1117" }}
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
        <button
          onClick={dedup}
          disabled={isBusy}
          title="Merge duplicate leads with same name"
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
          style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
        >
          {status === "deduping" ? "Merging…" : "Merge Dupes"}
        </button>
      </div>
      {lastSynced && (
        <span className="text-[10px]" style={{ color: "#484f58" }}>
          Last synced: {lastSynced}
        </span>
      )}
    </div>
  );
}
