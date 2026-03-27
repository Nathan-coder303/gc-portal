"use client";
import { useState } from "react";

export const COVER_OPTIONS = [
  { type: "RESIDENTIAL", label: "Residential", img: "/flat-roofs-cover.jpg", desc: "Default residential" },
  { type: "COMMERCIAL", label: "Commercial", img: "/additions.jpg", desc: "Default commercial" },
  { type: "FLAT_ROOFS", label: "Flat Roofs", img: "/flat-roofs-cover.jpg", desc: "Flat / low-slope roofing" },
  { type: "ADDITIONS", label: "Additions", img: "/additions.jpg", desc: "Home additions" },
  { type: "LAUNDRY", label: "Kitchen / Laundry", img: "/laundry-cover.jpg", desc: "Interior remodels" },
] as const;

export type CoverType = (typeof COVER_OPTIONS)[number]["type"] | "CUSTOM";

export default function CoverPagePickerModal({
  isCommercial,
  customCoverUrl,
  confirmLabel = "Generate PDF",
  onConfirm,
  onClose,
}: {
  isCommercial?: boolean;
  customCoverUrl?: string | null;
  confirmLabel?: string;
  onConfirm: (coverType: CoverType) => void;
  onClose: () => void;
}) {
  const defaultType: CoverType = isCommercial ? "COMMERCIAL" : "RESIDENTIAL";
  const [selected, setSelected] = useState<CoverType>(defaultType);

  const options: { type: CoverType; label: string; img: string; desc: string }[] = [
    ...COVER_OPTIONS,
    ...(customCoverUrl
      ? [{ type: "CUSTOM" as CoverType, label: "Custom", img: customCoverUrl, desc: "Uploaded for this client" }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-xl rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Choose Cover Page</h2>
          <button onClick={onClose} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {options.map((opt) => {
            const active = selected === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => setSelected(opt.type)}
                className="rounded-xl overflow-hidden text-left transition-all"
                style={{ border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, outline: "none" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opt.img} alt={opt.label} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                <div className="px-2 py-2" style={{ background: active ? "#1e2a12" : "#1e2736" }}>
                  <div className="text-xs font-semibold" style={{ color: active ? "#C9A84C" : "#e6edf3" }}>{opt.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="px-5 rounded-xl py-2.5 text-sm font-medium"
            style={{ background: "#30373f", color: "#e6edf3" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
