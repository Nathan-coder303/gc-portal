"use client";

import { useState, useTransition } from "react";
import { loadBathroomTemplate } from "@/app/[companyId]/[projectId]/schedule/actions";

export default function LoadTemplateButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState("");

  function handleLoad() {
    if (!confirm("This will replace all existing tasks with the Bathroom Remodel template. Continue?")) return;
    startTransition(async () => {
      try {
        const res = await loadBathroomTemplate(projectId);
        setResult(`✓ Loaded ${res.count} tasks`);
      } catch (e) {
        setResult(`Error: ${String(e)}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs" style={{ color: result.startsWith("✓") ? "#22c55e" : "#f85149" }}>
          {result}
        </span>
      )}
      <button
        onClick={handleLoad}
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
        title="Load 15-task bathroom remodel template"
      >
        {pending ? "Loading…" : "🛁 Load Bathroom Template"}
      </button>
    </div>
  );
}
