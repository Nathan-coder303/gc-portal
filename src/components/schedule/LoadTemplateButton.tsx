"use client";

import { useState, useTransition } from "react";
import { loadScheduleTemplate } from "@/app/[companyId]/[projectId]/schedule/actions";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule/templates";

export default function LoadTemplateButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState("");
  const [selected, setSelected] = useState("");

  function handleLoad() {
    if (!selected) return;
    const label = SCHEDULE_TEMPLATES.find(t => t.key === selected)?.label ?? selected;
    if (!confirm(`This will replace all existing tasks with the "${label}" template. Continue?`)) return;
    startTransition(async () => {
      try {
        const res = await loadScheduleTemplate(projectId, selected);
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
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={pending}
        className="text-xs rounded-lg px-2 py-1.5 disabled:opacity-50"
        style={{ background: "#161b22", border: "1px solid #30373f", color: selected ? "#e6edf3" : "#484f58" }}
      >
        <option value="">Load template…</option>
        {SCHEDULE_TEMPLATES.map(t => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>
      <button
        onClick={handleLoad}
        disabled={pending || !selected}
        className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 whitespace-nowrap"
        style={{ background: "#161b22", border: "1px solid #30373f", color: "#8b949e" }}
      >
        {pending ? "Loading…" : "Load"}
      </button>
    </div>
  );
}
