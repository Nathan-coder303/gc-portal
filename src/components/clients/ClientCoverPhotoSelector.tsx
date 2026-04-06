"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientCoverPhoto, updateClientCoverTitle } from "@/app/[companyId]/estimates/actions";

const GOLD = "#C9A84C";

const PRESETS = [
  { key: "FLAT_ROOFS", label: "Flat Roofs", thumb: "/flat-roofs-cover.jpg" },
  { key: "ADDITIONS", label: "Additions", thumb: "/additions.jpg" },
  { key: "LAUNDRY", label: "Laundry", thumb: "/laundry-cover.png" },
  { key: "SHINGLE_ROOFS", label: "Shingle Roofs", thumb: "/shingle-roofs-cover.png" },
] as const;

/** Compress an image File client-side to stay under 4MB (Vercel limit). */
async function compressImage(file: File, maxPx = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target!.result as string;
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

export default function ClientCoverPhotoSelector({
  clientId,
  companyId,
  initialType,
  initialUrl: _initialUrl, // eslint-disable-line @typescript-eslint/no-unused-vars
  initialTitle,
}: {
  clientId: string;
  companyId: string;
  initialType: string | null;
  initialUrl: string | null;
  initialTitle?: string | null;
}) {
  const proxyUrl = `/api/${companyId}/clients/${clientId}/cover`;
  const [selected, setSelected] = useState<string | null>(initialType);
  const [customUrl, setCustomUrl] = useState<string | null>(initialType === "CUSTOM" ? proxyUrl : null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [coverTitle, setCoverTitle] = useState(initialTitle ?? "");
  const [titleSaving, setTitleSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function select(key: string) {
    setSelected(key);
    startTransition(async () => {
      await updateClientCoverPhoto(clientId, key, key === "CUSTOM" ? customUrl : null);
      router.refresh();
    });
  }

  function clear() {
    setSelected(null);
    setCustomUrl(null);
    startTransition(async () => {
      await updateClientCoverPhoto(clientId, null, null);
      router.refresh();
    });
  }

  async function saveTitle() {
    setTitleSaving(true);
    try {
      await updateClientCoverTitle(clientId, coverTitle || null);
      router.refresh();
    } finally {
      setTitleSaving(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
      const res = await fetch(`/api/${companyId}/clients/${clientId}/cover`, { method: "POST", body: fd });
      const text = await res.text();
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }
      if (data.url) {
        setCustomUrl(data.url);
        setSelected("CUSTOM");
        router.refresh();
      } else {
        setUploadError(data.error ?? `Upload failed (${res.status})`);
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>PDF Cover Photo</h3>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Appears as page 1 when sending estimates</p>
        </div>
        {selected && (
          <button onClick={clear} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#8b949e", border: "1px solid #30373f" }}>
            ✕ Remove
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {/* Preset options */}
        {PRESETS.map(preset => (
          <button
            key={preset.key}
            onClick={() => select(preset.key)}
            disabled={isPending}
            className="flex flex-col items-center gap-2 rounded-xl overflow-hidden transition-all hover:scale-105"
            style={{
              border: `2px solid ${selected === preset.key ? GOLD : "#30373f"}`,
              background: "#0d1117",
              width: 120,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preset.thumb}
              alt={preset.label}
              style={{ width: "100%", height: 68, objectFit: "cover", display: "block" }}
            />
            <span className="text-xs font-semibold pb-2" style={{ color: selected === preset.key ? GOLD : "#8b949e" }}>
              {selected === preset.key ? "✓ " : ""}{preset.label}
            </span>
          </button>
        ))}

        {/* Upload / drag-and-drop custom */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && !isPending && fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl transition-all cursor-pointer"
          style={{
            border: `2px ${dragOver ? "solid" : "dashed"} ${selected === "CUSTOM" ? GOLD : dragOver ? GOLD : "#30373f"}`,
            background: dragOver ? "#1a2a1a" : "#0d1117",
            width: 120,
            height: 108,
          }}
        >
          {selected === "CUSTOM" && customUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={customUrl}
                alt="Custom cover"
                style={{ width: "100%", height: 68, objectFit: "cover", display: "block", borderRadius: "8px 8px 0 0" }}
              />
              <span className="text-xs font-semibold pb-2" style={{ color: GOLD }}>✓ Custom</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 24 }}>{uploading ? "⏳" : dragOver ? "📂" : "📷"}</span>
              <span className="text-xs font-semibold text-center px-2" style={{ color: dragOver ? GOLD : "#8b949e" }}>
                {uploading ? "Uploading…" : dragOver ? "Drop image" : "Upload or drag"}
              </span>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {uploadError && (
        <p className="text-xs mt-2" style={{ color: "#ef4444" }}>⚠ {uploadError}</p>
      )}

      {/* Cover page title */}
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid #30373f" }}>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b949e" }}>Cover Page Title <span style={{ color: "#555" }}>(optional — appears on PDF cover)</span></label>
        <div className="flex gap-2">
          <input
            type="text"
            value={coverTitle}
            onChange={(e) => setCoverTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            placeholder="e.g. Roof Replacement Project"
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
          />
          <button
            onClick={saveTitle}
            disabled={titleSaving}
            className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            {titleSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
