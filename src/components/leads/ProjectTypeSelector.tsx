"use client";
import { useState } from "react";

export const PRESET_PROJECT_TYPES = [
  "Roof Replacement",
  "Flat Roof",
  "Shingle Roof",
  "Bathroom Remodeling",
  "Kitchen Remodeling",
  "Custom Home",
  "Additions",
  "HVAC",
];

export function ProjectTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const all = [...PRESET_PROJECT_TYPES, ...customTypes];

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "__add__") { setAddingCustom(true); return; }
    onChange(v);
  }

  function handleAddCustom() {
    const v = customInput.trim();
    if (!v) return;
    setCustomTypes((prev) => [...prev, v]);
    onChange(v);
    setAddingCustom(false);
    setCustomInput("");
  }

  return (
    <div>
      {addingCustom ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            autoFocus
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); if (e.key === "Escape") setAddingCustom(false); }}
            placeholder="Project type..."
            style={{ flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #484f58", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
          />
          <button onClick={handleAddCustom} style={{ background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✓</button>
          <button onClick={() => setAddingCustom(false)} style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 6, padding: "7px 8px", fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <select
          value={value}
          onChange={handleSelect}
          style={{ width: "100%", background: "#0d1117", color: value ? "#e6edf3" : "#484f58", border: "1px solid #30373f", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
        >
          <option value="">Select project type…</option>
          {all.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="__add__" style={{ color: "#C9A84C" }}>+ Add type…</option>
        </select>
      )}
    </div>
  );
}
