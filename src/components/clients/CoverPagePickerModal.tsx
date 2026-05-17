"use client";
import { useState, useEffect, useCallback } from "react";

export const COVER_OPTIONS = [
  { type: "FLAT_ROOFS",    label: "Flat Roofs",    img: "/flat-roofs-cover.jpg",      desc: "Flat / low-slope roofing" },
  { type: "ADDITIONS",     label: "Additions",     img: "/additions.jpg",             desc: "Home additions" },
  { type: "LAUNDRY",       label: "Laundry",       img: "/laundry-cover.png",         desc: "Laundry room" },
  { type: "SHINGLE_ROOFS", label: "Shingle Roofs", img: "/shingle-roofs-cover.png",   desc: "Shingle roofing" },
] as const;

export type CoverType = (typeof COVER_OPTIONS)[number]["type"] | "CUSTOM" | "NONE";
export type Page2Type = "ROOF" | "ADDITION" | "PERMIT" | "RETAIL" | "NONE";

const PAGE2_OPTIONS: { type: Page2Type; label: string; desc: string; icon: string }[] = [
  { type: "ADDITION", label: "Construction Page",              desc: "Pages 1 & 2 — WHY CHOOSE US + scope",        icon: "🏗️" },
  { type: "PERMIT",   label: "Preparation of Permit Drawings", desc: "Pages 1 & 2 — WHY CHOOSE US + permit scope", icon: "📐" },
  { type: "ROOF",     label: "Roofing Cover Page",             desc: "Pages 1 & 2 — cover + roofing intro",        icon: "🏠" },
  { type: "RETAIL",   label: "Retail",                         desc: "Retail buildout & scope",                    icon: "🏪" },
  { type: "NONE",     label: "None",                           desc: "Skip presentation",                          icon: "⊘" },
];

export type PdfOptions = {
  coverType: CoverType;
  coverBlobUrl?: string | null;
  page2: Page2Type;
  includeInsert: boolean;
  includeDivisionSummary: boolean;
  forcedBreakCsiPrefixes: string[];
  forcedBreakTerms: boolean;
  noPresentation: boolean;
  scopeOfWorkId?: string | null;
  scopeTitle?: string | null;
};

type CustomCover = { blobUrl: string; proxyUrl: string; filename: string };

function formatCoverName(filename: string): string {
  return (filename
    .replace(/^\d{10,}-/, "") // strip timestamp prefix
    .replace(/\.[^.]+$/, "")  // strip extension
    .replace(/[-_]/g, " ")    // dashes → spaces
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())) || "Photo";
}

function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Compression failed")), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export default function CoverPagePickerModal({
  isCommercial,
  initialCoverType,
  customCoverUrl,
  hasInsertFile,
  initialPage2 = "NONE",
  confirmLabel = "Download PDF",
  showPreview = false,
  companyId,
  clientId,
  onConfirm,
  previewUrlBuilder,
  onSendEmail,
  onClose,
}: {
  isCommercial?: boolean;
  initialCoverType?: CoverType | null;
  customCoverUrl?: string | null;
  hasInsertFile?: boolean;
  initialPage2?: Page2Type;
  confirmLabel?: string;
  showPreview?: boolean;
  companyId?: string;
  clientId?: string;
  onConfirm: (opts: PdfOptions) => void;
  previewUrlBuilder?: (opts: PdfOptions) => string;
  onSendEmail?: (opts: PdfOptions) => void;
  onClose: () => void;
}) {
  // Read saved opts synchronously so cover/page2 are correct from the very first render.
  // This prevents the race where the save effect fires before the async load resolves,
  // causing the client-specific initialCoverType to overwrite the company-wide saved value.
  const [cover, setCover] = useState<CoverType>(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.coverType) return saved.coverType as CoverType;
      } catch {}
    }
    return initialCoverType ?? (isCommercial ? "ADDITIONS" : "FLAT_ROOFS");
  });
  const [page2, setPage2] = useState<Page2Type>(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.page2) return saved.page2 as Page2Type;
      } catch {}
    }
    return initialPage2 === "NONE" ? "ROOF" : initialPage2;
  });
  const [includeInsert, setIncludeInsert] = useState(true);
  const [includeDivisionSummary, setIncludeDivisionSummary] = useState(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.includeDivisionSummary != null) return saved.includeDivisionSummary as boolean;
      } catch {}
    }
    return false;
  });
  const [forcedBreakCsiPrefixes, setForcedBreakCsiPrefixes] = useState<string[]>(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (Array.isArray(saved?.forcedBreakCsiPrefixes)) return saved.forcedBreakCsiPrefixes as string[];
      } catch {}
    }
    return [];
  });
  const [forcedBreakTerms, setForcedBreakTerms] = useState(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.forcedBreakTerms != null) return saved.forcedBreakTerms as boolean;
      } catch {}
    }
    return false;
  });
  const [scopeTitle, setScopeTitle] = useState<string>(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.scopeTitle) return saved.scopeTitle as string;
      } catch {}
    }
    return "";
  });

  // Custom cover gallery
  const [customCovers, setCustomCovers] = useState<CustomCover[]>([]);
  const [selectedBlobUrl, setSelectedBlobUrl] = useState<string | null>(() => {
    if (companyId) {
      try {
        const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${clientId ?? companyId}`) ?? "null");
        if (saved?.selectedBlobUrl) return saved.selectedBlobUrl as string;
      } catch {}
    }
    return null;
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Editable cover names (DB-backed)
  const [coverNames, setCoverNames] = useState<Record<string, string>>({});
  const [editingCoverUrl, setEditingCoverUrl] = useState<string | null>(null);
  const [editingCoverName, setEditingCoverName] = useState("");

  // Save PDF options to localStorage whenever they change
  useEffect(() => {
    if (!companyId) return;
    try {
      localStorage.setItem(`gc-pdf-opts-${clientId ?? companyId}`, JSON.stringify({ coverType: cover, page2, selectedBlobUrl, includeDivisionSummary, forcedBreakCsiPrefixes, forcedBreakTerms, scopeTitle }));
    } catch {}
  }, [cover, page2, selectedBlobUrl, includeDivisionSummary, forcedBreakCsiPrefixes, forcedBreakTerms, scopeTitle, companyId, clientId]);

  function getCoverName(c: CustomCover): string {
    return coverNames[c.blobUrl] ?? formatCoverName(c.filename);
  }

  function saveCoverName(blobUrl: string, name: string) {
    const trimmed = name.trim() || formatCoverName(customCovers.find(c => c.blobUrl === blobUrl)?.filename ?? "");
    setCoverNames(prev => ({ ...prev, [blobUrl]: trimmed }));
    if (companyId) {
      fetch(`/api/${companyId}/covers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl, name: trimmed }),
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/${companyId}/covers`)
      .then(r => r.json())
      .then(data => {
        const covers: CustomCover[] = data.covers ?? [];
        setCustomCovers(covers);
        if (data.coverNames) setCoverNames(data.coverNames);
        // Only auto-select first cover if no saved selection exists
        setSelectedBlobUrl(prev => {
          if (prev) return prev;
          if (customCoverUrl && covers.length > 0) return covers[0].blobUrl;
          return null;
        });
      }).catch(() => {});
  }, [companyId, customCoverUrl]);

  const uploadFile = useCallback(async (file: File) => {
    if (!companyId || !clientId) return;
    setUploading(true); setUploadError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
      const res = await fetch(`/api/${companyId}/clients/${clientId}/cover`, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUploadError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const listRes = await fetch(`/api/${companyId}/covers`);
      const data = await listRes.json();
      const covers: CustomCover[] = data.covers ?? [];
      setCustomCovers(covers);
      if (covers[0]) setSelectedBlobUrl(covers[0].blobUrl);
      setCover("CUSTOM");
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  }, [companyId, clientId]);

  const noPresentation = page2 === "NONE";

  const opts: PdfOptions = {
    coverType: cover,
    coverBlobUrl: cover === "CUSTOM" ? selectedBlobUrl : null,
    page2,
    includeInsert,
    includeDivisionSummary,
    forcedBreakCsiPrefixes,
    forcedBreakTerms,
    noPresentation,
    scopeOfWorkId: null,
    scopeTitle: scopeTitle.trim() || null,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>

        {/* Sticky header + actions */}
        <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>PDF Options</h2>
            <button onClick={onClose} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
          </div>
          <div className="flex gap-2">
            {showPreview && previewUrlBuilder && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = previewUrlBuilder!(opts);
                  const a = document.createElement("a");
                  a.href = url;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="px-4 rounded-xl py-2 text-sm font-semibold inline-flex items-center"
                style={{ background: "#1e2736", border: "1px solid #C9A84C55", color: "#C9A84C" }}
              >
                👁 Preview
              </button>
            )}
            <button
              onClick={() => onConfirm(opts)}
              className="flex-1 rounded-xl py-2 text-sm font-bold"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {confirmLabel}
            </button>
            {onSendEmail && (
              <button
                onClick={() => onSendEmail(opts)}
                className="flex-1 rounded-xl py-2 text-sm font-bold"
                style={{ background: "#1a2436", border: "1px solid #C9A84C", color: "#C9A84C" }}
              >
                ✉ Send
              </button>
            )}
            <button onClick={onClose} className="px-4 rounded-xl py-2 text-sm font-medium" style={{ background: "#30373f", color: "#e6edf3" }}>
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">

          {/* ── SCOPE TITLE ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Scope of Work Title</p>
            <input
              type="text"
              value={scopeTitle}
              onChange={e => setScopeTitle(e.target.value)}
              placeholder="Default: estimate name"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>

          {/* ── PAGE 1: COVER ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Picture for Cover Page</p>
            <div style={{ display: "flex", gap: 12, height: 220 }}>

              {/* Left: list */}
              <div style={{ width: 200, overflowY: "auto", borderRadius: 8, border: "1px solid #30373f", background: "#0d1117", flexShrink: 0 }}>
                {COVER_OPTIONS.map(opt => {
                  const active = cover === opt.type;
                  return (
                    <button key={opt.type} onClick={() => { setCover(opt.type); setSelectedBlobUrl(null); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: active ? "#1e2a12" : "transparent", borderBottom: "1px solid #21262d", outline: "none", textAlign: "left", cursor: "pointer" }}>
                      <span style={{ fontSize: 9, color: "#C9A84C", opacity: active ? 1 : 0, flexShrink: 0 }}>●</span>
                      <span className="text-xs font-medium truncate" style={{ color: active ? "#C9A84C" : "#c9d1d9" }}>{opt.label}</span>
                    </button>
                  );
                })}

                {customCovers.map((c) => {
                  const active = cover === "CUSTOM" && selectedBlobUrl === c.blobUrl;
                  const isEditingThis = editingCoverUrl === c.blobUrl;
                  return (
                    <div key={c.blobUrl}
                      onClick={() => { setCover("CUSTOM"); setSelectedBlobUrl(c.blobUrl); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: active ? "#1e2a12" : "transparent", borderBottom: "1px solid #21262d", cursor: "pointer" }}>
                      <span style={{ fontSize: 9, color: "#C9A84C", opacity: active ? 1 : 0, flexShrink: 0 }}>●</span>
                      {isEditingThis ? (
                        <input
                          autoFocus
                          value={editingCoverName}
                          onChange={e => setEditingCoverName(e.target.value)}
                          onBlur={() => { saveCoverName(c.blobUrl, editingCoverName); setEditingCoverUrl(null); }}
                          onKeyDown={e => {
                            if (e.key === "Enter") { saveCoverName(c.blobUrl, editingCoverName); setEditingCoverUrl(null); }
                            if (e.key === "Escape") setEditingCoverUrl(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-none text-xs font-medium"
                          style={{ color: "#C9A84C", outline: "1px solid #C9A84C66", borderRadius: 2 }}
                        />
                      ) : (
                        <span className="flex-1 min-w-0 text-xs font-medium truncate"
                          style={{ color: active ? "#C9A84C" : "#c9d1d9", cursor: "text" }}
                          title="Click to rename"
                          onClick={e => { e.stopPropagation(); setEditingCoverUrl(c.blobUrl); setEditingCoverName(getCoverName(c)); }}>
                          {getCoverName(c)}
                        </span>
                      )}
                      <span
                        role="button"
                        title="Delete"
                        onClick={async e => {
                          e.stopPropagation();
                          await fetch(`/api/${companyId}/covers?b=${encodeURIComponent(c.blobUrl)}`, { method: "DELETE" });
                          setCustomCovers(prev => prev.filter(x => x.blobUrl !== c.blobUrl));
                          if (selectedBlobUrl === c.blobUrl) setSelectedBlobUrl(null);
                        }}
                        style={{ fontSize: 10, color: "#484f58", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>✕</span>
                    </div>
                  );
                })}

                {/* No Cover */}
                <button onClick={() => setCover("NONE")}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: cover === "NONE" ? "#2d1111" : "transparent", borderBottom: "1px solid #21262d", outline: "none", textAlign: "left", cursor: "pointer" }}>
                  <span style={{ fontSize: 9, color: "#f85149", opacity: cover === "NONE" ? 1 : 0, flexShrink: 0 }}>●</span>
                  <span className="text-xs font-medium" style={{ color: cover === "NONE" ? "#f87171" : "#c9d1d9" }}>No Cover</span>
                </button>

                {/* Upload */}
                {companyId && clientId && (
                  <div style={{ position: "relative", borderTop: "1px solid #21262d" }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}>
                    <input type="file" accept="image/*"
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", zIndex: 2 }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: dragOver ? "#1e2a12" : "transparent", cursor: "pointer" }}>
                      <span style={{ fontSize: 12, color: dragOver ? "#C9A84C" : "#484f58" }}>
                        {uploading ? "…" : "＋"}
                      </span>
                      <span className="text-xs font-medium" style={{ color: dragOver ? "#C9A84C" : "#8b949e" }}>Upload photo</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: preview */}
              <div style={{ flex: 1, borderRadius: 8, overflow: "hidden", border: "1px solid #30373f", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cover === "NONE" ? (
                  <span style={{ fontSize: 48, opacity: 0.2 }}>⊘</span>
                ) : cover === "CUSTOM" ? (
                  selectedBlobUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customCovers.find(c => c.blobUrl === selectedBlobUrl)?.proxyUrl ?? ""} alt="preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <span className="text-xs" style={{ color: "#484f58" }}>No image selected</span>
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={COVER_OPTIONS.find(o => o.type === cover)?.img ?? ""} alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs rounded px-3 py-2" style={{ background: "#2d1111", border: "1px solid #f8514944", color: "#f85149" }}>
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} style={{ color: "#f85149" }}>✕</button>
              </div>
            )}
          </div>

          {/* ── PAGE 2: PRESENTATION + SCOPE ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 2 — Presentation</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PAGE2_OPTIONS.map(opt => {
                const active = page2 === opt.type;
                const isNone = opt.type === "NONE";
                return (
                  <button key={opt.type} onClick={() => setPage2(opt.type)}
                    className="rounded-xl p-2.5 text-left transition-all"
                    style={{ border: `2px solid ${active ? (isNone ? "#f85149" : "#C9A84C") : "#30373f"}`, background: active ? (isNone ? "#2d1b1b" : "#1e2a12") : "#1e2736", outline: "none" }}>
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <div className="text-xs font-semibold" style={{ color: active ? (isNone ? "#f87171" : "#C9A84C") : "#e6edf3" }}>{opt.label}</div>
                  </button>
                );
              })}
            </div>

          </div>

          {/* ── INSERT FILE ── */}
          {hasInsertFile && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Include report page?</p>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: true, icon: "✅", label: "Yes", desc: "Include uploaded report page" }, { v: false, icon: "⊘", label: "No", desc: "Skip — avoid blank page" }].map(o => (
                  <button key={String(o.v)} onClick={() => setIncludeInsert(o.v)}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{ border: `2px solid ${includeInsert === o.v ? "#C9A84C" : "#30373f"}`, background: includeInsert === o.v ? "#1e2a12" : "#1e2736", outline: "none" }}>
                    <div className="text-2xl mb-1">{o.icon}</div>
                    <div className="text-xs font-semibold" style={{ color: includeInsert === o.v ? "#C9A84C" : "#e6edf3" }}>{o.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── DIVISION SUMMARY ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Include Division Summary Page?</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: true, icon: "📊", label: "Yes", desc: "Add a summary page with division totals" }, { v: false, icon: "⊘", label: "No", desc: "Skip summary page" }].map(o => (
                <button key={String(o.v)} onClick={() => setIncludeDivisionSummary(o.v)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{ border: `2px solid ${includeDivisionSummary === o.v ? "#C9A84C" : "#30373f"}`, background: includeDivisionSummary === o.v ? "#1e2a12" : "#1e2736", outline: "none" }}>
                  <div className="text-2xl mb-1">{o.icon}</div>
                  <div className="text-xs font-semibold" style={{ color: includeDivisionSummary === o.v ? "#C9A84C" : "#e6edf3" }}>{o.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── FORCE PAGE BREAK ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Force New Page Before</p>
            <div className="flex flex-wrap gap-2">
              {["02","03","04","05","06","07","08","09","10","11","12","13","14","21","22","23","26","27","28","31","32","33"].map(prefix => {
                const on = forcedBreakCsiPrefixes.includes(prefix);
                return (
                  <button key={prefix}
                    onClick={() => setForcedBreakCsiPrefixes(prev => on ? prev.filter(p => p !== prefix) : [...prev, prefix])}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{ background: on ? "#C9A84C" : "#1e2736", color: on ? "#0d1117" : "#8b949e", border: `1px solid ${on ? "#C9A84C" : "#30373f"}` }}>
                    Div {prefix}
                  </button>
                );
              })}
              <button
                onClick={() => setForcedBreakTerms(prev => !prev)}
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                style={{ background: forcedBreakTerms ? "#C9A84C" : "#1e2736", color: forcedBreakTerms ? "#0d1117" : "#8b949e", border: `1px solid ${forcedBreakTerms ? "#C9A84C" : "#30373f"}` }}>
                T&amp;C
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
