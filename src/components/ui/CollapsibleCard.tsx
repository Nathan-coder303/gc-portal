"use client";

import { useState } from "react";

export default function CollapsibleCard({
  summary,
  children,
  defaultOpen = false,
  accent = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "#1e2736",
        border: `1px solid ${accent ? "#C9A84C55" : open ? "#C9A84C33" : "#30373f"}`,
      }}
    >
      {/* Header row — always visible, tap to toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: "transparent" }}
      >
        <div className="flex-1 min-w-0">{summary}</div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 ml-3 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "#C9A84C" }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: "1px solid #30373f" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
