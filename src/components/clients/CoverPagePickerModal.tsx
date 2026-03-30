"use client";
import { useState } from "react";

export const COVER_OPTIONS = [
  { type: "RESIDENTIAL", label: "Residential", img: "/flat-roofs-cover.jpg", desc: "Default residential" },
  { type: "COMMERCIAL", label: "Commercial", img: "/additions.jpg", desc: "Default commercial" },
  { type: "FLAT_ROOFS", label: "Flat Roofs", img: "/flat-roofs-cover.jpg", desc: "Flat / low-slope roofing" },
  { type: "ADDITIONS", label: "Additions", img: "/additions.jpg", desc: "Home additions" },
  { type: "LAUNDRY", label: "Laundry", img: "/laundry-cover.png", desc: "Laundry room" },
  { type: "SHINGLE_ROOFS", label: "Shingle Roofs", img: "/shingle-roofs-cover.png", desc: "Shingle roofing" },
] as const;

export type CoverType = (typeof COVER_OPTIONS)[number]["type"] | "CUSTOM";
export type Page2Type = "ROOF" | "ADDITION" | "NONE";

const PAGE2_OPTIONS: { type: Page2Type; label: string; desc: string; icon: string }[] = [
  { type: "ROOF",     label: "Roof Presentation",        desc: "Roof upgrades & options pages", icon: "🏠" },
  { type: "ADDITION", label: "Construction Presentation", desc: "Addition / construction intro",  icon: "🏗️" },
  { type: "NONE",     label: "Skip",                     desc: "No presentation page",           icon: "⊘"  },
];

export type PdfOptions = {
  coverType: CoverType;
  page2: Page2Type;
  includeInsert: boolean;
};

export default function CoverPagePickerModal({
  isCommercial,
  customCoverUrl,
  hasInsertFile,
  initialPage2 = "NONE",
  confirmLabel = "Download PDF",
  showPreview = false,
  onConfirm,
  onPreview,
  onClose,
}: {
  isCommercial?: boolean;
  customCoverUrl?: string | null;
  hasInsertFile?: boolean;
  initialPage2?: Page2Type;
  confirmLabel?: string;
  showPreview?: boolean;
  onConfirm: (opts: PdfOptions) => void;
  onPreview?: (opts: PdfOptions) => void;
  onClose: () => void;
}) {
  const defaultCover: CoverType = isCommercial ? "COMMERCIAL" : "RESIDENTIAL";
  const [cover, setCover]               = useState<CoverType>(defaultCover);
  const [page2, setPage2]               = useState<Page2Type>(initialPage2);
  const [includeInsert, setIncludeInsert] = useState(true);

  const coverOptions: { type: CoverType; label: string; img: string; desc: string }[] = [
    ...COVER_OPTIONS,
    ...(customCoverUrl
      ? [{ type: "CUSTOM" as CoverType, label: "Custom", img: customCoverUrl, desc: "Uploaded for this client" }]
      : []),
  ];

  const opts: PdfOptions = { coverType: cover, page2, includeInsert };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]" style={{ background: "#161b22", border: "1px solid #30373f" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>PDF Options</h2>
          <button onClick={onClose} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
        </div>

        {/* ── Section 1: Cover Page ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 1 — Cover</p>
          <div className="grid grid-cols-3 gap-2">
            {coverOptions.map((opt) => {
              const active = cover === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => setCover(opt.type)}
                  className="rounded-xl overflow-hidden text-left transition-all"
                  style={{ border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, outline: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={opt.img} alt={opt.label} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
                  <div className="px-2 py-1.5" style={{ background: active ? "#1e2a12" : "#1e2736" }}>
                    <div className="text-xs font-semibold" style={{ color: active ? "#C9A84C" : "#e6edf3" }}>{opt.label}</div>
                    <div className="text-[10px]" style={{ color: "#8b949e" }}>{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Presentation Page ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 2 — Presentation</p>
          <div className="grid grid-cols-3 gap-2">
            {PAGE2_OPTIONS.map((opt) => {
              const active = page2 === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => setPage2(opt.type)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{ border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, background: active ? "#1e2a12" : "#1e2736", outline: "none" }}
                >
                  <div className="text-2xl mb-1">{opt.icon}</div>
                  <div className="text-xs font-semibold" style={{ color: active ? "#C9A84C" : "#e6edf3" }}>{opt.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: Insert File ── */}
        {hasInsertFile && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 3 — Client Drawing / Report</p>
            <label
              className="flex items-center gap-3 cursor-pointer rounded-xl px-4 py-3"
              style={{ border: `2px solid ${includeInsert ? "#C9A84C" : "#30373f"}`, background: includeInsert ? "#1e2a12" : "#1e2736" }}
            >
              <input
                type="checkbox"
                checked={includeInsert}
                onChange={e => setIncludeInsert(e.target.checked)}
                className="w-4 h-4 rounded accent-[#C9A84C]"
              />
              <div>
                <div className="text-sm font-semibold" style={{ color: includeInsert ? "#C9A84C" : "#e6edf3" }}>
                  Include client drawing / roof report
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                  Inserts the uploaded file — uncheck to skip and avoid a blank page
                </div>
              </div>
            </label>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          {showPreview && onPreview && (
            <button
              onClick={() => onPreview(opts)}
              className="px-4 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: "#1e2736", border: "1px solid #C9A84C55", color: "#C9A84C" }}
            >
              👁 Preview
            </button>
          )}
          <button
            onClick={() => onConfirm(opts)}
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
