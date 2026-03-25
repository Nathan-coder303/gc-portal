"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncFyrdButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState("");

  async function sync() {
    setStatus("syncing");
    setResult("");
    try {
      const res = await fetch(`/api/${companyId}/sync-fyrd-leads`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data.message ?? `${data.added} added · ${data.skipped} skipped`);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sync}
        disabled={status === "syncing"}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
      >
        {status === "syncing" ? "Syncing FYRD…" : "Sync FYRD UP"}
      </button>
      {result && (
        <span
          className="text-[10px] max-w-[220px] truncate text-right"
          style={{ color: status === "error" ? "#f85149" : "#C9A84C" }}
          title={result}
        >
          {result}
        </span>
      )}
    </div>
  );
}
