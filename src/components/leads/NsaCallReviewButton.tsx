"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NsaCallReviewButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState("");

  async function run() {
    setStatus("running");
    setResult("");
    try {
      const res = await fetch(`/api/${companyId}/nsa-call-review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(`${data.created} moved to To Call ASAP · ${data.reviewed} reviewed`);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span
          className="text-[10px] max-w-[180px] truncate"
          style={{ color: status === "error" ? "#f85149" : "#C9A84C" }}
          title={result}
        >
          {result}
        </span>
      )}
      <button
        onClick={run}
        disabled={status === "running"}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#ef444422", border: "1px solid #ef444455", color: "#ef4444" }}
      >
        {status === "running" ? "Reviewing NSA…" : "📞 Review NSA Calls"}
      </button>
    </div>
  );
}
