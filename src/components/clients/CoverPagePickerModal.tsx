"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export const COVER_OPTIONS = [
  { type: "FLAT_ROOFS",    label: "Flat Roofs",    img: "/flat-roofs-cover.jpg",      desc: "Flat / low-slope roofing" },
  { type: "ADDITIONS",     label: "Additions",     img: "/additions.jpg",             desc: "Home additions" },
  { type: "LAUNDRY",       label: "Laundry",       img: "/laundry-cover.png",         desc: "Laundry room" },
  { type: "SHINGLE_ROOFS", label: "Shingle Roofs", img: "/shingle-roofs-cover.png",   desc: "Shingle roofing" },
] as const;

export type CoverType = (typeof COVER_OPTIONS)[number]["type"] | "CUSTOM" | "NONE";
export type Page2Type = "ROOF" | "ADDITION" | "RETAIL" | "NONE";

const PAGE2_OPTIONS: { type: Page2Type; label: string; desc: string; icon: string }[] = [
  { type: "ROOF",     label: "Roof",         desc: "Roof upgrades & options",      icon: "🏠" },
  { type: "ADDITION", label: "Construction", desc: "Addition / construction intro", icon: "🏗️" },
  { type: "RETAIL",   label: "Retail",       desc: "Retail buildout & scope",       icon: "🏪" },
  { type: "NONE",     label: "None",         desc: "Skip presentation",             icon: "⊘" },
];

export type PdfOptions = {
  coverType: CoverType;
  coverBlobUrl?: string | null;
  page2: Page2Type;
  includeInsert: boolean;
  includeDivisionSummary: boolean;
  forcedBreakCsiPrefixes: string[];
  noPresentation: boolean;
  scopeOfWorkId?: string | null;
};

type ScopeItem = { id: string; name: string; title: string; body: string };
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
  const defaultCover: CoverType = initialCoverType ?? (isCommercial ? "ADDITIONS" : "FLAT_ROOFS");
  const [cover, setCover] = useState<CoverType>(defaultCover);
  const [page2, setPage2] = useState<Page2Type>(initialPage2 === "NONE" ? "ROOF" : initialPage2);
  const [includeInsert, setIncludeInsert] = useState(true);
  const [forcedBreakCsiPrefixes, setForcedBreakCsiPrefixes] = useState<string[]>([]);

  // Scope of Work (merged into presentation section)
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [scopeOfWorkId, setScopeOfWorkId] = useState<string | null>(null);
  const [showAddScope, setShowAddScope] = useState(false);
  const [editingScope, setEditingScope] = useState<ScopeItem | null>(null);
  const [scopeForm, setScopeForm] = useState({ name: "", title: "", body: "" });
  const [savingScope, setSavingScope] = useState(false);

  // Custom cover gallery
  const [customCovers, setCustomCovers] = useState<CustomCover[]>([]);
  const [selectedBlobUrl, setSelectedBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Editable cover names (localStorage)
  const [coverNames, setCoverNames] = useState<Record<string, string>>({});
  const [editingCoverUrl, setEditingCoverUrl] = useState<string | null>(null);
  const [editingCoverName, setEditingCoverName] = useState("");

  // Track whether saved opts have been loaded (prevent overwriting before load)
  const savedOptsLoaded = useRef(false);

  // Load saved PDF options + cover names from localStorage on mount
  useEffect(() => {
    try {
      const savedNames = JSON.parse(localStorage.getItem("gc-cover-names") ?? "{}");
      setCoverNames(savedNames);
    } catch {}
    if (!companyId) { savedOptsLoaded.current = true; return; }
    try {
      const saved = JSON.parse(localStorage.getItem(`gc-pdf-opts-${companyId}`) ?? "null");
      if (saved) {
        if (saved.coverType) setCover(saved.coverType as CoverType);
        if (saved.page2) setPage2(saved.page2 as Page2Type);
        if ("scopeOfWorkId" in saved) setScopeOfWorkId(saved.scopeOfWorkId ?? null);
        if ("selectedBlobUrl" in saved) setSelectedBlobUrl(saved.selectedBlobUrl ?? null);
      }
    } catch {}
    savedOptsLoaded.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save PDF options to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (!savedOptsLoaded.current || !companyId) return;
    try {
      localStorage.setItem(`gc-pdf-opts-${companyId}`, JSON.stringify({ coverType: cover, page2, scopeOfWorkId, selectedBlobUrl }));
    } catch {}
  }, [cover, page2, scopeOfWorkId, selectedBlobUrl, companyId]);

  function getCoverName(c: CustomCover): string {
    return coverNames[c.blobUrl] ?? formatCoverName(c.filename);
  }

  function saveCoverName(blobUrl: string, name: string) {
    const trimmed = name.trim();
    setCoverNames(prev => {
      const updated = { ...prev, [blobUrl]: trimmed || formatCoverName(customCovers.find(c => c.blobUrl === blobUrl)?.filename ?? "") };
      try { localStorage.setItem("gc-cover-names", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/${companyId}/scopes-of-work`)
      .then(r => r.json()).then(d => setScopes(d.scopes ?? [])).catch(() => {});
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/${companyId}/covers`)
      .then(r => r.json())
      .then(data => {
        const covers: CustomCover[] = data.covers ?? [];
        setCustomCovers(covers);
        if (customCoverUrl && covers.length > 0) setSelectedBlobUrl(covers[0].blobUrl);
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
    includeDivisionSummary: false,
    forcedBreakCsiPrefixes,
    noPresentation,
    scopeOfWorkId: noPresentation ? null : scopeOfWorkId,
  };

  function openAddScope() {
    setScopeForm({ name: "", title: "", body: "" });
    setEditingScope(null);
    setShowAddScope(true);
  }

  function openEditScope(s: ScopeItem) {
    setScopeForm({ name: s.name, title: s.title, body: s.body });
    setEditingScope(s);
    setShowAddScope(true);
  }

  async function handleSaveScope() {
    if (!companyId || !scopeForm.name.trim() || !scopeForm.title.trim() || !scopeForm.body.trim()) return;
    setSavingScope(true);
    try {
      if (editingScope) {
        // Update existing
        const res = await fetch(`/api/${companyId}/scopes-of-work/${editingScope.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: scopeForm.name, title: scopeForm.title, body: scopeForm.body }),
        });
        const data = await res.json() as { scope?: ScopeItem };
        if (data.scope) {
          setScopes(prev => prev.map(s => s.id === data.scope!.id ? data.scope! : s));
          setScopeOfWorkId(data.scope.id);
        }
      } else {
        // Create new
        const res = await fetch(`/api/${companyId}/scopes-of-work`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: scopeForm.name, title: scopeForm.title, body: scopeForm.body }),
        });
        const data = await res.json() as { scope?: ScopeItem };
        if (data.scope) {
          setScopes(prev => [data.scope!, ...prev]);
          setScopeOfWorkId(data.scope.id);
        }
      }
      setShowAddScope(false);
      setScopeForm({ name: "", title: "", body: "" });
      setEditingScope(null);
    } finally {
      setSavingScope(false);
    }
  }

  const selectedScope = scopes.find(s => s.id === scopeOfWorkId) ?? null;

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

          {/* ── PAGE 1: COVER ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Page 1 — Cover</p>
            {/* Horizontal scroll strip */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {COVER_OPTIONS.map(opt => {
                const active = cover === opt.type;
                return (
                  <button key={opt.type} onClick={() => { setCover(opt.type); setSelectedBlobUrl(null); }}
                    className="rounded-lg overflow-hidden text-left transition-all shrink-0"
                    style={{ width: 100, border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, outline: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={opt.img} alt={opt.label} style={{ width: "100%", height: 56, objectFit: "cover", display: "block" }} />
                    <div className="px-1.5 py-1" style={{ background: active ? "#1e2a12" : "#1e2736" }}>
                      <div className="text-[11px] font-semibold truncate" style={{ color: active ? "#C9A84C" : "#e6edf3" }}>{opt.label}</div>
                    </div>
                  </button>
                );
              })}

              {customCovers.map((c) => {
                const active = cover === "CUSTOM" && selectedBlobUrl === c.blobUrl;
                const isEditingThis = editingCoverUrl === c.blobUrl;
                return (
                  <button key={c.blobUrl} onClick={() => { setCover("CUSTOM"); setSelectedBlobUrl(c.blobUrl); }}
                    className="rounded-lg overflow-hidden text-left transition-all shrink-0"
                    style={{ width: 100, border: `2px solid ${active ? "#C9A84C" : "#30373f"}`, outline: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.proxyUrl} alt={getCoverName(c)} style={{ width: "100%", height: 56, objectFit: "cover", display: "block" }} />
                    <div className="px-1.5 py-1" style={{ background: active ? "#1e2a12" : "#1e2736" }}>
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
                          className="w-full bg-transparent border-none text-[11px] font-semibold"
                          style={{ color: active ? "#C9A84C" : "#e6edf3", outline: "1px solid #C9A84C66", borderRadius: 2 }}
                        />
                      ) : (
                        <div
                          className="text-[11px] font-semibold truncate"
                          style={{ color: active ? "#C9A84C" : "#e6edf3", cursor: "text" }}
                          title="Click to rename"
                          onClick={e => { e.stopPropagation(); setEditingCoverUrl(c.blobUrl); setEditingCoverName(getCoverName(c)); }}
                        >
                          {getCoverName(c)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* No Cover */}
              {(() => {
                const active = cover === "NONE";
                return (
                  <button onClick={() => setCover("NONE")} className="rounded-lg overflow-hidden text-left transition-all shrink-0"
                    style={{ width: 100, border: `2px solid ${active ? "#f85149" : "#30373f"}`, outline: "none" }}>
                    <div style={{ width: "100%", height: 56, background: active ? "#2d1111" : "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 22, opacity: 0.6 }}>⊘</span>
                    </div>
                    <div className="px-1.5 py-1" style={{ background: active ? "#2d1111" : "#1e2736" }}>
                      <div className="text-[11px] font-semibold" style={{ color: active ? "#f87171" : "#e6edf3" }}>No Cover</div>
                    </div>
                  </button>
                );
              })()}

              {/* Upload tile */}
              {companyId && clientId && (
                <div className="rounded-lg overflow-hidden text-left transition-all shrink-0"
                  style={{ width: 100, border: `2px dashed ${dragOver ? "#C9A84C" : "#30373f"}`, outline: "none", position: "relative" }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}>
                  <input type="file" accept="image/*"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 2 }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                  <div style={{ width: "100%", height: 56, background: dragOver ? "#1e2a12" : "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {uploading ? <span style={{ color: "#8b949e", fontSize: 10 }}>…</span>
                      : <span style={{ color: dragOver ? "#C9A84C" : "#484f58", fontSize: 18 }}>📁</span>}
                  </div>
                  <div className="px-1.5 py-1" style={{ background: "#1e2736" }}>
                    <div className="text-[11px] font-semibold" style={{ color: "#e6edf3" }}>Upload</div>
                  </div>
                </div>
              )}
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
                    <div className="text-[10px] mt-0.5" style={{ color: "#8b949e" }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Scope of Work — editable text page, shown when presentation is selected */}
            {!noPresentation && companyId && (
              <div className="rounded-xl p-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Custom Text Page</span>
                  {scopeOfWorkId && selectedScope && (
                    <button onClick={() => openEditScope(selectedScope)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: "#C9A84C", border: "1px solid #C9A84C44" }}>
                      Edit
                    </button>
                  )}
                </div>
                <select
                  value={scopeOfWorkId ?? ""}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "__add__") { openAddScope(); }
                    else { setScopeOfWorkId(v || null); setShowAddScope(false); }
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#161b22", border: `1px solid ${scopeOfWorkId ? "#C9A84C66" : "#30373f"}`, color: "#e6edf3", outline: "none" }}
                >
                  <option value="">None — no extra text page</option>
                  {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__add__">+ Create new…</option>
                </select>
                {selectedScope && (
                  <div className="mt-2 text-[10px] px-2 py-1 rounded" style={{ background: "#161b22", color: "#8b949e" }}>
                    <span className="font-semibold" style={{ color: "#C9A84C" }}>{selectedScope.title}</span>
                    <span className="ml-1.5">{selectedScope.body.slice(0, 100)}…</span>
                  </div>
                )}

                {showAddScope && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold" style={{ color: "#C9A84C" }}>{editingScope ? "Edit scope" : "New scope"}</div>
                    <input value={scopeForm.name} onChange={e => setScopeForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Short name (e.g. Outdoor Renovations)"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }} />
                    <input value={scopeForm.title} onChange={e => setScopeForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="PDF heading (e.g. PERMIT & DESIGN SCOPE OF WORK)"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }} />
                    <textarea value={scopeForm.body} onChange={e => setScopeForm(f => ({ ...f, body: e.target.value }))}
                      placeholder={"Intro paragraph...\n\n1. Section Title\nSection body text..."}
                      rows={8}
                      className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                      style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3", outline: "none", resize: "vertical" }} />
                    <div className="flex gap-2">
                      <button onClick={handleSaveScope}
                        disabled={savingScope || !scopeForm.name.trim() || !scopeForm.title.trim() || !scopeForm.body.trim()}
                        className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
                        style={{ background: "#C9A84C", color: "#0d1117" }}>
                        {savingScope ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => { setShowAddScope(false); setEditingScope(null); }}
                        className="px-4 py-2 rounded-xl text-sm" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* ── FORCE PAGE BREAK ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Force New Page Before Division</p>
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
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
