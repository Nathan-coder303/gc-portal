"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientCoverPhoto } from "@/app/[companyId]/estimates/actions";

const GOLD = "#C9A84C";

const PRESETS = [
  { key: "FLAT_ROOFS", label: "Flat Roofs", thumb: "/flat-roofs-cover.jpg" },
  { key: "ADDITIONS", label: "Additions", thumb: "/additions.jpg" },
] as const;

export default function ClientCoverPhotoSelector({
  clientId,
  initialType,
  initialUrl,
}: {
  clientId: string;
  initialType: string | null;
  initialUrl: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(initialType);
  const [customUrl, setCustomUrl] = useState<string | null>(initialType === "CUSTOM" ? initialUrl : null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
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

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const pathParts = window.location.pathname.split("/");
      const companyId = pathParts[1];
      const res = await fetch(`/api/${companyId}/clients/${clientId}/cover`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setCustomUrl(data.url);
        setSelected("CUSTOM");
        router.refresh();
      }
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
    </div>
  );
}
