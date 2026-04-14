"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export const COVER_OPTIONS = [
  { type: "FLAT_ROOFS",    label: "Flat Roofs",    img: "/flat-roofs-cover.jpg",      desc: "Flat / low-slope roofing" },
  { type: "ADDITIONS",     label: "Additions",     img: "/additions.jpg",             desc: "Home additions" },
  { type: "LAUNDRY",       label: "Laundry",       img: "/laundry-cover.png",         desc: "Laundry room" },
  { type: "SHINGLE_ROOFS", label: "Shingle Roofs", img: "/shingle-roofs-cover.png",   desc: "Shingle roofing" },
] as const;

export type CoverType = (typeof COVER_OPTIONS)[number]["type"] | "CUSTOM";
export type Page2Type = "ROOF" | "ADDITION" | "RETAIL" | "NONE";

const PAGE2_OPTIONS: { type: Page2Type; label: string; desc: string; icon: string }[] = [
  { type: "ROOF",     label: "Roof Presentation",        desc: "Roof upgrades & options pages", icon: "🏠" },
  { type: "ADDITION", label: "Construction Presentation", desc: "Addition / construction intro",  icon: "🏗️" },
  { type: "RETAIL",   label: "Retail Presentation",       desc: "Retail buildout intro & scope",  icon: "🏪" },
];

export type PdfOptions = {
  coverType: CoverType;
  coverBlobUrl?: string | null; // blob URL of selected custom cover
  page2: Page2Type;
  includeInsert: boolean;
  includeDivisionSummary: boolean;
};

type CustomCover = { blobUrl: string; proxyUrl: string };

export default function CoverPagePickerModal({
  isCommercial,
  initialCoverType,
  customCoverUrl,
  customCoverLabel,
  hasInsertFile,
  initialPage2 = "NONE",
  confirmLabel = "Download PDF",
  showPreview = false,
  companyId,
  clientId,
  onConfirm,
  onPreview,
  onSendEmail,
  onClose,
}: {
  isCommercial?: boolean;
  initialCoverType?: CoverType | null;
  customCoverUrl?: string | null;
  customCoverLabel?: string | null;
  hasInsertFile?: boolean;
  initialPage2?: Page2Type;
  confirmLabel?: string;
  showPreview?: boolean;
  companyId?: string;
  clientId?: string;
  onConfirm: (opts: PdfOptions) => void;
  onPreview?: (opts: PdfOptions) => void;
  onSendEmail?: (opts: PdfOptions) => void;
  onClose: () => void;
}) {
  const defaultCover: CoverType = initialCoverType ?? (isCommercial ? "ADDITIONS" : "FLAT_ROOFS");
  const [cover, setCover]               = useState<CoverType>(defaultCover);
  const [page2, setPage2]               = useState<Page2Type>(initialPage2 === "NONE" ? "ROOF" : initialPage2);
  const [includeInsert, setIncludeInsert] = useState(true);
  const [includeDivisionSummary, setIncludeDivisionSummary] = useState(false);

  // Custom cover gallery
  const [customCovers, setCustomCovers] = useState<CustomCover[]>([]);
  const [selectedBlobUrl, setSelectedBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing custom covers
  useEffect(() => {
    if (!companyId || !clientId) return;
    fetch(`/api/${companyId}/clients/${clientId}/covers`)
      .then(r => r.json())
      .then(data => {
        const covers: CustomCover[] = data.covers ?? [];
        setCustomCovers(covers);
        // Auto-select the one matching customCoverUrl (current active cover)
        if (customCoverUrl && covers.length > 0) {
          // customCoverUrl is a proxy URL like /api/.../cover, find matching by matching the proxy pattern
          // Just select the first cover that corresponds to the active one (newest = first)
          setSelectedBlobUrl(covers[0].blobUrl);
        }
      })
      .catch(() => {});
  }, [companyId, clientId, customCoverUrl]);

  const uploadFile = useCallback(async (file: File) => {
    if (!companyId || !clientId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/cover`, { method: "POST", body: fd });
      if (!res.ok) return;
      // Refresh the list
      const listRes = await fetch(`/api/${companyId}/clients/${clientId}/covers`);
      const data = await listRes.json();
      const covers: CustomCover[] = data.covers ?? [];
      setCustomCovers(covers);
      // Auto-select the newly uploaded cover (it'll be newest = first)
      if (covers[0]) setSelectedBlobUrl(covers[0].blobUrl);
      setCover("CUSTOM");
    } finally {
      setUploading(false);
    }
  }, [companyId, clientId]);

  const opts: PdfOptions = {
    coverType: cover,
    coverBlobUrl: cover === "CUSTOM" ? selectedBlobUrl : null,
    page2,
    includeInsert,
    includeDivisionSummary,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>PDF Options</h2>
          <button onClick={onClose} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
        </div>

        {/* ── Section 1: Cover Page ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 1 — Cover</p>
          <div className="grid grid-cols-3 gap-2">
            {/* Preset covers */}
            {COVER_OPTIONS.map((opt) => {
              const active = cover === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => { setCover(opt.type); setSelectedBlobUrl(null); }}
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

            {/* Custom covers gallery */}
            {customCovers.map((c) => {
              const active = cover === "CUSTOM" && selectedBlobUrl === c.blobUrl;
              return (
                <button
                  key={c.blobUrl}
                  onClick={() => { setCover("CUSTOM"); setSelectedBlobUrl(c.blobUrl); }}
                  className="rounded-xl overflow-hidden text-left transition-all"
                  style={{ border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, outline: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.proxyUrl} alt="Custom" style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
                  <div className="px-2 py-1.5" style={{ background: active ? "#1e2a12" : "#1e2736" }}>
                    <div className="text-xs font-semibold" style={{ color: active ? "#C9A84C" : "#e6edf3" }}>Custom</div>
                    <div className="text-[10px]" style={{ color: "#8b949e" }}>Uploaded</div>
                  </div>
                </button>
              );
            })}

            {/* Upload tile */}
            {companyId && clientId && (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) uploadFile(file);
                }}
                className="rounded-xl overflow-hidden text-left transition-all"
                style={{ border: `2px dashed ${dragOver ? "#C9A84C" : "#30373f"}`, outline: "none", minHeight: 108 }}
              >
                <div style={{ width: "100%", height: 72, background: dragOver ? "#1e2a12" : "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {uploading
                    ? <span style={{ color: "#8b949e", fontSize: 12 }}>Uploading…</span>
                    : <span style={{ color: dragOver ? "#C9A84C" : "#484f58", fontSize: 22 }}>📁</span>
                  }
                </div>
                <div className="px-2 py-1.5" style={{ background: "#1e2736" }}>
                  <div className="text-xs font-semibold" style={{ color: "#e6edf3" }}>Upload</div>
                  <div className="text-[10px]" style={{ color: "#8b949e" }}>Drag or click</div>
                </div>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
          />
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
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Include page 2 from report?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIncludeInsert(true)}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `2px solid ${includeInsert ? "#C9A84C" : "#30373f"}`, background: includeInsert ? "#1e2a12" : "#1e2736", outline: "none" }}
              >
                <div className="text-2xl mb-1">✅</div>
                <div className="text-xs font-semibold" style={{ color: includeInsert ? "#C9A84C" : "#e6edf3" }}>Yes</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>Include the uploaded report page</div>
              </button>
              <button
                onClick={() => setIncludeInsert(false)}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `2px solid ${!includeInsert ? "#C9A84C" : "#30373f"}`, background: !includeInsert ? "#1e2a12" : "#1e2736", outline: "none" }}
              >
                <div className="text-2xl mb-1">⊘</div>
                <div className="text-xs font-semibold" style={{ color: !includeInsert ? "#C9A84C" : "#e6edf3" }}>No</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>Skip — avoid blank page</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Section: Division Summary Page ── */}
        {page2 !== "ROOF" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Division Summary Page</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIncludeDivisionSummary(true)}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `2px solid ${includeDivisionSummary ? "#C9A84C" : "#30373f"}`, background: includeDivisionSummary ? "#1e2a12" : "#1e2736", outline: "none" }}
              >
                <div className="text-2xl mb-1">📋</div>
                <div className="text-xs font-semibold" style={{ color: includeDivisionSummary ? "#C9A84C" : "#e6edf3" }}>Include</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>All divisions + totals on one page</div>
              </button>
              <button
                onClick={() => setIncludeDivisionSummary(false)}
                className="rounded-xl p-3 text-left transition-all"
                style={{ border: `2px solid ${!includeDivisionSummary ? "#C9A84C" : "#30373f"}`, background: !includeDivisionSummary ? "#1e2a12" : "#1e2736", outline: "none" }}
              >
                <div className="text-2xl mb-1">⊘</div>
                <div className="text-xs font-semibold" style={{ color: !includeDivisionSummary ? "#C9A84C" : "#e6edf3" }}>Skip</div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>Go straight to detailed line items</div>
              </button>
            </div>
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
          {onSendEmail && (
            <button
              onClick={() => onSendEmail(opts)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: "#1a2436", border: "1px solid #C9A84C", color: "#C9A84C" }}
            >
              ✉ Send via Email
            </button>
          )}
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
