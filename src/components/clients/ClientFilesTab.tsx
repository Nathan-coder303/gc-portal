"use client";

import { useState, useRef, useCallback } from "react";
import { TrashIcon } from "@/components/ui/icons";

type ClientFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
  uploadedAt: string;
  useInEstimate: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const type = mimeType ?? "";
  if (type.includes("pdf")) return <span style={{ color: "#ef4444" }}>PDF</span>;
  if (type.includes("image")) return <span style={{ color: "#3b82f6" }}>IMG</span>;
  if (type.includes("word") || type.includes("document")) return <span style={{ color: "#60a5fa" }}>DOC</span>;
  if (type.includes("sheet") || type.includes("excel")) return <span style={{ color: "#22c55e" }}>XLS</span>;
  return <span style={{ color: "#8b949e" }}>FILE</span>;
}

export default function ClientFilesTab({
  companyId,
  clientId,
  initialFiles,
}: {
  companyId: string;
  clientId: string;
  initialFiles: ClientFile[];
}) {
  const [files, setFiles] = useState<ClientFile[]>(initialFiles);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    for (const file of arr) {
      setUploading(prev => [...prev, file.name]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/${companyId}/clients/${clientId}/files`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          const record = await res.json();
          setFiles(prev => [{ ...record, useInEstimate: record.useInEstimate ?? false, uploadedAt: record.uploadedAt ?? new Date().toISOString() }, ...prev]);
        } else {
          const body = await res.json().catch(() => ({}));
          setErrors(prev => [...prev, `Failed to upload "${file.name}": ${body.error ?? res.statusText}`]);
        }
      } catch (e) {
        setErrors(prev => [...prev, `Failed to upload "${file.name}": network error`]);
      } finally {
        setUploading(prev => prev.filter(n => n !== file.name));
      }
    }
  }, [companyId, clientId]);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  async function handleDelete(fileId: string) {
    setDeletingId(fileId);
    try {
      await fetch(`/api/${companyId}/clients/${clientId}/files?fileId=${fileId}`, { method: "DELETE" });
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleEstimate(fileId: string, currentValue: boolean) {
    setTogglingId(fileId);
    const next = !currentValue;
    try {
      await fetch(`/api/${companyId}/clients/${clientId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, useInEstimate: next }),
      });
      // Clear all, then set the toggled one
      setFiles(prev => prev.map(f => ({ ...f, useInEstimate: next && f.id === fileId })));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-10 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? "#C9A84C" : "#30373f"}`,
          background: dragging ? "#C9A84C0d" : "#161b22",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
        <div className="text-3xl mb-3">📁</div>
        <p className="text-sm font-medium" style={{ color: dragging ? "#C9A84C" : "#e6edf3" }}>
          {dragging ? "Drop files here" : "Drag & drop files, or click to browse"}
        </p>
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>Any file type · Max 50 MB each</p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs rounded px-3 py-2" style={{ background: "#2d1111", border: "1px solid #f8514944", color: "#f85149" }}>
              <span>{err}</span>
              <button onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))} style={{ color: "#f85149" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(name => (
            <div key={name} className="flex items-center gap-2 text-xs rounded px-3 py-2" style={{ background: "#1e2736", color: "#8b949e" }}>
              <span>⏳</span>
              <span>Uploading {name}…</span>
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length === 0 && uploading.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#8b949e" }}>No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map(file => {
            const isPdf = file.mimeType?.includes("pdf") || file.fileName.toLowerCase().endsWith(".pdf");
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "#1e2736",
                  border: `1px solid ${file.useInEstimate ? "#C9A84C66" : "#30373f"}`,
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                  <FileIcon mimeType={file.mimeType} />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                    style={{ color: "#e6edf3" }}
                  >
                    {file.fileName}
                  </a>
                  <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "#8b949e" }}>
                    <span>{formatBytes(file.fileSize)} · {new Date(file.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {file.useInEstimate && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
                        Page 2 → Estimate page 3
                      </span>
                    )}
                  </div>
                </div>

                {/* Insert in estimate toggle — only for PDFs */}
                {isPdf && (
                  <button
                    onClick={() => handleToggleEstimate(file.id, file.useInEstimate)}
                    disabled={togglingId === file.id}
                    title={file.useInEstimate ? "Remove from estimate PDF" : "Insert page 2 of this PDF as page 3 of the estimate"}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                    style={
                      file.useInEstimate
                        ? { background: "#C9A84C", color: "#0d1117", border: "1px solid #C9A84C" }
                        : { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }
                    }
                  >
                    <span>📋</span>
                    <span>{file.useInEstimate ? "In estimate" : "Use in estimate"}</span>
                  </button>
                )}

                <a
                  href={file.fileUrl}
                  download={file.fileName}
                  className="w-7 h-7 rounded flex items-center justify-center text-xs"
                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                  title="Download"
                  onClick={e => e.stopPropagation()}
                >
                  ↓
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                  className="w-7 h-7 rounded flex items-center justify-center"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Delete"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
